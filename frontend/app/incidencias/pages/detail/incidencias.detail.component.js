import { STATUS_LABEL, PRIORITY_LABEL, escapeHtml, timeAgo, getCommentImageUrl } from '../../../utils/format.js';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';
import { auth } from '../../../auth/auth.service.js';
import initMapView from '../../../shared/init-map-view.js';
import { bindView } from '../../../utils/dom.js';
import { commentService } from '../../../shared/comment.service.js';
import { openLightbox, closeLightbox } from '../../../shared/lightbox.js';
import { assignmentService } from '../../../shared/assignment.service.js';
import { permissionService } from '../../../shared/permission.service.js';
import { responsablesService } from '../../../shared/responsables.service.js';

// CP-02-04-F: transiciones válidas por estado actual
const VALID_TRANSITIONS = {
  pending: ['in_progress'],
  in_progress: ['resolved'],
  resolved: [],
};

// CP-02-01-F: todos los estados visibles en dropdown (Cerrado sin soporte backend)
const DROPDOWN_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Proceso' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
];

export default {
  templateUrl: 'app/incidencias/pages/detail/incidencias.detail.component.html',

  async onInit({ params } = {}) {
    const id = params?.id;
    if (!id) {
      router.navigate('/incidencias');
      return;
    }

    this._incidentId = id;
    let inc;
    try {
      inc = await cargarIncidencia(id);
    } catch {
      router.navigate('/not-found');
      return;
    }
    renderizarIncidencia(inc);
    renderizarImagenes(inc.images ?? []);
    setupUpload(id);
    setupActionButtons(id, inc);
    setupBuscarResponsables(id);
    setupEstado(id, inc);
    renderHistorial(inc.status_history ?? []);
    setupComments(id);
    setupAssignments(id, inc, inc.assignments ?? []);
  },

  onDestroy() {
    const mapEl = document.getElementById('detalle-coords');
    if (!mapEl) return;
    // The disposer returned by initMapView() captures the L.Map in its
    // closure and also disconnects the ResizeObserver. Calling
    // `map.remove()` again on the same map (via `mapEl._leaflet_map`)
    // throws "Map container is being reused by another instance" from
    // Leaflet, because the second call sees a container that has
    // already been detached by the first. The disposer is the single
    // source of truth for teardown.
    if (typeof mapEl._leaflet_dispose === 'function') {
      mapEl._leaflet_dispose();
      delete mapEl._leaflet_dispose;
    }
  },
};

async function cargarIncidencia(id) {
  document.getElementById('detalle-loading').classList.remove('d-none');
  document.getElementById('detalle-content').classList.add('d-none');

  try {
    const resp = await http.get(`/incidents/${id}`);
    const inc = resp.data ?? resp;
    return inc;
  } catch (err) {
    console.error('Error al cargar incidencia:', err);
    document.getElementById('detalle-loading').innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Error al cargar la incidencia. <a href="#/incidencias" class="alert-link">Volver</a>
      </div>`;
    throw err;
  }
}

function renderizarIncidencia(inc) {
  const view = bindView(document);

  const fechaTexto = inc.created_at
    ? new Date(inc.created_at).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const usuarioTexto = inc.user
    ? [inc.user.first_name, inc.user.last_name].filter(Boolean).join(' ')
    : '—';

  view.set({
    // Toggle loading vs content in one shot.
    'detalle-loading': { d_none: true },
    'detalle-content': { d_none: false },

    // Plain text fields.
    'detalle-titulo': inc.title ?? 'Sin título',
    'detalle-breadcrumb': inc.title ?? 'Detalle',
    'detalle-priority': PRIORITY_LABEL[inc.priority] ?? inc.priority,
    'detalle-fecha': fechaTexto,
    'detalle-descripcion': inc.description ?? 'Sin descripción',
    'detalle-categoria': inc.category?.name ?? '—',
    'detalle-ubicacion': inc.location?.name ?? '—',
    'detalle-usuario': usuarioTexto,
    'detalle-organizacion': inc.organization?.name ?? '—',

    // Status badge: text + dynamic className based on the status.
    'detalle-status': {
      text: STATUS_LABEL[inc.status] ?? inc.status,
      className: `ig-status-badge ig-status-${inc.status}`,
    },

    // Thumbnail: shown only when the backend provides a URL.
    'detalle-thumbnail': inc.thumbnail_url
      ? {
          html: `<img src="${inc.thumbnail_url}" alt="Thumbnail" class="img-fluid rounded incid-detail__thumbnail-img" />`,
          d_none: false,
        }
      : { d_none: true },
  });

  renderMap(inc);
}

async function renderMap(inc) {
  const mapEl = document.getElementById('detalle-coords');
  if (!inc.geom?.coordinates) {
    mapEl.innerHTML =
      '<p class="text-muted text-center py-4 mb-0">Sin coordenadas</p>';
    return;
  }

  const [lng, lat] = inc.geom.coordinates;

  // Inject the canvas div BEFORE the async Leaflet load so the container
  // keeps its height and there is no blank-white flash while tiles fetch.
  mapEl.innerHTML =
    '<div id="detalle-mapa" class="incid-detail__map-canvas"></div>';

  const { map, remove } = await initMapView({
    container: 'detalle-mapa',
    center: { lat, lng },
    zoom: 15,
    liveInputs: false,
    errorClass: 'incid-detail__map-error',
  });
  if (!map) return;

  L.marker([lat, lng]).addTo(map);

  // Store map reference and disposer for cleanup
  mapEl._leaflet_map = map;
  mapEl._leaflet_dispose = remove;
}

function renderizarImagenes(images) {
  const container = document.getElementById('detalle-imagenes');
  const emptyEl = document.getElementById('detalle-sin-imagenes');

  if (!images || images.length === 0) {
    emptyEl?.classList.remove('d-none');
    return;
  }

  emptyEl?.classList.add('d-none');
  container.innerHTML = images
    .map(
      (img) => `
    <div class="mb-2 position-relative">
      <a href="${img.url}" target="_blank">
        <img src="${img.url}" alt="${img.original_name}" class="img-fluid rounded incid-detail__image" />
      </a>
      <small class="text-muted d-block text-truncate mt-1">${img.original_name}</small>
    </div>`,
    )
    .join('');
}

function setupUpload(incidentId) {
  const fileInput = document.getElementById('detalle-file-input');
  const btnSubir = document.getElementById('btn-subir-imagen');
  const progress = document.getElementById('detalle-upload-progress');

  btnSubir.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btnSubir.disabled = true;
    progress.classList.remove('d-none');

    try {
      const formData = new FormData();
      formData.append('images[]', file);

      // Upload via PATCH to the incident endpoint
      const resp = await http.request(
        'PATCH',
        `/incidents/${incidentId}`,
        formData,
      );

      fileInput.value = '';
      btnSubir.disabled = true;
      progress.classList.add('d-none');

      const toast = new bootstrap.Toast(
        document.getElementById('toast-imagen'),
        { delay: 2000 },
      );
      toast.show();

      // Refresh images from the updated incident
      const images = resp.data?.images ?? [];
      renderizarImagenes(images);
    } catch (err) {
      console.error('Error al subir imagen:', err);
      alert(
        'Error al subir la imagen. Verifique que sea JPEG, PNG o WEBP y que no supere 10 MB.',
      );
    } finally {
      btnSubir.disabled = false;
      progress.classList.add('d-none');
    }
  });
}

// ── Gestión de Estado (CP-02-01-F / 02-02-F / 02-04-F / 02-05-F) ──

function setupEstado(incidentId, inc) {
  const select = document.getElementById('detalle-estado-select');
  const btnGuardar = document.getElementById('btn-guardar-estado');
  const btnTexto = document.getElementById('btn-estado-texto');
  const btnLoading = document.getElementById('btn-estado-loading');
  const errorEl = document.getElementById('detalle-estado-error');
  const errorMsg = document.getElementById('detalle-estado-msg');
  const resolucionEl = document.getElementById('detalle-resolucion');
  const fechaResEl = document.getElementById('detalle-fecha-resolucion');

  if (!select || !btnGuardar) return;

  const currentStatus = inc.status;
  const validNext = VALID_TRANSITIONS[currentStatus] ?? [];

  // CP-02-01-F: mostrar todos los estados; CP-02-04-F: deshabilitar inválidos
  select.innerHTML = DROPDOWN_STATUSES.map(({ value, label }) => {
    const isCurrent = value === currentStatus;
    const isValid = validNext.includes(value);
    const disabled = isCurrent || !isValid;
    return `<option value="${value}"${isCurrent ? ' selected' : ''}${disabled ? ' disabled' : ''}>${label}${isCurrent ? ' (actual)' : ''}</option>`;
  }).join('');

  if (validNext.length === 0) {
    btnGuardar.disabled = true;
    select.disabled = true;
  }

  // CP-02-05-F: mostrar fecha resolución si ya está resuelto
  if (currentStatus === 'resolved' && inc.resolution_date) {
    resolucionEl.classList.remove('d-none');
    fechaResEl.textContent = new Date(inc.resolution_date).toLocaleString(
      'es-EC',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }

  // CP-02-02-F: guardar nuevo estado
  btnGuardar.addEventListener('click', async () => {
    const newStatus = select.value;
    if (!validNext.includes(newStatus)) return;

    btnTexto.classList.add('d-none');
    btnLoading.classList.remove('d-none');
    btnGuardar.disabled = true;
    errorEl.classList.add('d-none');

    try {
      const payload = { status: newStatus };
      if (newStatus === 'resolved') {
        payload.resolution_date = new Date().toISOString();
      }
      await http.put(`/incidents/${incidentId}`, payload);
      window.location.reload();
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      errorMsg.textContent = err.message || 'No se pudo cambiar el estado.';
      errorEl.classList.remove('d-none');
      btnTexto.classList.remove('d-none');
      btnLoading.classList.add('d-none');
      btnGuardar.disabled = false;
    }
  });
}

// ── Historial de estados (CP-02-03-F) ──────────────────────

/**
 * Renders the status history list from a pre-loaded array.
 * Called with the data embedded in GET /incidents/:id so no extra
 * network request is needed on initial load.
 */
function renderHistorial(items) {
  const loadingEl = document.getElementById('detalle-historial-loading');
  const listEl = document.getElementById('detalle-historial-list');
  const vacioEl = document.getElementById('detalle-historial-vacio');

  if (!loadingEl || !listEl) return;

  loadingEl.classList.add('d-none');

  if (!items || items.length === 0) {
    vacioEl.classList.remove('d-none');
    return;
  }

  // más reciente primero (DESC)
  listEl.innerHTML = [...items]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((item) => {
      const prev =
        STATUS_LABEL[item.previous_status] ?? item.previous_status ?? '—';
      const next = STATUS_LABEL[item.new_status] ?? item.new_status ?? '—';
      const user = item.user
        ? [item.user.first_name, item.user.last_name]
            .filter(Boolean)
            .join(' ')
        : 'Sistema';
      const fecha = new Date(item.created_at).toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <div class="border-start border-2 border-primary ps-3 mb-3">
          <div class="small fw-semibold">${prev} → ${next}</div>
          <div class="text-muted" style="font-size:0.75rem;">${user} · ${fecha}</div>
        </div>`;
    })
    .join('');
}

// ── Comentarios públicos ────────────────────────────────────

function buildCommentLi(comment, currentUserId, depth = 0) {
  const li = document.createElement('li');
  li.className = 'incid-detail__comment mb-2 pb-2 border-bottom';

  const userName = comment.user
    ? [comment.user.first_name, comment.user.last_name]
        .filter(Boolean)
        .join(' ') || comment.user?.email
    : 'Usuario';

  const isOwner = currentUserId != null && comment.user_id === currentUserId;

  const replyBtn = currentUserId != null
    ? `<button type="button" class="btn btn-sm btn-link text-muted p-0 ms-2 btn-respoder-comentario" data-id="${escapeHtml(String(comment.id))}" title="Responder">
        <i class="fas fa-reply"></i> Responder
      </button>`
    : '';

  const deleteBtn = isOwner
    ? `<button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-comentario" data-id="${escapeHtml(String(comment.id))}" title="Eliminar comentario">
        <i class="fas fa-trash-alt"></i>
      </button>`
    : '';

  const replyQuote = comment.parent
    ? (() => {
        const parentUser = comment.parent.user
          ? [comment.parent.user.first_name, comment.parent.user.last_name].filter(Boolean).join(' ') || comment.parent.user.email
          : 'Usuario';
        const snippet = (comment.parent.message || '').slice(0, 100);
        return `<div class="incid-detail__reply-quote"><strong>@${escapeHtml(parentUser)}:</strong> ${escapeHtml(snippet)}${(comment.parent.message || '').length > 100 ? '…' : ''}</div>`;
      })()
    : '';

  const imagesHtml = (comment.images && comment.images.length > 0)
    ? `<div class="incid-detail__thumbnail-grid mt-1 mb-1">
        ${comment.images.map(img => {
          const src = escapeHtml(getCommentImageUrl(img.url));
          const caption = escapeHtml(img.caption || img.original_name || '');
          const delBtn = isOwner
            ? `<button type="button" class="incid-detail__image-delete btn-eliminar-imagen" data-comment-id="${escapeHtml(String(comment.id))}" data-image-id="${escapeHtml(String(img.id))}" title="Eliminar imagen">&times;</button>`
            : '';
          return `<div class="incid-detail__thumbnail-wrapper">
            <img src="${src}" alt="${caption}" class="incid-detail__thumbnail" data-src="${src}" data-caption="${caption}" />
            ${delBtn}
          </div>`;
        }).join('')}
       </div>`
    : '';

  li.innerHTML = `
    <div class="d-flex justify-content-between">
      <span class="fw-semibold small">${escapeHtml(userName)}</span>
      <div class="d-flex gap-2 align-items-center">
        <small class="text-muted">${timeAgo(comment.created_at)}</small>
        ${replyBtn}
        ${deleteBtn}
      </div>
    </div>
    ${replyQuote}
    <div class="small">${escapeHtml(comment.message)}</div>
    ${imagesHtml}`;

  if (comment.replies && comment.replies.length > 0) {
    const replyDepth = depth >= 1 ? 1 : depth + 1;
    const replyUl = document.createElement('ul');
    replyUl.className = 'list-unstyled';
    if (replyDepth > 0) {
      replyUl.classList.add('incid-detail__nested');
    }
    for (const reply of comment.replies) {
      replyUl.appendChild(buildCommentLi(reply, currentUserId, replyDepth));
    }
    li.appendChild(replyUl);
  }

  return li;
}

function renderComments(items, currentUserId) {
  const listEl = document.getElementById('detalle-comments-list');
  const vacioEl = document.getElementById('detalle-comments-vacio');
  if (!listEl) return;

  if (!items || items.length === 0) {
    listEl.replaceChildren();
    vacioEl?.classList.remove('d-none');
    return;
  }

  vacioEl?.classList.add('d-none');
  listEl.replaceChildren(...items.map(c => buildCommentLi(c, currentUserId, 0)));
}

async function setupComments(incidentId) {
  const loadingEl = document.getElementById('detalle-comments-loading');
  const form = document.getElementById('detalle-comment-form');
  const input = document.getElementById('detalle-comment-input');
  const errorEl = document.getElementById('detalle-comment-error');
  const submitBtn = document.getElementById('detalle-comment-submit');
  const counterEl = document.getElementById('detalle-comment-counter');
  const listEl = document.getElementById('detalle-comments-list');
  const fileInput = document.getElementById('detalle-comment-images');
  const previewEl = document.getElementById('detalle-comment-previews');
  const replyBadgeEl = document.getElementById('detalle-reply-badge');
  const replyParentIdEl = document.getElementById('detalle-reply-parent-id');

  if (!form || !input) return;

  let currentUserId = null;

  const replyState = { parentId: null, parentComment: null };
  const selectedFiles = [];
  const previewUrls = [];

  function updateCounter() {
    const len = input.value.length;
    if (counterEl) {
      counterEl.textContent = `${len}/5000`;
      counterEl.classList.toggle('text-danger', len >= 4000);
    }
  }

  function updateSubmitBtn() {
    if (submitBtn) submitBtn.disabled = input.value.trim() === '';
  }

  function renderPreviews() {
    if (!previewEl) return;
    previewEl.innerHTML = selectedFiles
      .map((_, i) => {
        const url = previewUrls[i];
        if (!url) return '';
        return `<div class="position-relative d-inline-block" style="margin-bottom:4px">
          <img src="${url}" class="incid-detail__preview-thumb" alt="Preview" />
          <button type="button" class="incid-detail__preview-remove btn-quitar-preview" data-index="${i}">&times;</button>
        </div>`;
      })
      .join('');
  }

  function handleReply(comment) {
    const parentUser = comment.user
      ? [comment.user.first_name, comment.user.last_name].filter(Boolean).join(' ') || comment.user.email
      : 'Usuario';
    const prefix = `> @${parentUser}: `;
    const current = input.value;
    if (!current.startsWith(prefix)) {
      input.value = prefix + current;
    }
    if (replyBadgeEl) {
      replyBadgeEl.textContent = `Respondiendo a @${parentUser}`;
      replyBadgeEl.classList.remove('d-none');
    }
    if (replyParentIdEl) replyParentIdEl.value = String(comment.id);
    replyState.parentId = comment.id;
    replyState.parentComment = comment;
    updateSubmitBtn();
  }

  function cancelReply() {
    const prefix = '> @';
    if (input.value.startsWith(prefix)) {
      const nlIdx = input.value.indexOf('\n');
      input.value = nlIdx >= 0 ? input.value.slice(nlIdx + 1) : '';
    }
    if (replyBadgeEl) replyBadgeEl.classList.add('d-none');
    if (replyParentIdEl) replyParentIdEl.value = '';
    replyState.parentId = null;
    replyState.parentComment = null;
    updateSubmitBtn();
  }

  function handleFileSelect(files) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      selectedFiles.push(file);
      previewUrls.push(URL.createObjectURL(file));
    }
    renderPreviews();
  }

  function removeFile(index) {
    if (index < 0 || index >= previewUrls.length) return;
    URL.revokeObjectURL(previewUrls[index]);
    previewUrls.splice(index, 1);
    selectedFiles.splice(index, 1);
    renderPreviews();
  }

  input.addEventListener('input', () => {
    updateCounter();
    updateSubmitBtn();
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      handleFileSelect(fileInput.files);
      fileInput.value = '';
    });
  }

  if (replyBadgeEl) {
    replyBadgeEl.addEventListener('click', cancelReply);
    replyBadgeEl.style.cursor = 'pointer';
    replyBadgeEl.title = 'Clic para cancelar';
  }

  async function cargarComentarios() {
    loadingEl?.classList.remove('d-none');
    try {
      const { data } = await commentService.list(incidentId, { perPage: 50 });
      renderComments(data, currentUserId);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    } finally {
      loadingEl?.classList.add('d-none');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl?.classList.add('d-none');

    const message = input.value.trim();
    if (!message) {
      if (errorEl) {
        errorEl.textContent = 'El comentario no puede estar vacío.';
        errorEl.classList.remove('d-none');
      }
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const parentId = replyParentIdEl?.value ? Number(replyParentIdEl.value) : null;
      let imageIds = [];

      if (selectedFiles.length > 0) {
        const created = await commentService.create(incidentId, { message, parentId, imageIds: [] });
        const commentId = created?.id ?? created?.data?.id;
        if (!commentId) throw new Error('No se pudo crear el comentario.');

        const results = await Promise.allSettled(
          selectedFiles.map(file => commentService.uploadImages(commentId, [file]))
        );
        const failed = results.filter(r => r.status === 'rejected' || r.status === 'fulfilled' && r.value?.status >= 400);
        if (failed.length > 0) {
          for (const url of previewUrls) URL.revokeObjectURL(url);
          selectedFiles.length = 0;
          previewUrls.length = 0;
          renderPreviews();
          if (errorEl) {
            errorEl.textContent = 'Error al subir una o más imágenes. El comentario no fue publicado.';
            errorEl.classList.remove('d-none');
          }
          await commentService.delete(commentId);
          throw new Error('Upload failed');
        }
      } else {
        await commentService.create(incidentId, { message, parentId, imageIds });
      }

      input.value = '';
      for (const url of previewUrls) URL.revokeObjectURL(url);
      selectedFiles.length = 0;
      previewUrls.length = 0;
      renderPreviews();
      cancelReply();
      updateCounter();
      updateSubmitBtn();
      await cargarComentarios();
    } catch (err) {
      if (err.message === 'Upload failed') return;
      if (errorEl) {
        errorEl.textContent = err.message || 'No se pudo publicar el comentario.';
        errorEl.classList.remove('d-none');
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.btn-eliminar-comentario');
      if (deleteBtn) {
        const commentId = deleteBtn.dataset.id;
        if (!commentId) return;
        if (!confirm('¿Eliminar este comentario?')) return;
        deleteBtn.disabled = true;
        try {
          await commentService.delete(commentId);
          await cargarComentarios();
        } catch (err) {
          console.error('Error al eliminar comentario:', err);
          alert('No se pudo eliminar el comentario.');
        } finally {
          deleteBtn.disabled = false;
        }
        return;
      }

      const replyBtn = e.target.closest('.btn-respoder-comentario');
      if (replyBtn) {
        const commentId = Number(replyBtn.dataset.id);
        const listItems = listEl.querySelectorAll(':scope > li');
        const found = findCommentById(listItems, commentId);
        if (found) handleReply(found);
        return;
      }

      const previewRemoveBtn = e.target.closest('.btn-quitar-preview');
      if (previewRemoveBtn) {
        const index = Number(previewRemoveBtn.dataset.index);
        removeFile(index);
        return;
      }

      const thumb = e.target.closest('.incid-detail__thumbnail[data-src]');
      if (thumb) {
        const src = thumb.dataset.src;
        const caption = thumb.dataset.caption || '';
        openLightbox(src, caption);
        return;
      }

      const delImgBtn = e.target.closest('.btn-eliminar-imagen');
      if (delImgBtn) {
        const commentId = Number(delImgBtn.dataset.commentId);
        const imageId = Number(delImgBtn.dataset.imageId);
        if (!confirm('¿Eliminar esta imagen?')) return;
        delImgBtn.disabled = true;
        try {
          await commentService.deleteImage(commentId, imageId);
          await cargarComentarios();
        } catch (err) {
          console.error('Error al eliminar imagen:', err);
          alert('No se pudo eliminar la imagen.');
        } finally {
          delImgBtn.disabled = false;
        }
      }
    });
  }

  const lightboxEl = document.getElementById('incid-detail__lightbox');
  const lightboxImg = document.getElementById('incid-detail__lightbox-img');
  const lightboxCaption = document.getElementById('incid-detail__lightbox-caption');
  const lightboxClose = document.getElementById('incid-detail__lightbox-close');

  if (lightboxEl) {
    lightboxClose?.addEventListener('click', closeLightbox);
    lightboxEl.addEventListener('click', (e) => {
      if (e.target === lightboxEl) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !lightboxEl.classList.contains('d-none')) {
        closeLightbox();
      }
    });
  }

  try {
    const user = await auth.me();
    currentUserId = user?.id;
  } catch {
    currentUserId = null;
  }

  cargarComentarios();
}

function findCommentById(listItems, id) {
  for (const li of listItems) {
    const commentId = li.querySelector('.btn-respoder-comentario, .btn-eliminar-comentario')?.dataset?.id;
    if (commentId && Number(commentId) === id) {
      const nameEl = li.querySelector('.fw-semibold');
      const name = nameEl?.textContent?.trim() || 'Usuario';
      const messageEl = li.querySelector('.small');
      const message = messageEl ? messageEl.textContent : '';
      const user = { first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' '), email: null };
      return { id: Number(commentId), message, user };
    }
  }
  return null;
}

// ── Asignaciones de operadores (responsable/apoyo) ─────────

const ASSIGNMENT_ROLE_BADGE = {
  responsable: '<span class="badge bg-primary">Responsable</span>',
  apoyo: '<span class="badge bg-secondary">Apoyo</span>',
};

// Matches the default placeholder text in incidencias.detail.component.html
// (#detalle-asignaciones-vacio) — used to restore the empty-state message
// after a previous error render had overwritten it (see R4-003).
const ASSIGNMENTS_VACIO_TEXT = 'Sin operadores asignados.';

function buildAssignmentRow(assignment, canDelete) {
  const nombre = assignment.user
    ? [assignment.user.first_name, assignment.user.last_name]
        .filter(Boolean)
        .join(' ') || assignment.user.email
    : 'Usuario';
  // role/id are enum/int-constrained server-side today, but escaped here
  // for defense-in-depth consistency with `nombre` above.
  const badge =
    ASSIGNMENT_ROLE_BADGE[assignment.role] ??
    escapeHtml(String(assignment.role ?? ''));
  const btn = canDelete
    ? `<button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-asignacion" data-id="${escapeHtml(String(assignment.id))}" title="Quitar asignación">
        <i class="fas fa-times"></i>
      </button>`
    : '';

  return `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div>
        <div class="small fw-semibold">${escapeHtml(nombre)}</div>
        <div>${badge}</div>
      </div>
      ${btn}
    </div>`;
}

/**
 * Renders the assignment list into #detalle-asignaciones-list, toggling
 * the empty-state placeholder as needed. Mirrors the fetch-function →
 * render-function split used for comments (buildCommentLi/renderComments)
 * so rendering can be tested independently of the network call.
 */
function renderAssignments(items, puedeEliminar) {
  const listEl = document.getElementById('detalle-asignaciones-list');
  const vacioEl = document.getElementById('detalle-asignaciones-vacio');
  if (!listEl) return;

  if (!items || items.length === 0) {
    listEl.innerHTML = '';
    if (vacioEl) {
      vacioEl.textContent = ASSIGNMENTS_VACIO_TEXT;
      vacioEl.classList.remove('d-none');
    }
    return;
  }

  vacioEl?.classList.add('d-none');
  listEl.innerHTML = items
    .map((a) => buildAssignmentRow(a, puedeEliminar))
    .join('');
}

/**
 * Populates the operator <select> by calling the dedicated endpoint
 * GET /incidents/:id/available-operators.
 *
 * The backend resolves the operador_organizacion role internally and
 * filters by the incident's organization, so the frontend no longer
 * needs two sequential requests (GET /roles → GET /users).
 */
async function cargarOperadores(inc, selectEl, submitBtn) {
  if (!selectEl) return;

  const setAvailability = (available) => {
    selectEl.disabled = !available;
    if (submitBtn) submitBtn.disabled = !available;
  };

  if (!inc.organization_id && !inc.organization?.id) {
    selectEl.innerHTML = '<option value="">Sin organización asignada</option>';
    setAvailability(false);
    return;
  }

  setAvailability(false);

  try {
    const resp = await http.get(`/incidents/${inc.id}/available-operators`);
    const usuarios = resp.data ?? [];

    if (usuarios.length === 0) {
      selectEl.innerHTML = '<option value="">Sin operadores disponibles</option>';
      return;
    }

    selectEl.innerHTML = usuarios
      .map((u) => {
        const nombre =
          [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
        return `<option value="${u.id}">${escapeHtml(nombre)}</option>`;
      })
      .join('');
    setAvailability(true);
  } catch (err) {
    console.error('Error al cargar operadores:', err);
    selectEl.innerHTML = '<option value="">Error al cargar operadores</option>';
  }
}

async function setupAssignments(incidentId, inc, initialAssignments = null) {
  const cardEl = document.getElementById('detalle-asignaciones-card');
  const loadingEl = document.getElementById('detalle-asignaciones-loading');
  const listEl = document.getElementById('detalle-asignaciones-list');
  const vacioEl = document.getElementById('detalle-asignaciones-vacio');
  const formEl = document.getElementById('detalle-asignaciones-form');
  const selectEl = document.getElementById('detalle-asignaciones-select');
  const errorEl = document.getElementById('detalle-asignaciones-error');
  const errorMsgEl = document.getElementById('detalle-asignaciones-msg');
  const submitBtn = document.getElementById('detalle-asignaciones-submit');

  if (!cardEl || !listEl) return;

  function showError(msg) {
    if (errorMsgEl) errorMsgEl.textContent = msg;
    errorEl?.classList.remove('d-none');
  }

  let permisos;
  try {
    permisos = await permissionService.getMyPermissions();
  } catch {
    permisos = new Set();
  }
  const puedeCrear = permisos.has('assignments.create');
  const puedeEliminar = permisos.has('assignments.delete');

  // Fetch-from-network used for post-mutation refreshes.
  async function cargarAsignaciones() {
    try {
      const { data } = await assignmentService.list(incidentId);
      loadingEl?.classList.add('d-none');
      renderAssignments(data, puedeEliminar);
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      loadingEl?.classList.add('d-none');
      listEl.innerHTML = '';
      if (vacioEl) {
        vacioEl.textContent = 'Error al cargar asignaciones.';
        vacioEl.classList.remove('d-none');
      }
    }
  }

  if (puedeEliminar) {
    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-eliminar-asignacion');
      if (!btn) return;

      const assignmentId = btn.dataset.id;
      btn.disabled = true;
      errorEl?.classList.add('d-none');

      try {
        await assignmentService.remove(incidentId, assignmentId);
        await cargarAsignaciones();
      } catch (err) {
        showError(err.message || 'No se pudo eliminar la asignación.');
        btn.disabled = false;
      }
    });
  }

  if (puedeCrear && formEl) {
    formEl.classList.remove('d-none');
    cargarOperadores(inc, selectEl, submitBtn);

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn?.disabled) return;
      errorEl?.classList.add('d-none');

      const userId = selectEl?.value;
      const role = formEl.querySelector(
        'input[name="asignacion-rol"]:checked',
      )?.value;
      if (!userId || !role) {
        showError('Seleccione un operador y un rol.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        await assignmentService.create(incidentId, Number(userId), role);
        await cargarAsignaciones();
      } catch (err) {
        showError(err.message || 'No se pudo crear la asignación.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Initial render — use embedded data if available, otherwise fetch.
  if (initialAssignments !== null) {
    loadingEl?.classList.add('d-none');
    renderAssignments(initialAssignments, puedeEliminar);
  } else {
    await cargarAsignaciones();
  }
}

// ── Claim / Release / Confirmar ────────────────────────────

function resolveRoleName(user) {
  if (!user?.role) return null;
  if (typeof user.role === 'string') return user.role;
  if (typeof user.role === 'object' && user.role?.name) return user.role.name;
  return null;
}

/**
 * Muestra/oculta botones de acción según el rol del usuario y el estado de la incidencia.
 */
function setupActionButtons(incidentId, inc) {
  const user = auth.getUser();
  if (!user) return;

  const roleName = resolveRoleName(user);
  if (!roleName) return;

  const actionsEl = document.getElementById('detalle-acciones');
  const claimActionsEl = document.getElementById('detalle-claim-actions');
  const confirmActionsEl = document.getElementById('detalle-confirm-actions');
  const loadingEl = document.getElementById('detalle-acciones-loading');
  const errorEl = document.getElementById('detalle-acciones-error');
  const errorMsgEl = document.getElementById('detalle-acciones-msg');
  const btnReclamar = document.getElementById('btn-reclamar');
  const btnLiberar = document.getElementById('btn-liberar');
  const btnConfirmar = document.getElementById('btn-confirmar');

  if (!actionsEl) return;

  function showError(msg) {
    if (errorMsgEl) errorMsgEl.textContent = msg;
    if (errorEl) errorEl.classList.remove('d-none');
    setTimeout(() => errorEl?.classList.add('d-none'), 5000);
  }

  function setLoading(on) {
    if (loadingEl) loadingEl.classList.toggle('d-none', !on);
    if (btnReclamar) btnReclamar.disabled = on;
    if (btnLiberar) btnLiberar.disabled = on;
    if (btnConfirmar) btnConfirmar.disabled = on;
  }

  // ── OperadorOrganizacion: Claim / Release ──
  if (roleName === 'operador_organizacion') {
    const userOrgId = user.organization?.id;
    const incOrgId = inc.organization?.id || inc.organization_id;

    // Solo si la incidencia pertenece a su org
    if (userOrgId && incOrgId && userOrgId === incOrgId) {
      actionsEl.classList.remove('d-none');

      if (!inc.claimed_by) {
        // Sin asignar → mostrar "Reclamar"
        claimActionsEl.classList.remove('d-none');
        btnLiberar?.classList.add('d-none');

        btnReclamar?.addEventListener('click', async () => {
          setLoading(true);
          try {
            await http.post(`/incidents/${incidentId}/claim`);
            window.location.reload();
          } catch (err) {
            showError(err.message || 'No se pudo reclamar la incidencia.');
          } finally {
            setLoading(false);
          }
        });
      } else if (inc.claimed_by === user.id) {
        // Asignada a mí → mostrar "Liberar"
        claimActionsEl.classList.remove('d-none');
        btnReclamar?.classList.add('d-none');

        btnLiberar?.addEventListener('click', async () => {
          setLoading(true);
          try {
            await http.post(`/incidents/${incidentId}/release`);
            window.location.reload();
          } catch (err) {
            showError(err.message || 'No se pudo liberar la incidencia.');
          } finally {
            setLoading(false);
          }
        });
      }
    }
  }

  // ── Publicador: Confirmar ──
  if (roleName === 'publicador') {
    const incOrgId = inc.organization?.id || inc.organization_id;

    // Solo si la incidencia NO tiene organización asignada
    if (!incOrgId) {
      actionsEl.classList.remove('d-none');
      confirmActionsEl.classList.remove('d-none');

      btnConfirmar?.addEventListener('click', async () => {
        setLoading(true);
        try {
          await http.post(`/incidents/${incidentId}/confirmar`);
          window.location.reload();
        } catch (err) {
          showError(
            err.message ||
              'No se pudo confirmar la incidencia. Puede que ya haya sido asignada.',
          );
        } finally {
          setLoading(false);
        }
      });
    }
  }
}

// ── Buscar Responsables (CP-03-01-F) ────────────────────────────

function setupBuscarResponsables(incidentId) {
  const inputEl = document.getElementById('buscar-responsables-input');
  const loadingEl = document.getElementById('buscar-responsables-loading');
  const resultsEl = document.getElementById('buscar-responsables-results');
  const listEl = document.getElementById('buscar-responsables-list');
  const vacioEl = document.getElementById('buscar-responsables-vacio');
  const errorEl = document.getElementById('buscar-responsables-error');
  const errorMsgEl = document.getElementById('buscar-responsables-error-msg');
  const operatorSelectEl = document.getElementById('detalle-asignaciones-select');
  const formEl = document.getElementById('detalle-asignaciones-form');

  if (!inputEl) return;

  function showLoading(show) {
    if (show) {
      loadingEl?.classList.remove('d-none');
      resultsEl?.classList.add('d-none');
      vacioEl?.classList.add('d-none');
      errorEl?.classList.add('d-none');
    } else {
      loadingEl?.classList.add('d-none');
    }
  }

  function showResults(users) {
    if (!users || users.length === 0) {
      resultsEl?.classList.add('d-none');
      vacioEl?.classList.remove('d-none');
      return;
    }

    resultsEl?.classList.remove('d-none');
    vacioEl?.classList.add('d-none');

    listEl.replaceChildren(
      ...users.map((user) => {
        const li = document.createElement('li');
        li.className =
          'mb-2 p-2 border rounded cursor-pointer hover:bg-light';
        li.style.cursor = 'pointer';

        const name = responsablesService.formatUserName(user);
        const role = responsablesService.formatRole(user);
        const email = user.email || '';

        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold text-dark">${escapeHtml(name)}</div>
              <small class="text-muted">${escapeHtml(email)}</small>
              <br />
              <small class="text-secondary">Rol: ${escapeHtml(role)}</small>
            </div>
          </div>
        `;

        li.addEventListener('mouseenter', () => {
          li.classList.add('bg-light');
        });
        li.addEventListener('mouseleave', () => {
          li.classList.remove('bg-light');
        });

        li.addEventListener('click', () => {
          // CP-03-02-F: seleccionar usuario en búsqueda → llenar operador
          if (operatorSelectEl && user.id) {
            operatorSelectEl.value = user.id;
            if (formEl) {
              formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            inputEl.value = '';
            showLoading(false);
            resultsEl?.classList.add('d-none');
            vacioEl?.classList.add('d-none');
            errorEl?.classList.add('d-none');
          }
        });

        return li;
      })
    );
  }

  function showError(msg) {
    errorMsgEl.textContent = msg;
    errorEl?.classList.remove('d-none');
    resultsEl?.classList.add('d-none');
    vacioEl?.classList.add('d-none');
  }

  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length === 0) {
      showLoading(false);
      resultsEl?.classList.add('d-none');
      vacioEl?.classList.add('d-none');
      errorEl?.classList.add('d-none');
      return;
    }

    showLoading(true);

    responsablesService.search(query, (users, err) => {
      showLoading(false);

      if (err) {
        showError(err.message || 'Error al buscar usuarios.');
        return;
      }

      showResults(users);
    });
  });
}
