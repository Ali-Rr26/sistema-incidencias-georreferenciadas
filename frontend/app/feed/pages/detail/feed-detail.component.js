/**
 * Feed Detail Component — shows full incident details for /incidencias/:id.
 *
 * Fetches incident by ID from GET /incidents/{id}, renders full details
 * with Leaflet map (reusing feed-create patterns), comments section,
 * and back button to feed.
 *
 * Uses router.routeParams.id from the param-matching router.
 */
import { defineComponent } from '../../../utils/component.js';
import {
  escapeHtml,
  timeAgo,
  STATUS_LABEL,
  PRIORITY_LABEL,
} from '../../../utils/format.js';
import {
  getInitials,
  getUserDisplayName,
} from '../../../utils/avatar.js';
import { router } from '../../../core/router.js';
import { http } from '../../../core/http.service.js';
import loadLeaflet from '../../../shared/leaflet.js';

// ── Detect context: admin shell vs citizen layout ──

function isAdminContext() {
  const wrapper = document.getElementById('main-wrapper');
  return wrapper && wrapper.style.display !== 'none';
}

function getFeedUrl() {
  return isAdminContext() ? '/incidencias/feed' : '/feed';
}

// ── Component ───────────────────────────────────────────────

export default defineComponent({
  templateUrl: 'app/feed/pages/detail/feed-detail.component.html',
  styleUrl: 'app/feed/pages/detail/feed-detail.component.css',

  async onInit() {
    const detailEl = document.getElementById('fd-detail');
    const loadingEl = document.getElementById('fd-loading');
    const emptyEl = document.getElementById('fd-empty');
    const errorEl = document.getElementById('fd-error');

    const incidentId = router.routeParams?.id;
    const feedUrl = getFeedUrl();

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
        router.navigate(getFeedUrl());
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
    const mapEl = document.getElementById('fd-map');
    if (!mapEl || !this._mapCoords) return;

    try {
      await loadLeaflet();
    } catch {
      mapEl.innerHTML =
        '<div class="fd-map-error">No se pudo cargar el mapa</div>';
      return;
    }

    const { lat, lng } = this._mapCoords;
    const map = L.map('fd-map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.marker([lat, lng]).addTo(map);

    // Invalidate size after mount
    setTimeout(() => map.invalidateSize(), 150);

    // Store map reference for cleanup
    this._detailMap = map;
  },

  onDestroy() {
    // Cleanup Leaflet map
    if (this._detailMap) {
      this._detailMap.remove();
      this._detailMap = null;
    }
  },
});
