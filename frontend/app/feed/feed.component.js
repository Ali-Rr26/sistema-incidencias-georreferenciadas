import {
  escapeHtml,
  timeAgo,
  STATUS_LABEL,
  PRIORITY_LABEL,
} from '../utils/format.js';
import {
  getInitials,
  getUserDisplayName,
  resolveAvatar,
} from '../utils/avatar.js';
import { http } from '../core/http.service.js';
import { router } from '../core/router.js';
import { auth } from '../auth/auth.service.js';

const POR_PAGINA = 10;

// ── Card renderer ──────────────────────────────────────────

function renderCard(inc) {
  const catName = inc.category?.name ?? 'Categoría';
  const locName = inc.location?.name ?? '';
  const statusLabel = STATUS_LABEL[inc.status] ?? inc.status;
  const userName = getUserDisplayName(inc.user);
  const initials = getInitials(inc.user);
  const tiempo = timeAgo(inc.created_at);
  const avatarUrl = resolveAvatar(inc.user?.avatar);
  const avatarHtml = avatarUrl
    ? `<img class="ig-avatar-img" src="${avatarUrl}" alt="${userName}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;" />`
    : `<div class="feed-avatar" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#a06bf5,#6a5cf3);color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>`;

  const priorityLabel = PRIORITY_LABEL[inc.priority] ?? inc.priority ?? 'Baja';
  const priorityClass = inc.priority ?? 'low';

  const descParts = [];
  if (inc.description) {
    descParts.push(inc.description);
  }
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

  // Has resolution banner?
  let resolutionHtml = '';
  if (inc.status === 'resolved') {
    resolutionHtml = `
      <div class="feed-resolution-banner" style="background:#d8f6e7;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <i class="fa-solid fa-circle-check" style="color:#16a96b;font-size:16px"></i>
        <div style="font-size:12.5px;color:#1a7a4a;font-weight:600">
          Resuelta
        </div>
      </div>
    `;
  }

  // Tags/Hashtags
  const tagsHtml = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:12px;color:#6a5cf3;background:#f0edff;padding:4px 11px;border-radius:10px;font-weight:600"># ${escapeHtml(catName)}</span>
      ${locName ? `<span style="font-size:12px;color:#6a5cf3;background:#f0edff;padding:4px 11px;border-radius:10px;font-weight:600"># ${escapeHtml(locName.split(',')[0])}</span>` : ''}
    </div>
  `;

  // Image/Map placeholder with coords overlay
  let coordsHtml = '';
  if (inc.geom?.type === 'Point' && Array.isArray(inc.geom?.coordinates)) {
    const [lng, lat] = inc.geom.coordinates;
    coordsHtml = `
      <div style="position:absolute;left:16px;bottom:12px;background:rgba(255,255,255,.9);border-radius:8px;padding:6px 11px;font-size:11.5px;color:#6b7180;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px)">
        <i class="fa-solid fa-location-crosshairs" style="color:#5a6ff0;font-size:11px"></i>
        ${lat.toFixed(4)}, ${lng.toFixed(4)}
      </div>
    `;
  }

  let mediaHtml = '';
  if (inc.thumbnail_url) {
    mediaHtml = `
      <div class="feed-card-preview" style="margin:0 18px 14px;height:180px;border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">
        <img src="${inc.thumbnail_url}" style="width:100%;height:100%;object-fit:cover;" />
        ${coordsHtml}
      </div>
    `;
  } else {
    // Renders the classic preview map background
    mediaHtml = `
      <div class="feed-card-preview" style="margin:0 18px 14px;height:180px;border-radius:12px;background:linear-gradient(160deg,#dce4ee,#c8d4e2);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:0;background-image:linear-gradient(#c8d4e2 1px,transparent 1px),linear-gradient(90deg,#c8d4e2 1px,transparent 1px);background-size:38px 38px;opacity:.5"></div>
        <div style="position:absolute;top:0;bottom:0;left:40%;width:22px;background:#e4ecf5;opacity:.8"></div>
        <div style="position:absolute;left:0;right:0;top:54%;height:18px;background:#e4ecf5;opacity:.8"></div>
        <div style="position:absolute;left:46%;top:48%;transform:translate(-50%,-100%)">
          <div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#fa5a7d;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 5px 12px rgba(0,0,0,.28)">
            <i class="fa-solid fa-location-dot" style="color:#fff;font-size:13px;transform:rotate(45deg)"></i>
          </div>
        </div>
        ${coordsHtml}
      </div>
    `;
  }

  const commentCount = inc.comments_count ?? 0;

  return `
    <div class="feed-card feed-priority-${priorityClass}" data-route="/feed/${inc.id}" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(20,20,50,.04);border:1px solid #eef0f5;margin-bottom:16px;cursor:pointer">
      <div class="feed-card-head" style="display:flex;align-items:center;gap:12px;padding:16px 18px 12px">
        ${avatarHtml}
        <div class="feed-card-user" style="flex:1">
          <div class="feed-card-name" style="font-size:14px;font-weight:700;color:#23283b">${escapeHtml(userName)}</div>
          <div style="font-size:12px;color:#b3b8c6;display:flex;align-items:center;gap:6px;margin-top:1px">
            <i class="fa-solid fa-location-dot" style="color:#a06bf5;font-size:10px"></i>
            ${escapeHtml(locName) || 'Ubicación no especificada'} &nbsp;·&nbsp; ${tiempo}
          </div>
        </div>
        <span class="feed-status-badge feed-status-${inc.status}">${statusLabel}</span>
        <span class="feed-priority-badge feed-priority-${priorityClass}" style="margin-left: 8px;">● ${priorityLabel}</span>
      </div>
      
      <div class="feed-card-body" style="padding:0 18px 12px">
        <div style="font-size:15px;font-weight:700;color:#23283b;margin-bottom:5px">
          ${escapeHtml(inc.title || 'Sin título')} · <span style="font-size:13px;color:#a3a8b8;font-weight:400">INC-${String(inc.id).padStart(4, '0')}</span>
        </div>
        <div class="feed-card-desc" style="font-size:13.5px;color:#5b6172;line-height:1.55;margin-bottom:10px">
          ${escapeHtml(descText)}
        </div>
        ${resolutionHtml}
        ${tagsHtml}
      </div>

      ${mediaHtml}

      <div class="feed-card-actions" style="display:flex;align-items:center;padding:10px 18px 14px;border-top:1px solid #f5f6fa">
        <div style="display:flex;gap:4px;flex:1">
          <button style="height:36px;border-radius:22px;border:1px solid #eef0f5;background:#fff;padding:0 14px;font-size:13px;font-weight:500;color:#6b7180;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:7px" onclick="event.stopPropagation()">
            <i class="fa-regular fa-comment" style="font-size:13px;color:#a3a8b8"></i>
            ${commentCount} ${commentCount === 1 ? 'comentario' : 'comentarios'}
          </button>
          <button style="height:36px;border-radius:22px;border:1px solid #eef0f5;background:#fff;padding:0 14px;font-size:13px;font-weight:500;color:#6b7180;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:7px" onclick="event.stopPropagation()">
            <i class="fa-regular fa-eye" style="font-size:13px;color:#a3a8b8"></i>
            Seguir
          </button>
          <button style="height:36px;border-radius:22px;border:1px solid #eef0f5;background:#fff;padding:0 14px;font-size:13px;font-weight:500;color:#6b7180;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:7px" onclick="event.stopPropagation()">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:12px;color:#a3a8b8"></i>
            Yo también reporto
          </button>
        </div>
        <button class="feed-action-btn" data-route="/feed/${inc.id}" title="Ver detalle" style="height:36px;border-radius:22px;border:none;background:linear-gradient(118deg,#6a5cf3,#a06bf5);padding:0 18px;font-size:13px;font-weight:600;color:#fff;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 6px 14px -6px rgba(106,92,243,.55)">
          <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px"></i>
          Ver detalle
        </button>
      </div>
    </div>
  `;
}

// ── DOM ids (single responsive template) ───────────────────

const LIST = 'feed-list';
const FILTERS = 'feed-filters';
const SKELETON = 'feed-cargando';
const VACIO = 'feed-vacio';
const SENTINEL = 'feed-sentinel';
const CHIP_SELECTOR = '.feed-chip';

// ── Component ──────────────────────────────────────────────

export default {
  templateUrl: 'app/feed/feed.component.html',
  styleUrl: 'app/feed/feed.component.css',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let filtroStatus = '';
    let cargando = false;
    let todasLasIncidencias = [];
    let observer = null;

    document.body.classList.add('feed-view');

    // Composer setup
    const composerBar = document.getElementById('composer-bar');
    if (composerBar) {
      if (auth.isAuthenticated()) {
        composerBar.classList.remove('d-none');
        const currentUser = auth.getUser();
        const composerAvatar = document.getElementById('composer-avatar');
        if (composerAvatar && currentUser) {
          composerAvatar.textContent = getInitials(currentUser);
        }
      } else {
        composerBar.classList.add('d-none');
      }
      composerBar.addEventListener('click', () => {
        router.navigate('/feed/crear');
      });
    }

    const feedList = document.getElementById(LIST);
    const feedFilters = document.getElementById(FILTERS);
    if (!feedFilters || !feedList) return;

    // Event delegation: any click on an element with [data-route]
    // (cards, "Ver detalle" buttons) navigates via the router. The
    // onclick="window.location.hash=..." inline handlers were removed
    // in favor of this single delegated listener — it works for any
    // card appended later by infinite scroll without re-binding.
    feedList.addEventListener('click', (e) => {
      const target = e.target.closest('[data-route]');
      if (!target) return;
      e.preventDefault();
      router.navigate(target.dataset.route);
    });

    // ── Fetch ───────────────────────────────────────────────

    async function fetchIncidencias(pagina, append = false) {
      if (cargando) return;
      cargando = true;

      const listEl = document.getElementById(LIST);
      const skeleton = document.getElementById(SKELETON);
      const vacio = document.getElementById(VACIO);
      const sentinel = document.getElementById(SENTINEL);

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
        document.getElementById(SENTINEL).classList.add('done');
      } finally {
        cargando = false;
      }
    }

    // ── Infinite scroll ─────────────────────────────────────

    function setupInfiniteScroll() {
      if (observer) observer.disconnect();

      const sentinel = document.getElementById(SENTINEL);
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

    // ── Filter chips (unified: main + aside use same selector) ──
    function applyStatusFilter(chip) {
      document
        .querySelectorAll(`${CHIP_SELECTOR}, .rp-filter-chip`)
        .forEach((c) => {
          c.classList.toggle(
            'active',
            c.dataset.status === chip.dataset.status,
          );
        });
      filtroStatus = chip.dataset.status;
      paginaActual = 1;
      if (observer) observer.disconnect();
      return fetchIncidencias(1, false).then(() => setupInfiniteScroll());
    }

    feedFilters.addEventListener('click', (e) => {
      const chip = e.target.closest(CHIP_SELECTOR);
      if (chip) applyStatusFilter(chip);
    });

    const rpStatusFilters = document.getElementById('rp-status-filters');
    if (rpStatusFilters) {
      rpStatusFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('.rp-filter-chip');
        if (chip) applyStatusFilter(chip);
      });
    }

    // ── Right Sidebar Category Checkbox filters ──
    const rpCategoryFilters = document.getElementById('rp-category-filters');
    if (rpCategoryFilters) {
      rpCategoryFilters.addEventListener('click', (e) => {
        const label = e.target.closest('.rp-checkbox-label');
        if (!label) return;

        const box = label.querySelector('.rp-checkbox-box');
        if (!box) return;

        const checked = box.classList.toggle('checked');
        if (checked) {
          box.innerHTML =
            '<i class="fa-solid fa-check" style="color:#fff;font-size:9px"></i>';
          label.style.color = '#5b6172';
        } else {
          box.innerHTML = '';
          label.style.color = '#a3a8b8';
        }

        // Trigger local filtering on category names
        const checkedLabels = Array.from(
          document.querySelectorAll('.rp-checkbox-label'),
        )
          .filter((l) =>
            l.querySelector('.rp-checkbox-box').classList.contains('checked'),
          )
          .map((l) => l.textContent.trim().toLowerCase());

        const listEl = document.getElementById(LIST);
        if (listEl) {
          if (checkedLabels.length === 0) {
            listEl.innerHTML = todasLasIncidencias.map(renderCard).join('');
          } else {
            const filtered = todasLasIncidencias.filter((inc) => {
              const cat = (inc.category?.name ?? '').toLowerCase();
              return checkedLabels.some(
                (l) => cat.includes(l) || l.includes(cat),
              );
            });
            listEl.innerHTML = filtered.map(renderCard).join('');
          }
        }
      });
    }

    // ── First load ──
    await fetchIncidencias(1, false);
    setupInfiniteScroll();
  },

  onDestroy() {
    document.body.classList.remove('feed-view');
  },
};
