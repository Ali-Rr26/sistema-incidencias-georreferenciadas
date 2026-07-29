import { http } from '../../../core/http.service.js';
import { notificationService } from '../../../shared/notification.service.js';
import { openLightbox } from '../../../shared/lightbox.js';

/**
 * IncidenciaAuditarModal — Bootstrap modal for auditing a pending incident.
 *
 * Loads the incident detail via GET /api/incidents/{id} (where id comes from
 * the notification's data.incident_id field) and displays:
 *   - Header: title + status badge
 *   - Info: description, category, location, creation date, responsible operator
 *   - Resolution info: status + resolution date
 *   - Evidence: incident images + comment images with lightbox
 *   - Footer: Approve / Reject buttons
 *
 * Usage:
 *   const modal = document.getElementById('incidencia-auditar-modal');
 *   modal.show(notificationId);
 *
 * Events emitted:
 *   - 'incident-decided' with { detail: { notificationId, decision } }
 *     where decision is 'approved' | 'rejected'
 *
 * @element incidencia-auditar-modal
 */
class IncidenciaAuditarModal extends HTMLElement {
  constructor() {
    super();
    this._notificationId = null;
    this._incident = null;
    this._loading = false;
    this._error = null;
  }

  connectedCallback() {
    this._render();
  }

  _render() {
    this.innerHTML = `
      <div class="modal fade" id="${this.id}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title incident-auditar-title">Detalle de la incidencia</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <!-- Loading state -->
              <div class="incident-auditar-loading d-none text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2 text-muted">Cargando información de la incidencia...</p>
              </div>

              <!-- Error state -->
              <div class="incident-auditar-error alert alert-danger d-none" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <span class="incident-auditar-error-msg"></span>
              </div>

              <!-- Content -->
              <div class="incident-auditar-content d-none">
                <!-- Header: title + status badge -->
                <div class="mb-3">
                  <h4 class="incident-auditar-inc-title mb-1"></h4>
                  <span class="incident-auditar-status-badge badge"></span>
                </div>

                <!-- Basic info -->
                <div class="card mb-3">
                  <div class="card-body">
                    <h6 class="card-title text-muted mb-3">Información general</h6>
                    <dl class="row mb-0">
                      <dt class="col-sm-3 text-muted">Descripción</dt>
                      <dd class="col-sm-9 incident-auditar-description"></dd>

                      <dt class="col-sm-3 text-muted">Categoría</dt>
                      <dd class="col-sm-9 incident-auditar-category"></dd>

                      <dt class="col-sm-3 text-muted">Ubicación</dt>
                      <dd class="col-sm-9 incident-auditar-location"></dd>

                      <dt class="col-sm-3 text-muted">Fecha de creación</dt>
                      <dd class="col-sm-9 incident-auditar-created-at"></dd>

                      <dt class="col-sm-3 text-muted">Operador responsable</dt>
                      <dd class="col-sm-9 incident-auditar-responsible"></dd>

                      <dt class="col-sm-3 text-muted">Fecha de resolución</dt>
                      <dd class="col-sm-9 incident-auditar-resolved-at"></dd>
                    </dl>
                  </div>
                </div>

                <!-- Evidence: images -->
                <div class="card mb-3">
                  <div class="card-body">
                    <h6 class="card-title text-muted mb-3">Evidencia gráfica</h6>
                    <div class="incident-auditar-images row g-2"></div>
                    <p class="text-muted small incident-auditar-no-images d-none">Sin imágenes adjuntas.</p>
                  </div>
                </div>

                <!-- Evidence: comment images -->
                <div class="card mb-3">
                  <div class="card-body">
                    <h6 class="card-title text-muted mb-3">Imágenes en comentarios</h6>
                    <div class="incident-auditar-comment-images row g-2"></div>
                    <p class="text-muted small incident-auditar-no-comment-images d-none">Sin imágenes en comentarios.</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-outline-danger btn-rechazar">
                <i class="fa-solid fa-xmark me-1"></i> Rechazar
              </button>
              <button type="button" class="btn btn-success btn-aprobar">
                <i class="fa-solid fa-check me-1"></i> Aprobar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindFooterEvents();
  }

  _bindFooterEvents() {
    const modalEl = this.querySelector('.modal');

    // Approve button
    this.querySelector('.btn-aprobar')?.addEventListener('click', async () => {
      await this._handleApprove();
    });

    // Reject button - opens sub-modal
    this.querySelector('.btn-rechazar')?.addEventListener('click', async () => {
      await this._handleReject();
    });

    // Close error state when modal is hidden
    modalEl.addEventListener('hidden.bs.modal', () => {
      this._reset();
    });
  }

  _reset() {
    this._notificationId = null;
    this._incident = null;
    this._loading = false;
    this._error = null;

    const loadingEl = this.querySelector('.incident-auditar-loading');
    const errorEl = this.querySelector('.incident-auditar-error');
    const contentEl = this.querySelector('.incident-auditar-content');

    loadingEl?.classList.add('d-none');
    errorEl?.classList.add('d-none');
    contentEl?.classList.add('d-none');
  }

  /**
   * Show the modal and load the incident for the given notification.
   * @param {number} notificationId - the notification ID
   */
  async show(notificationId) {
    const modalEl = this.querySelector('.modal');
    const loadingEl = this.querySelector('.incident-auditar-loading');
    const errorEl = this.querySelector('.incident-auditar-error');
    const contentEl = this.querySelector('.incident-auditar-content');

    // Reset state (clears _notificationId, _incident, etc.)
    this._reset();

    // Set the notificationId AFTER reset so _loadIncident can use it.
    this._notificationId = notificationId;

    loadingEl?.classList.remove('d-none');
    errorEl?.classList.add('d-none');
    contentEl?.classList.add('d-none');

    // Show modal
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    await this._loadIncident();
  }

  async _loadIncident() {
    if (!this._notificationId) return;

    const loadingEl = this.querySelector('.incident-auditar-loading');
    const errorEl = this.querySelector('.incident-auditar-error');
    const errorMsgEl = this.querySelector('.incident-auditar-error-msg');
    const contentEl = this.querySelector('.incident-auditar-content');

    try {
      // First get the notification to find the incident_id
      const notif = await notificationService.getById(this._notificationId);
      const incidentId = notif?.data?.incident_id || notif?.incident_id;

      if (!incidentId) {
        throw new Error('No se pudo determinar el ID de la incidencia.');
      }

      // Fetch incident detail
      const resp = await http.get(`/incidents/${incidentId}`);
      this._incident = resp.data ?? resp;

      // Render content
      loadingEl?.classList.add('d-none');
      contentEl?.classList.remove('d-none');
      this._renderIncident();
    } catch (err) {
      // Always show a user-friendly prefix; include the underlying message
      // for debugging when available.
      const detail = err?.message ? ` (${err.message})` : '';
      this._error = `No se pudo cargar la información de la incidencia.${detail}`;
      loadingEl?.classList.add('d-none');
      errorMsgEl.textContent = this._error;
      errorEl?.classList.remove('d-none');
    }
  }

  _renderIncident() {
    if (!this._incident) return;

    const inc = this._incident;

    // Title and status
    const titleEl = this.querySelector('.incident-auditar-inc-title');
    const badgeEl = this.querySelector('.incident-auditar-status-badge');

    if (titleEl) titleEl.textContent = inc.title || 'Sin título';

    if (badgeEl) {
      badgeEl.textContent = this._formatStatus(inc.status);
      badgeEl.className = `incident-auditar-status-badge badge bg-${this._statusColor(inc.status)}`;
    }

    // Description
    const descEl = this.querySelector('.incident-auditar-description');
    if (descEl) descEl.textContent = inc.description || '—';

    // Category
    const catEl = this.querySelector('.incident-auditar-category');
    if (catEl) catEl.textContent = inc.category?.name || '—';

    // Location
    const locEl = this.querySelector('.incident-auditar-location');
    if (locEl) locEl.textContent = inc.location?.name || inc.location || '—';

    // Created at
    const createdEl = this.querySelector('.incident-auditar-created-at');
    if (createdEl)
      createdEl.textContent = inc.created_at
        ? this._formatDate(inc.created_at)
        : '—';

    // Responsible operator
    const respEl = this.querySelector('.incident-auditar-responsible');
    if (respEl) {
      const user =
        inc.responsible_user_name ||
        (inc.responsible_user
          ? [inc.responsible_user.first_name, inc.responsible_user.last_name]
              .filter(Boolean)
              .join(' ')
          : '—');
      respEl.textContent = user;
    }

    // Resolved at
    const resolvedEl = this.querySelector('.incident-auditar-resolved-at');
    if (resolvedEl) {
      resolvedEl.textContent = inc.resolved_at
        ? this._formatDate(inc.resolved_at)
        : '—';
    }

    // Images
    this._renderImages(inc.images || []);

    // Comment images
    this._renderCommentImages(inc.comments || []);
  }

  _renderImages(images) {
    const container = this.querySelector('.incident-auditar-images');
    const noImagesEl = this.querySelector('.incident-auditar-no-images');

    if (!container) return;

    if (!images || images.length === 0) {
      container.innerHTML = '';
      noImagesEl?.classList.remove('d-none');
      return;
    }

    noImagesEl?.classList.add('d-none');
    container.innerHTML = images
      .map(
        (img) => `
      <div class="col-6 col-md-4 col-lg-3">
        <div class="incident-auditar-thumbnail-wrapper position-relative"
             data-src="${img.url}"
             data-caption="${img.original_name || ''}"
             role="button"
             tabindex="0"
             aria-label="Abrir imagen: ${img.original_name || 'sin nombre'}">
          <img src="${img.url}"
               alt="${img.original_name || 'Imagen'}"
               class="img-fluid rounded incident-auditar-thumbnail"
               loading="lazy" />
        </div>
      </div>
    `,
      )
      .join('');

    // Bind lightbox
    container
      .querySelectorAll('.incident-auditar-thumbnail-wrapper')
      .forEach((wrapper) => {
        wrapper.addEventListener('click', () => {
          openLightbox(wrapper.dataset.src, wrapper.dataset.caption);
        });
        wrapper.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openLightbox(wrapper.dataset.src, wrapper.dataset.caption);
          }
        });
      });
  }

  _renderCommentImages(comments) {
    const container = this.querySelector('.incident-auditar-comment-images');
    const noImagesEl = this.querySelector(
      '.incident-auditar-no-comment-images',
    );

    if (!container) return;

    // Collect images from comments
    const images = [];
    for (const comment of comments) {
      if (comment.images && comment.images.length > 0) {
        images.push(...comment.images);
      }
    }

    if (images.length === 0) {
      container.innerHTML = '';
      noImagesEl?.classList.remove('d-none');
      return;
    }

    noImagesEl?.classList.add('d-none');
    container.innerHTML = images
      .map(
        (img) => `
      <div class="col-6 col-md-4 col-lg-3">
        <div class="incident-auditar-thumbnail-wrapper position-relative"
             data-src="${img.url}"
             data-caption="${img.original_name || ''}"
             role="button"
             tabindex="0"
             aria-label="Abrir imagen de comentario: ${img.original_name || 'sin nombre'}">
          <img src="${img.url}"
               alt="${img.original_name || 'Imagen de comentario'}"
               class="img-fluid rounded incident-auditar-thumbnail"
               loading="lazy" />
        </div>
      </div>
    `,
      )
      .join('');

    // Bind lightbox
    container
      .querySelectorAll('.incident-auditar-thumbnail-wrapper')
      .forEach((wrapper) => {
        wrapper.addEventListener('click', () => {
          openLightbox(wrapper.dataset.src, wrapper.dataset.caption);
        });
        wrapper.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openLightbox(wrapper.dataset.src, wrapper.dataset.caption);
          }
        });
      });
  }

  async _handleApprove() {
    if (!this._notificationId) return;

    const approveBtn = this.querySelector('.btn-aprobar');
    const rejectBtn = this.querySelector('.btn-rechazar');

    approveBtn.disabled = true;
    rejectBtn.disabled = true;

    try {
      await notificationService.approve(this._notificationId);

      this.dispatchEvent(
        new CustomEvent('incident-decided', {
          bubbles: true,
          composed: true,
          detail: {
            notificationId: this._notificationId,
            decision: 'approved',
          },
        }),
      );

      bootstrap.Modal.getInstance(this.querySelector('.modal'))?.hide();
    } catch (err) {
      // Show error toast
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo aprobar la incidencia.', 'danger');
      }
    } finally {
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
    }
  }

  async _handleReject() {
    if (!this._notificationId) return;

    // Open the justificacion-rechazo-modal
    const rejectModalEl = document.getElementById(
      'justificacion-rechazo-modal',
    );
    if (!rejectModalEl) {
      console.error('justificacion-rechazo-modal not found in DOM');
      return;
    }

    rejectModalEl.show(async (reason) => {
      await this._performReject(reason);
    });
  }

  async _performReject(reason) {
    if (!this._notificationId || !reason) return;

    const approveBtn = this.querySelector('.btn-aprobar');
    const rejectBtn = this.querySelector('.btn-rechazar');

    approveBtn.disabled = true;
    rejectBtn.disabled = true;

    try {
      await notificationService.reject(this._notificationId, reason);

      this.dispatchEvent(
        new CustomEvent('incident-decided', {
          bubbles: true,
          composed: true,
          detail: {
            notificationId: this._notificationId,
            decision: 'rejected',
          },
        }),
      );

      bootstrap.Modal.getInstance(this.querySelector('.modal'))?.hide();
    } catch (err) {
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo rechazar la incidencia.', 'danger');
      }
    } finally {
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
    }
  }

  _formatStatus(status) {
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Proceso',
      resolved: 'Resuelto',
      closed: 'Cerrado',
    };
    return labels[status] || status || '—';
  }

  _statusColor(status) {
    const colors = {
      pending: 'warning',
      in_progress: 'info',
      resolved: 'success',
      closed: 'secondary',
    };
    return colors[status] || 'secondary';
  }

  _formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }
}

customElements.define('incidencia-auditar-modal', IncidenciaAuditarModal);

export default IncidenciaAuditarModal;
