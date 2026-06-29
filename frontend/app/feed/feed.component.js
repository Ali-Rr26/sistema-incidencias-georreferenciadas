import { defineComponent } from '../utils/component.js';
import { API_URL } from '../core/config.js';

const POR_PAGINA = 10;
const CAT_EMOJIS = ['🔧', '🔒', '🌿', '💧', '🚨', '🏗️', '⚡', '📍'];

const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

let paginaActual = 1;
let totalPaginas = 1;
let filtroStatus = '';
let cargando = false;
let todasLasIncidencias = [];
let observer = null;

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
  // String URL directa
  if (typeof avatar === 'string') return avatar;
  // Objeto {url: '...'} o {urls: [...]}
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
    : `<div class="ig-avatar">${initials}</div>`;

  // Build a short description from available data
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

  return `
    <div class="ig-card ${'ig-priority-' + (inc.priority ?? 'low')}">
      <!-- User header -->
      <div class="ig-card-head">
        ${avatarHtml}
        <div class="ig-card-user">
          <span class="ig-card-name">${escapeHtml(userName)}</span>
          <span class="ig-card-time">${tiempo}</span>
        </div>
        <span class="ig-status-badge ig-status-${inc.status}">${statusLabel}</span>
      </div>

      <!-- Preview / category area -->
      <div class="ig-card-preview">
        <div class="ig-card-preview-icon">${emoji}</div>
        <span class="ig-card-category-badge">${escapeHtml(catName)}</span>
      </div>

      <!-- Body -->
      <div class="ig-card-body">
        ${locName ? `<div class="ig-card-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(locName)}</div>` : ''}
        ${descText ? `<div class="ig-card-desc">${escapeHtml(descText)}</div>` : ''}
      </div>

      <!-- Action bar -->
      <div class="ig-card-actions">
        <button class="ig-action-btn" title="Comentar">
          <i class="far fa-comment"></i>
        </button>
        <button class="ig-action-btn" title="Compartir">
          <i class="far fa-share-square"></i>
        </button>
        <span class="ig-action-spacer"></span>
        <span class="ig-action-btn" style="cursor:default;color:#8e8e8e;font-size:0.75rem">
          <span class="ig-priority-dot"></span>
          ${inc.status === 'resolved' ? 'Resuelto' : inc.priority === 'high' ? 'Urgente' : inc.priority === 'medium' ? 'Normal' : 'Leve'}
        </span>
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Fetch ─────────────────────────────────────────────────

async function fetchIncidencias(pagina, append = false) {
  if (cargando) return;
  cargando = true;

  const listEl = document.getElementById('feed-list');
  const skeleton = document.getElementById('feed-cargando');
  const vacio = document.getElementById('feed-vacio');
  const sentinel = document.getElementById('feed-sentinel');

  if (!append) {
    skeleton.classList.remove('d-none');
    listEl.innerHTML = '';
    vacio.classList.add('d-none');
    sentinel.classList.remove('done');
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
      if (append) {
        listEl.insertAdjacentHTML('beforeend', datos.map(renderCard).join(''));
      } else {
        listEl.innerHTML = todasLasIncidencias.map(renderCard).join('');
      }

      // Sentinel state
      sentinel.classList.toggle('done', !hasMore);
      sentinel.classList.toggle('loading', hasMore && !cargando);
    }
  } catch {
    skeleton.classList.add('d-none');
    vacio.classList.remove('d-none');
    vacio.querySelector('p').textContent = 'Error al cargar. Intente de nuevo.';
    document.getElementById('feed-sentinel').classList.add('done');
  } finally {
    cargando = false;
  }
}

// ── Component ──────────────────────────────────────────────

export default defineComponent({
  templateUrl: 'app/feed/feed.component.html',
  styleUrl: 'app/feed/feed.component.css',

  async onInit() {
    document.body.classList.add('feed-view');

    // ── Filter chips ──
    document.getElementById('feed-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.ig-chip');
      if (!chip) return;
      document
        .querySelectorAll('.ig-chip')
        .forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      filtroStatus = chip.dataset.status;
      paginaActual = 1;

      // Disconnect previous observer
      if (observer) observer.disconnect();

      fetchIncidencias(1, false).then(() => setupInfiniteScroll());
    });

    // ── First load ──
    await fetchIncidencias(1, false);
    setupInfiniteScroll();
  },

  onDestroy() {
    document.body.classList.remove('feed-view');
    if (observer) observer.disconnect();
  },
});

// ── Infinite scroll ────────────────────────────────────────

function setupInfiniteScroll() {
  if (observer) observer.disconnect();

  const sentinel = document.getElementById('feed-sentinel');
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
