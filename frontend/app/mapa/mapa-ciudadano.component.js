import {
  STATUS_LABEL,
  PRIORITY_LABEL,
  timeAgo,
  escapeHtml,
} from '../utils/format.js';
import initMapView from '../shared/init-map-view.js';
import { mapaCiudadanoService } from './mapa-ciudadano.service.js';

// STATUS_COLOR / PRIORITY_COLOR duplicated verbatim from mapa.component.js
// (lines 13-24) — keeping them in sync rather than extracting to a shared
// module keeps the citizen view self-contained. If the backend grows a new
// status/priority key, BOTH maps must be updated.
const STATUS_COLOR = {
  pending: 'secondary',
  in_progress: 'primary',
  resolved: 'success',
  pending_operator: 'warning',
};

const PRIORITY_COLOR = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
};

// SRI hashes (sha384) for each unpkg asset. Pinned to leaflet.markercluster
// 1.5.3 — re-verify if the version is bumped. Failure semantics: a hash
// mismatch fires `script.onerror` (and the browser fails the CSS load),
// which the existing fallback path below already handles — fail-closed.
const MARKERCLUSTER_CSS = [
  {
    href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    integrity:
      'sha384-pmjIAcz2bAn0xukfxADbZIb3t8oRT9Sv0rvO+BR5Csr6Dhqq+nZs59P0pPKQJkEV',
  },
  {
    href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    integrity:
      'sha384-wgw+aLYNQ7dlhK47ZPK7FRACiq7ROZwgFNg0m04avm4CaXS+Z9Y7nMu8yNjBKYC+',
  },
];
const MARKERCLUSTER_JS = {
  src: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  integrity:
    'sha384-eXVCORTRlv4FUUgS/xmOyr66XBVraen8ATNLMESp92FKXLAMiKkerixTiBvXriZr',
};

export default {
  template: `
    <div class="mpc-layout">
      <div id="mpc-loading" class="mpc-loading d-none">
        <div class="spinner-border text-light"></div>
        <span class="ms-2 text-light">Cargando mapa...</span>
      </div>

      <div
        id="mpc-error"
        class="alert alert-danger mpc-error d-none"
        role="alert"
      ></div>

      <aside class="mpc-sidebar">
        <h5 class="mpc-sidebar-title">
          <i class="fas fa-map-location-dot me-2"></i>Mapa de incidencias
        </h5>
        <p class="text-muted small mpc-help">
          Vista pública de las incidencias reportadas en la plataforma. Haz clic en
          un marcador para ver más detalles.
        </p>

        <button
          id="mpc-refresh"
          type="button"
          class="btn btn-sm btn-outline-secondary w-100 mt-2"
        >
          <i class="fas fa-sync me-1"></i>Actualizar ahora
        </button>

        <hr />

        <div class="mpc-sidebar-meta small text-muted">
          <div>
            <i class="fas fa-list me-1"></i
            ><span id="mpc-incident-count">0 incidencias</span>
          </div>
          <div class="mt-1">
            <i class="fas fa-clock me-1"></i
            ><span id="mpc-last-sync">Actualizando...</span>
          </div>
        </div>

        <div class="mpc-legend mt-3">
          <div class="mpc-legend-title small fw-semibold mb-1">Estado</div>
          <div class="mpc-legend-item">
            <span class="mpc-legend-dot bg-secondary"></span>Pendiente
          </div>
          <div class="mpc-legend-item">
            <span class="mpc-legend-dot bg-warning text-dark"></span>Pendiente
            operador
          </div>
          <div class="mpc-legend-item">
            <span class="mpc-legend-dot bg-primary"></span>En proceso
          </div>
          <div class="mpc-legend-item">
            <span class="mpc-legend-dot bg-success"></span>Resuelto
          </div>
        </div>
      </aside>

      <div
        id="mpc-canvas"
        class="mpc-canvas"
        role="region"
        aria-label="Mapa público de incidencias"
      ></div>
    </div>
  `,
  styleUrl: 'app/mapa/mapa-ciudadano.component.css',

  async onInit() {
    document.body.classList.add('mpc-view');

    // ── Defensive state (mirrors admin's C5/C6 invariants) ──
    this._aborted = false;
    this._refreshToken = 0;
    this._lastSync = null;
    this._map = null;
    this._mapRemove = null;
    this._cluster = null;
    this._pollTimer = null;

    // ── Map ──
    const { map, remove } = await initMapView({
      container: 'mpc-canvas',
      center: { lat: -0.9537, lng: -80.7286 },
      zoom: 13,
      liveInputs: false,
    });
    if (this._aborted) return;
    if (!map) return;
    this._map = map;
    this._mapRemove = remove;

    // ── Cluster group (loaded from CDN, idempotent) ──
    try {
      await this._loadMarkerCluster();
      if (this._aborted) return;
      this._cluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 60,
      });
      this._map.addLayer(this._cluster);
    } catch (err) {
      // markercluster is non-essential — log and fall back to plain markers.
      console.warn(
        '[mapa-ciudadano] markercluster unavailable, falling back',
        err,
      );
      this._cluster = null;
    }

    // ── Initial fetch from public /incidents/feed ──
    await this._refresh({ force: true });
    if (this._aborted) return;

    // ── Polling every 60s (slower than admin's 15s) ──
    // `force: true` is REQUIRED — without it, polling would always
    // hit the service's 60s cache and never refresh the markers.
    this._pollTimer = setInterval(() => {
      if (this._aborted) return;
      this._refresh({ silent: true, force: true }).catch((err) =>
        console.warn('[mapa-ciudadano] polling failed', err),
      );
    }, 60_000);

    // ── Manual refresh button ──
    document.getElementById('mpc-refresh')?.addEventListener('click', () => {
      this._refresh({ force: true });
    });
  },

  async _loadMarkerCluster() {
    MARKERCLUSTER_CSS.forEach(({ href, integrity }) => {
      if (!document.querySelector(`link[href*="${href.split('/').pop()}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.crossOrigin = 'anonymous';
        link.integrity = integrity;
        document.head.appendChild(link);
      }
    });

    if (window.L?.markerClusterGroup) return;

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MARKERCLUSTER_JS.src;
      script.crossOrigin = 'anonymous';
      script.integrity = MARKERCLUSTER_JS.integrity;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error('Failed to load leaflet.markercluster'));
      document.head.appendChild(script);
    });
  },

  async _refresh({ silent = false, force = false } = {}) {
    if (!silent) this._showLoading(true);
    const myToken = ++this._refreshToken;
    try {
      const list = await mapaCiudadanoService.fetchFeed({ force });
      if (this._aborted || myToken !== this._refreshToken) return;
      this._renderMarkers(list);
      this._lastSync = new Date();
      this._updateSyncLabel();
      this._updateCountLabel(list.length);
    } catch (err) {
      if (this._aborted || myToken !== this._refreshToken) return;
      console.error('[mapa-ciudadano] refresh failed', err);
      if (!silent) this._showError(err.message || 'Error al cargar el mapa.');
    } finally {
      if (!silent && myToken === this._refreshToken) this._showLoading(false);
    }
  },

  _renderMarkers(list) {
    if (this._cluster) {
      this._cluster.clearLayers();
    }
    list.forEach((inc) => {
      const coords = inc.geom?.coordinates;
      if (!coords) return;
      const [lng, lat] = coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const marker = L.marker([lat, lng], { icon: this._buildIcon(inc) });
      marker.bindPopup(this._buildPopup(inc), {
        className: 'mpc-marker-popup',
      });

      if (this._cluster) {
        this._cluster.addLayer(marker);
      } else {
        marker.addTo(this._map);
      }
    });
  },

  _buildIcon(inc) {
    const color = STATUS_COLOR[inc.status] ?? 'secondary';
    const html = `<div class="mpc-marker mpc-marker--${color}"></div>`;
    return L.divIcon({
      className: 'mpc-marker-wrapper',
      html,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  },

  _buildPopup(inc) {
    const statusLabel = STATUS_LABEL[inc.status] ?? inc.status ?? '—';
    const priorityLabel = PRIORITY_LABEL[inc.priority] ?? inc.priority ?? '—';
    const cat = inc.category?.name ?? '—';
    const ago = inc.created_at ? timeAgo(inc.created_at) : '';
    const detailUrl = `#/feed/${inc.id}`;
    return `
      <div class="mpc-popup">
        <h6 class="mpc-popup-title">${escapeHtml(inc.title ?? 'Sin título')}</h6>
        <div class="mpc-popup-meta">
          <span class="badge bg-${STATUS_COLOR[inc.status] ?? 'secondary'}">${escapeHtml(statusLabel)}</span>
          <span class="badge bg-${PRIORITY_COLOR[inc.priority] ?? 'secondary'} ms-1">${escapeHtml(priorityLabel)}</span>
        </div>
        <div class="mpc-popup-info small text-muted mt-1">
          <i class="fas fa-tag me-1"></i>${escapeHtml(cat)} ·
          <i class="fas fa-clock me-1"></i>${escapeHtml(ago)}
        </div>
        <a href="${detailUrl}" class="btn btn-sm btn-outline-primary mt-2">Ver detalle</a>
      </div>
    `;
  },

  _updateSyncLabel() {
    const el = document.getElementById('mpc-last-sync');
    if (el && this._lastSync) {
      el.textContent = `Actualizado ${timeAgo(this._lastSync.toISOString())}`;
    }
  },

  _updateCountLabel(n) {
    const el = document.getElementById('mpc-incident-count');
    if (el) el.textContent = `${n} incidencia${n === 1 ? '' : 's'}`;
  },

  _showLoading(on) {
    document.getElementById('mpc-loading')?.classList.toggle('d-none', !on);
  },

  _showError(msg) {
    const el = document.getElementById('mpc-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('d-none');
    }
  },

  onDestroy() {
    document.body.classList.remove('mpc-view');
    this._aborted = true;
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._cluster) this._cluster.clearLayers();
    if (this._mapRemove) this._mapRemove();
  },
};
