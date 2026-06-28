/**
 * Feed Component — dual-mode (desktop admin / mobile citizen).
 *
 * Detects context by checking admin shell presence (#main-wrapper).
 * Desktop: 3-column layout with composer bar + right panel.
 * Mobile: filter chips + cards (bottom nav handled by layout-usuario).
 *
 * Preserves existing API fetch, infinite scroll, and filter logic.
 */
import { defineComponent } from '../utils/component.js';
import { API_URL } from '../core/config.js';
import { auth } from '../auth/auth.service.js';
import { router } from '../core/router.js';

const POR_PAGINA = 10;

const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

const PRIORITY_LABEL = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

let paginaActual = 1;
let totalPaginas = 1;
let filtroStatus = '';
let cargando = false;
let todasLasIncidencias = [];
let observer = null;
let _unsubAuthChange = null;
let MODE = 'desktop';

// ── Context detection ───────────────────────────────────────

function detectContext() {
  const wrapper = document.getElementById('main-wrapper');
  MODE = wrapper && wrapper.style.display !== 'none' ? 'desktop' : 'mobile';
  return MODE;
}

// ── Helpers ─────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'justo ahora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
  });
}

function getInitials(user) {
  if (!user) return '?';
  const first = (user.first_name || '')[0] || '';
  const last = (user.last_name || '')[0] || '';
  return (first + last).toUpperCase() || '?';
}

function getUserDisplayName(user) {
  if (!user) return 'Anónimo';
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Usuario';
}

function resolveAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  if (typeof avatar === 'object') {
    if (avatar.url) return avatar.url;
    if (Array.isArray(avatar.urls) && avatar.urls.length > 0) return avatar.urls[0];
    if (Array.isArray(avatar) && avatar.length > 0) {
      const first = avatar[0];
      return typeof first === 'string' ? first : first?.url || null;
    }
  }
  return null;
}

function formatCoords(geom) {
  if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) return '';
  const [lng, lat] = geom.coordinates;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function getCategoryName(inc) {
  return inc.category?.name || inc.incident_category_name || 'Categoría';
}

function getLocationName(inc) {
  return inc.location_name || inc.location?.name || '';
}

// ── Card renderer ───────────────────────────────────────────

function renderCard(inc) {
  const catName = getCategoryName(inc);
  const locName = getLocationName(inc);
  const statusLabel = STATUS_LABEL[inc.status] ?? inc.status;
  const priorityLabel = PRIORITY_LABEL[inc.priority] ?? inc.priority;
  const userName = getUserDisplayName(inc.user || inc.reporter);
  const initials = getInitials(inc.user || inc.reporter);
  const tiempo = timeAgo(inc.created_at);
  const avatarUrl = resolveAvatar(inc.user?.avatar || inc.reporter?.avatar);
  const coords = formatCoords(inc.geom);
  const isDesktop = MODE === 'desktop';
  const cardClass = isDesktop ? 'feed-card' : 'feed-card feed-card-mobile';
  const mapHeight = isDesktop ? '180px' : '130px';

  const title = inc.title || 'Sin título';
  const desc = inc.description || '';

  const avatarHtml = avatarUrl
    ? `<img class="feed-card-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(userName)}" />`
    : `<div class="feed-card-avatar">${escapeHtml(initials)}</div>`;

  const mapHtml = coords
    ? `<div class="feed-card-map" style="height:${mapHeight}"><div class="feed-card-map-pin"></div><span class="feed-card-map-coords">📍 ${escapeHtml(coords)}</span></div>`
    : '';

  const tagsHtml = catName
    ? `<div class="feed-card-tags"><span class="feed-tag">#${escapeHtml(catName)}</span></div>`
    : '';

  // Detail link depends on context
  const detailLink = isDesktop ? `#/incidencias/${inc.id}` : `#/feed/${inc.id}`;

  // Action buttons — shared
  const actionsHtml = `
      <button class="feed-action-btn" title="Comentarios"><i class="far fa-comment"></i>${inc.comments_count || 0}</button>
      <button class="feed-action-btn" title="Yo también reporto"><i class="far fa-hand-point-up"></i>${isDesktop ? 'Seguir' : 'Yo también'}</button>
      <span class="feed-action-spacer"></span>
      <a href="${detailLink}" class="feed-action-btn feed-action-primary">Ver detalle <i class="fas fa-arrow-right"></i></a>`;

  return `
    <div class="${cardClass}" data-id="${inc.id}">
      <!-- Header -->
      <div class="feed-card-head">
        ${avatarHtml}
        <div class="feed-card-user">
          <span class="feed-card-name">${escapeHtml(userName)}</span>
          <span class="feed-card-meta"><i class="fas fa-location-dot"></i> ${escapeHtml(locName || tiempo)} · ${tiempo}</span>
        </div>
        <span class="feed-status-badge feed-status-${inc.status}">${statusLabel}</span>
        <span class="feed-priority-badge feed-priority-${inc.priority}">${priorityLabel}</span>
      </div>

      <!-- Title -->
      <div class="feed-card-title-row">
        <h3 class="feed-card-title">${escapeHtml(title)}</h3>
        <span class="feed-card-id">INC-${String(inc.id).padStart(4, '0')}</span>
      </div>

      <!-- Description -->
      ${desc ? `<div class="feed-card-desc">${escapeHtml(desc)}</div>` : ''}

      <!-- Tags -->
      ${tagsHtml}

      <!-- Map placeholder -->
      ${mapHtml}

      <!-- Actions -->
      <div class="feed-card-actions">
        ${actionsHtml}
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Composer bar ─────────────────────────────────────────────

function setupComposerBar() {
  const bar = document.getElementById('composer-bar');
  if (!bar) return;

  if (auth.isAuthenticated()) {
    bar.classList.remove('d-none');
    const avatarEl = document.getElementById('composer-avatar');
    if (avatarEl) {
      const user = auth.getUser();
      if (user) {
        avatarEl.textContent = getInitials(user);
      }
    }
  } else {
    bar.classList.add('d-none');
  }
}

// ── Fetch ────────────────────────────────────────────────────

async function fetchIncidencias(pagina, append = false) {
  if (cargando) return;
  cargando = true;

  const isDesktop = MODE === 'desktop';
  const listEl = document.getElementById(isDesktop ? 'feed-list' : 'feed-list-mobile');
  const skeleton = document.getElementById(isDesktop ? 'feed-cargando' : 'feed-cargando-mobile');
  const vacio = document.getElementById(isDesktop ? 'feed-vacio' : 'feed-vacio-mobile');
  const sentinel = document.getElementById(isDesktop ? 'feed-sentinel' : 'feed-sentinel-mobile');
  const container = document.getElementById(isDesktop ? 'feed-desktop' : 'feed-mobile');

  if (!listEl || !skeleton || !vacio || !sentinel) {
    cargando = false;
    return;
  }

  if (!append) {
    skeleton.classList.remove('d-none');
    listEl.innerHTML = '';
    vacio.classList.add('d-none');
    sentinel.classList.remove('done');
    sentinel.classList.remove('loading');
    todasLasIncidencias = [];
  }

  const params = new URLSearchParams({ page: pagina, per_page: POR_PAGINA });
  if (filtroStatus) params.set('status', filtroStatus);

  try {
    const resp = await fetch(`${API_URL}/incidents/feed?${params.toString()}`);
    const json = await resp.json();

    const datos = json.data ?? [];
    const meta = json.meta ?? {};
    paginaActual = meta.current_page ?? pagina;
    totalPaginas = meta.last_page ?? 1;
    const hasMore = paginaActual < totalPaginas;

    skeleton.classList.add('d-none');

    if (!append) todasLasIncidencias = datos;
    else todasLasIncidencias = [...todasLasIncidencias, ...datos];

    if (todasLasIncidencias.length === 0) {
      listEl.innerHTML = '';
      vacio.classList.remove('d-none');
      sentinel.classList.add('done');
    } else {
      vacio.classList.add('d-none');
      const html = datos.map(renderCard).join('');
      if (append) {
        listEl.insertAdjacentHTML('beforeend', html);
      } else {
        listEl.innerHTML = html;
      }

      sentinel.classList.toggle('done', !hasMore);
      sentinel.classList.toggle('loading', hasMore && !cargando);
    }
  } catch {
    skeleton.classList.add('d-none');
    vacio.classList.remove('d-none');
    const p = vacio.querySelector('p');
    if (p) p.textContent = 'Error al cargar. Intente de nuevo.';
    const s = document.getElementById(isDesktop ? 'feed-sentinel' : 'feed-sentinel-mobile');
    if (s) s.classList.add('done');
  } finally {
    cargando = false;
  }
}

// ── Infinite scroll ─────────────────────────────────────────

function setupInfiniteScroll() {
  if (observer) observer.disconnect();

  const isDesktop = MODE === 'desktop';
  const sentinel = document.getElementById(isDesktop ? 'feed-sentinel' : 'feed-sentinel-mobile');
  if (!sentinel || sentinel.classList.contains('done')) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !cargando && paginaActual < totalPaginas) {
        sentinel.classList.add('loading');
        fetchIncidencias(paginaActual + 1, true);
      }
    },
    { rootMargin: '200px' },
  );

  observer.observe(sentinel);
}

// ── Filter setup ────────────────────────────────────────────

function setupFilters() {
  const isDesktop = MODE === 'desktop';
  const filterContainer = document.getElementById(isDesktop ? 'feed-filters' : 'mobile-filters');
  if (!filterContainer) return;

  filterContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.feed-chip, .mobile-chip');
    if (!chip) return;

    filterContainer.querySelectorAll('.feed-chip, .mobile-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    filtroStatus = chip.dataset.status;
    paginaActual = 1;

    if (observer) observer.disconnect();
    fetchIncidencias(1, false).then(() => setupInfiniteScroll());
  });
}

// ── Component ────────────────────────────────────────────────

export default defineComponent({
  templateUrl: 'app/feed/feed.component.html',
  styleUrl: 'app/feed/feed.component.css',

  async onInit() {
    // Detect context
    detectContext();

    // Show the right mode container, hide the other
    const desktop = document.getElementById('feed-desktop');
    const mobile = document.getElementById('feed-mobile');
    if (MODE === 'desktop' && desktop) {
      desktop.classList.remove('d-none');
      if (mobile) mobile.classList.add('d-none');
    } else if (mobile) {
      mobile.classList.remove('d-none');
      if (desktop) desktop.classList.add('d-none');
    }

    // Composer bar (desktop only, auth-gated)
    if (MODE === 'desktop') {
      setupComposerBar();
      _unsubAuthChange = auth.onAuthChange(() => setupComposerBar());
    }

    // Setup filters
    setupFilters();

    // First load
    await fetchIncidencias(1, false);
    setupInfiniteScroll();

    // Re-check composer bar visibility on hash change (after login redirects)
    window.addEventListener('hashchange', () => {
      if (MODE === 'desktop') setupComposerBar();
    });
  },

  onDestroy() {
    if (observer) observer.disconnect();
    if (_unsubAuthChange) _unsubAuthChange();
  },
});
