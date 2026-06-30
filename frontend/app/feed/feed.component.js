import { defineComponent } from '../utils/component.js';
import { http } from '../core/http.service.js';

const POR_PAGINA = 10;
const CAT_EMOJIS = ['🔧', '🔒', '🌿', '💧', '🚨', '🏗️', '⚡', '📍'];

const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

// ── Helpers ────────────────────────────────────────────────

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

function catEmoji(id) {
  return CAT_EMOJIS[(id ?? 0) % CAT_EMOJIS.length];
}

function resolveAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  if (typeof avatar === 'object') {
    if (avatar.url) return avatar.url;
    if (Array.isArray(avatar.urls) && avatar.urls.length > 0)
      return avatar.urls[0];
    if (Array.isArray(avatar) && avatar.length > 0) {
      const first = avatar[0];
      return typeof first === 'string' ? first : first?.url || null;
    }
  }
  return null;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Card renderer ──────────────────────────────────────────

function renderCard(inc) {
  const catName = inc.category?.name ?? 'Categoría';
  const locName = inc.location?.name ?? '';
  const statusLabel = STATUS_LABEL[inc.status] ?? inc.status;
  const emoji = catEmoji(inc.incident_category_id);
  const userName = getUserDisplayName(inc.user);
  const initials = getInitials(inc.user);
  const tiempo = timeAgo(inc.created_at);
  const avatarUrl = resolveAvatar(inc.user?.avatar);
  const avatarHtml = avatarUrl
    ? `<img class="ig-avatar-img" src="${avatarUrl}" alt="${userName}" />`
    : `<div class="feed-avatar">${initials}</div>`;

  const descParts = [];
  if (inc.priority) {
    descParts.push(
      `Prioridad: ${inc.priority === 'high' ? 'Alta' : inc.priority === 'medium' ? 'Media' : 'Baja'}`,
    );
  }
  const orgs = inc.category?.organizations;
  const orgName =
    Array.isArray(orgs) && orgs.length > 0
      ? orgs
          .map((o) => o.name)
          .filter(Boolean)
          .join(', ')
      : null;
  if (orgName) {
    descParts.push(`Organización: ${orgName}`);
  }
  const descText = descParts.join(' · ');

  const thumbnailHtml = inc.thumbnail_url
    ? `<div class="feed-card-thumb">
        <img src="${inc.thumbnail_url}" alt="Imagen" loading="lazy" />
       </div>`
    : '';

  return `
    <div class="feed-card ${'feed-priority-' + (inc.priority ?? 'low')}" onclick="window.location.hash='#/feed/${inc.id}'" style="cursor:pointer">
      <div class="feed-card-head">
        ${avatarHtml}
        <div class="feed-card-user">
          <span class="feed-card-name">${escapeHtml(userName)}</span>
          <span class="feed-card-time">${tiempo}</span>
        </div>
        <span class="feed-status-badge feed-status-${inc.status}">${statusLabel}</span>
      </div>
      <div class="feed-card-preview">
        <div class="feed-card-preview-icon">${emoji}</div>
        <span class="feed-card-category-badge">${escapeHtml(catName)}</span>
      </div>
      ${thumbnailHtml}
      <div class="feed-card-body">
        ${locName ? `<div class="feed-card-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(locName)}</div>` : ''}
        ${descText ? `<div class="feed-card-desc">${escapeHtml(descText)}</div>` : ''}
      </div>
      <div class="feed-card-actions">
        <button class="feed-action-btn" title="Ver detalle" onclick="event.stopPropagation();window.location.hash='#/feed/${inc.id}'">
          <i class="far fa-eye"></i>
        </button>
        <button class="feed-action-btn" title="Compartir">
          <i class="far fa-share-square"></i>
        </button>
        <span class="feed-action-spacer"></span>
        <span class="feed-action-btn" style="cursor:default;color:#8e8e8e;font-size:0.75rem">
          <span class="feed-priority-dot"></span>
          ${inc.status === 'resolved' ? 'Resuelto' : inc.priority === 'high' ? 'Urgente' : inc.priority === 'medium' ? 'Normal' : 'Leve'}
        </span>
      </div>
    </div>`;
}

// ── Context detection ──────────────────────────────────────

const CTX = {
  list: '',
  filters: '',
  skeleton: '',
  vacio: '',
  sentinel: '',
  containerDesktop: 'feed-desktop',
  containerMobile: 'feed-mobile',
  chipSelector: '.feed-chip, .mobile-chip',
};

function detectContext() {
  const wrapper = document.getElementById('main-wrapper');
  const isDesktop = wrapper && wrapper.style.display !== 'none';

  // Toggle container visibility
  const desktop = document.getElementById(CTX.containerDesktop);
  const mobile = document.getElementById(CTX.containerMobile);
  if (desktop) desktop.classList.toggle('d-none', !isDesktop);
  if (mobile) mobile.classList.toggle('d-none', isDesktop);

  // Selectors per mode
  if (isDesktop) {
    CTX.list = 'feed-list';
    CTX.filters = 'feed-filters';
    CTX.skeleton = 'feed-cargando';
    CTX.vacio = 'feed-vacio';
    CTX.sentinel = 'feed-sentinel';
  } else {
    CTX.list = 'feed-list-mobile';
    CTX.filters = 'mobile-filters';
    CTX.skeleton = 'feed-cargando-mobile';
    CTX.vacio = 'feed-vacio-mobile';
    CTX.sentinel = 'feed-sentinel-mobile';
  }

  return isDesktop ? 'desktop' : 'mobile';
}

// ── Component ──────────────────────────────────────────────

export default defineComponent({
  templateUrl: 'app/feed/feed.component.html',
  styleUrl: 'app/feed/feed.component.css',

  async onInit() {
    // State — scoped to this component instance via closure
    let paginaActual = 1;
    let totalPaginas = 1;
    let filtroStatus = '';
    let cargando = false;
    let todasLasIncidencias = [];
    let observer = null;

    // ── Context ───────────────────────────────────────────────
    detectContext();
    document.body.classList.add('feed-view');

    // Guard: if DOM elements are missing (testing edge case), skip
    const feedList = document.getElementById(CTX.list);
    const feedFilters = document.getElementById(CTX.filters);
    if (!feedFilters || !feedList) return;

    // ── Fetch ───────────────────────────────────────────────

    async function fetchIncidencias(pagina, append = false) {
      if (cargando) return;
      cargando = true;

      const listEl = document.getElementById(CTX.list);
      const skeleton = document.getElementById(CTX.skeleton);
      const vacio = document.getElementById(CTX.vacio);
      const sentinel = document.getElementById(CTX.sentinel);

      if (!append) {
        skeleton.classList.remove('d-none');
        listEl.innerHTML = '';
        vacio.classList.add('d-none');
        sentinel.classList.remove('done');
        todasLasIncidencias = [];
      }

      const params = new URLSearchParams({
        page: pagina,
        per_page: POR_PAGINA,
      });
      if (filtroStatus) params.set('status', filtroStatus);

      try {
        const json = await http.get(`/incidents/feed?${params.toString()}`);

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
          if (append) {
            listEl.insertAdjacentHTML(
              'beforeend',
              datos.map(renderCard).join(''),
            );
          } else {
            listEl.innerHTML = todasLasIncidencias.map(renderCard).join('');
          }
          sentinel.classList.toggle('done', !hasMore);
          sentinel.classList.toggle('loading', hasMore && !cargando);
        }
      } catch {
        skeleton.classList.add('d-none');
        vacio.classList.remove('d-none');
        vacio.querySelector('p').textContent =
          'Error al cargar. Intente de nuevo.';
        document.getElementById(CTX.sentinel).classList.add('done');
      } finally {
        cargando = false;
      }
    }

    // ── Infinite scroll ─────────────────────────────────────

    function setupInfiniteScroll() {
      if (observer) observer.disconnect();

      const sentinel = document.getElementById(CTX.sentinel);
      if (!sentinel || sentinel.classList.contains('done')) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            !cargando &&
            paginaActual < totalPaginas
          ) {
            sentinel.classList.add('loading');
            fetchIncidencias(paginaActual + 1, true);
          }
        },
        { rootMargin: '200px' },
      );

      observer.observe(sentinel);
    }

    // ── Filter chips ──
    feedFilters.addEventListener('click', (e) => {
      const chip = e.target.closest(CTX.chipSelector);
      if (!chip) return;
      document
        .querySelectorAll(CTX.chipSelector)
        .forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      filtroStatus = chip.dataset.status;
      paginaActual = 1;

      if (observer) observer.disconnect();
      fetchIncidencias(1, false).then(() => setupInfiniteScroll());
    });

    // ── First load ──
    await fetchIncidencias(1, false);
    setupInfiniteScroll();
  },

  onDestroy() {
    document.body.classList.remove('feed-view');
  },
});
