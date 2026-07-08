/**
 * Feed Detail Component — shows full incident details for /incidencias/:id.
 *
 * Fetches incident by ID from GET /incidents/{id}, renders full details
 * with Leaflet map (reusing feed-create patterns), comments section,
 * and back button to feed.
 *
 * Uses router.routeParams.id from the param-matching router.
 */
import {
  escapeHtml,
  timeAgo,
  STATUS_LABEL,
  PRIORITY_LABEL,
} from '../../../utils/format.js';
import { getInitials, getUserDisplayName } from '../../../utils/avatar.js';
import { router } from '../../../core/router.js';
import { http } from '../../../core/http.service.js';
import initMapView from '../../../shared/init-map-view.js';
import { commentService } from '../../../shared/comment.service.js';

// ── Detect context: admin vs citizen ──
//
// The role is passed in via onInit({ role }) by the router. This keeps
// the component decoupled from router internals — it doesn't even need
// to import the router. If the role is missing (legacy call site), we
// default to citizen since /feed is the citizen-facing route.
function getFeedUrl(role) {
  return role === 'admin' ? '/incidencias/feed' : '/feed';
}

// ── Component ───────────────────────────────────────────────

export default {
  templateUrl: 'app/feed/pages/detail/feed-detail.component.html',
  styleUrl: 'app/feed/pages/detail/feed-detail.component.css',

  async onInit({ params, role } = {}) {
    const detailEl = document.getElementById('fd-detail');
    const loadingEl = document.getElementById('fd-loading');
    const emptyEl = document.getElementById('fd-empty');
    const errorEl = document.getElementById('fd-error');

    const incidentId = params?.id;
    const feedUrl = getFeedUrl(role);

    // Fix back-to-feed links based on context
    document.querySelectorAll('.fd-back-feed').forEach((link) => {
      link.setAttribute('href', `#${feedUrl}`);
    });

    if (!incidentId) {
      if (loadingEl) loadingEl.classList.add('d-none');
      if (emptyEl) emptyEl.classList.remove('d-none');
      return;
    }

    try {
      const resp = await http.get(`/incidents/${incidentId}`);
      const inc = resp.data || resp;

      // Populate header
      this._renderHeader(inc);

      // Populate body
      this._renderBody(inc);

      // Load and render Leaflet map
      await this._renderMap(inc);

      // Comments — public, visible/postable by both citizens and operators
      this._setupComments(incidentId);

      // Show detail, hide loading
      if (loadingEl) loadingEl.classList.add('d-none');
      if (detailEl) detailEl.classList.remove('d-none');
    } catch (err) {
      if (loadingEl) loadingEl.classList.add('d-none');
      if (err.status === 404 || err.status === 422) {
        if (emptyEl) emptyEl.classList.remove('d-none');
      } else {
        if (errorEl) errorEl.classList.remove('d-none');
      }
    }
  },

  _renderHeader(inc) {
    const userName = getUserDisplayName(inc.user || inc.reporter);
    const initials = getInitials(inc.user || inc.reporter);
    const statusLabel = STATUS_LABEL[inc.status] ?? inc.status;
    const priorityLabel = PRIORITY_LABEL[inc.priority] ?? inc.priority;
    const tiempo = timeAgo(inc.created_at);

    const el = document.getElementById('fd-header-content');
    if (!el) return;

    el.innerHTML = `
      <div class="fd-header-top">
        <div class="fd-back-link" id="fd-back-btn">
          <i class="fas fa-arrow-left"></i> Volver
        </div>
        <span class="feed-status-badge feed-status-${inc.status}">${statusLabel}</span>
        <span class="feed-priority-badge feed-priority-${inc.priority}">${priorityLabel}</span>
      </div>
      <div class="fd-header-user">
        <div class="fd-avatar">${escapeHtml(initials)}</div>
        <div class="fd-user-info">
          <span class="fd-user-name">${escapeHtml(userName)}</span>
          <span class="fd-user-time">${tiempo}</span>
        </div>
        <span class="fd-id">INC-${String(inc.id).padStart(4, '0')}</span>
      </div>
      <h1 class="fd-title">${escapeHtml(inc.title || 'Sin título')}</h1>
    `;

    // Back button — navigate to the correct feed URL
    const backBtn = document.getElementById('fd-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        router.navigate(getFeedUrl(role));
      });
    }
  },

  _renderBody(inc) {
    const catName = inc.category?.name || inc.incident_category_name || '';
    const locName = inc.location_name || inc.location?.name || '';
    const coords =
      inc.geom?.type === 'Point' && Array.isArray(inc.geom?.coordinates)
        ? `${inc.geom.coordinates[1].toFixed(4)}, ${inc.geom.coordinates[0].toFixed(4)}`
        : '';

    // Description
    const descEl = document.getElementById('fd-description');
    if (descEl) {
      descEl.textContent = inc.description || 'Sin descripción';
    }

    // Meta details
    const metaEl = document.getElementById('fd-meta');
    if (metaEl) {
      metaEl.innerHTML = `
        <div class="fd-meta-item"><span class="fd-meta-label">Categoría</span><span class="fd-meta-value">${escapeHtml(catName)}</span></div>
        <div class="fd-meta-item"><span class="fd-meta-label">Ubicación</span><span class="fd-meta-value">${escapeHtml(locName) || 'No especificada'}</span></div>
        <div class="fd-meta-item"><span class="fd-meta-label">Coordenadas</span><span class="fd-meta-value">${escapeHtml(coords) || 'No disponibles'}</span></div>
        <div class="fd-meta-item"><span class="fd-meta-label">Estado</span><span class="fd-meta-value feed-status-badge feed-status-${inc.status}">${STATUS_LABEL[inc.status] ?? inc.status}</span></div>
      `;
    }

    // Store coordinates for map
    if (inc.geom?.type === 'Point' && Array.isArray(inc.geom?.coordinates)) {
      const [lng, lat] = inc.geom.coordinates;
      this._mapCoords = { lat, lng };
    }
  },

  async _renderMap(_inc) {
    if (!this._mapCoords) return;

    const { lat, lng } = this._mapCoords;
    const { map, remove } = await initMapView({
      container: 'fd-map',
      center: { lat, lng },
      zoom: 15,
      errorClass: 'fd-map-error',
    });
    if (!map) return;

    L.marker([lat, lng]).addTo(map);

    // Store map reference for cleanup
    this._detailMap = map;
    this._detailMapRemove = remove;
  },

  _buildCommentLi(comment) {
    const li = document.createElement('li');
    li.className = 'fd-comment';

    const userName = comment.user
      ? getUserDisplayName(comment.user)
      : 'Usuario';

    li.innerHTML = `
      <div class="fd-comment-header">
        <span class="fd-comment-author">${escapeHtml(userName)}</span>
        <span class="fd-comment-time">${timeAgo(comment.created_at)}</span>
      </div>
      <p class="fd-comment-message">${escapeHtml(comment.message)}</p>`;

    return li;
  },

  _renderComments(items) {
    const listEl = document.getElementById('fd-comments-list');
    const emptyEl = document.getElementById('fd-comments-empty');
    if (!listEl) return;

    if (!items || items.length === 0) {
      listEl.replaceChildren();
      emptyEl?.classList.remove('d-none');
      return;
    }

    emptyEl?.classList.add('d-none');
    listEl.replaceChildren(...items.map((c) => this._buildCommentLi(c)));
  },

  /**
   * Comments are public — both citizens and operators can view and post
   * them on the same `/incidents/{id}/comments` endpoint (R: "Public
   * Comments on Detail View").
   */
  _setupComments(incidentId) {
    const loadingEl = document.getElementById('fd-comments-loading');
    const form = document.getElementById('fd-comment-form');
    const input = document.getElementById('fd-comment-input');
    const errorEl = document.getElementById('fd-comment-error');
    const submitBtn = document.getElementById('fd-comment-submit');

    if (!form || !input) return;

    const cargarComentarios = async () => {
      loadingEl?.classList.remove('d-none');
      try {
        const { data } = await commentService.list(incidentId, {
          perPage: 50,
        });
        this._renderComments(data);
      } catch (err) {
        console.error('Error al cargar comentarios:', err);
      } finally {
        loadingEl?.classList.add('d-none');
      }
    };

    cargarComentarios();

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
        await commentService.create(incidentId, message);
        input.value = '';
        await cargarComentarios();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent =
            err.message || 'No se pudo publicar el comentario.';
          errorEl.classList.remove('d-none');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  },

  onDestroy() {
    // Cleanup Leaflet map via the helper's returned disposer
    if (this._detailMapRemove) {
      this._detailMapRemove();
      this._detailMapRemove = null;
      this._detailMap = null;
    }
  },

  template: `
    <div id="fd-loading" class="fd-loading">
      <div class="fd-spinner"></div>
      <p>Cargando incidencia...</p>
    </div>

    <div id="fd-empty" class="fd-empty d-none">
      <div class="fd-empty-icon">🔍</div>
      <h2>Incidencia no encontrada</h2>
      <p>La incidencia que buscas no existe o fue eliminada.</p>
      <a href="#" class="fd-back-link-btn fd-back-feed"
        ><i class="fas fa-arrow-left"></i> Volver al feed</a
      >
    </div>

    <div id="fd-error" class="fd-empty d-none">
      <div class="fd-empty-icon">⚠️</div>
      <h2>Error al cargar</h2>
      <p>No se pudo cargar la incidencia. Intente de nuevo más tarde.</p>
      <a href="#" class="fd-back-link-btn fd-back-feed"
        ><i class="fas fa-arrow-left"></i> Volver al feed</a
      >
    </div>

    <div id="fd-detail" class="fd-detail d-none">
      <!-- Header -->
      <div class="fd-header" id="fd-header-content"></div>

      <!-- Meta information -->
      <div class="fd-section">
        <div class="fd-meta-grid" id="fd-meta"></div>
      </div>

      <!-- Description -->
      <div class="fd-section">
        <h3 class="fd-section-title">Descripción</h3>
        <p class="fd-description" id="fd-description"></p>
      </div>

      <!-- Map -->
      <div class="fd-section">
        <h3 class="fd-section-title">Ubicación</h3>
        <div
          class="feed-detail__map-region"
          role="region"
          aria-label="Mapa de ubicación de la incidencia"
        >
          <div id="fd-map" class="fd-map-container feed-detail__map-canvas"></div>
          <div class="feed-detail__map-coords visually-hidden">
            <div class="feed-detail__map-field">
              <label for="lat">Latitud</label>
              <input id="lat" name="lat" type="text" readonly aria-live="off" />
            </div>
            <div class="feed-detail__map-field">
              <label for="lng">Longitud</label>
              <input id="lng" name="lng" type="text" readonly aria-live="off" />
            </div>
          </div>
          <div
            class="feed-detail__map-status visually-hidden"
            id="map-status"
            aria-live="polite"
          ></div>
        </div>
      </div>

      <!-- Comments -->
      <div class="fd-section">
        <h3 class="fd-section-title">Comentarios</h3>
        <form id="fd-comment-form" class="fd-comment-form">
          <textarea
            id="fd-comment-input"
            class="fd-comment-input"
            rows="2"
            maxlength="5000"
            placeholder="Escribe un comentario público..."
          ></textarea>
          <div id="fd-comment-error" class="fd-comment-error d-none"></div>
          <button
            type="submit"
            id="fd-comment-submit"
            class="fd-comment-submit"
          >
            Publicar
          </button>
        </form>
        <div id="fd-comments-loading" class="fd-comments-loading">
          <div class="fd-spinner fd-spinner--sm"></div>
        </div>
        <ul id="fd-comments-list" class="fd-comments-list"></ul>
        <p id="fd-comments-empty" class="fd-comments-empty d-none">
          Sin comentarios todavía.
        </p>
      </div>
    </div>
  `,
};
