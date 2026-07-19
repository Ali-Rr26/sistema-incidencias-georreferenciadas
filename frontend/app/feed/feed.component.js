import template from './feed.component.html?raw';
import style from './feed.component.css?raw';
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
import loadLeaflet from '../shared/leaflet.js';

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
    : `<button type="button" class="feed-avatar feed-avatar-btn" aria-label="Perfil de ${userName}" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#a06bf5,#6a5cf3);color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:0;padding:0;cursor:pointer">${initials}</button>`;

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

  // Extract geometry coords for minimap (real or inline)
  const geomCoords =
    inc.geom?.type === 'Point' && Array.isArray(inc.geom?.coordinates)
      ? { lng: inc.geom.coordinates[0], lat: inc.geom.coordinates[1] }
      : null;

  let coordsHtml = '';
  if (geomCoords) {
    coordsHtml = `
      <div class="position-absolute bottom-0 start-0 m-2 bg-white bg-opacity-90 rounded-2 px-2 py-1 d-flex align-items-center gap-1" style="font-size:11px;color:#6b7180;backdrop-filter:blur(4px)">
        <i class="fa-solid fa-location-crosshairs" style="color:#5a6ff0;font-size:10px"></i>
        ${geomCoords.lat.toFixed(4)}, ${geomCoords.lng.toFixed(4)}
      </div>
    `;
  }

  let mediaHtml = '';
  if (inc.thumbnail_url) {
    mediaHtml = `
      <div class="feed-card-preview rounded-3 overflow-hidden position-relative mx-3 mb-3" style="height:180px">
        <img src="${inc.thumbnail_url}" class="w-100 h-100" style="object-fit:cover" />
        ${coordsHtml}
      </div>
    `;
  } else if (geomCoords) {
    mediaHtml = `
      <div id="feed-mm-${inc.id}" class="feed-minimap rounded-3 overflow-hidden position-relative mx-3 mb-3"
           data-lat="${geomCoords.lat}" data-lng="${geomCoords.lng}"
           style="height:180px;background:#e8ecf1">
        ${coordsHtml}
      </div>
    `;
  }

  const commentCount = inc.comments_count ?? 0;

  // Status badge — soft-fill chip
  const statusBadgeClass = `feed-status-chip feed-status-${inc.status || 'default'}`;

  return `
    <div class="card feed-card feed-priority-${priorityClass} mb-3" data-route="/feed/${inc.id}" tabindex="0" role="link" aria-label="Ver detalle de ${escapeHtml(inc.title || 'Sin título')}" style="cursor:pointer;background-color:#ffffff!important">
      <div class="card-header bg-transparent d-flex align-items-center gap-3 py-3 px-3">
        ${avatarHtml}
        <div class="flex-grow-1 min-width-0">
          <div class="fw-bold" style="font-size:14px;color:#23283b">${escapeHtml(userName)}</div>
          <div class="text-muted d-flex align-items-center gap-1" style="font-size:12px">
            <i class="fa-solid fa-location-dot" style="color:#a06bf5;font-size:10px"></i>
            ${escapeHtml(locName) || 'Ubicación no especificada'} &nbsp;·&nbsp; ${tiempo}
          </div>
        </div>
        <span class="badge ${statusBadgeClass}">${statusLabel}</span>
        <span class="badge feed-priority-badge feed-priority-${priorityClass}">● ${priorityLabel}</span>
      </div>

      <div class="card-body pt-0 pb-2 px-3">
        <div class="fw-bold mb-1" style="font-size:15px;color:#23283b">
          ${escapeHtml(inc.title || 'Sin título')}
          <span class="fw-normal text-muted" style="font-size:13px">INC-${String(inc.id).padStart(4, '0')}</span>
        </div>
        <div class="feed-card-desc text-secondary mb-2" style="font-size:13.5px;line-height:1.55">
          ${escapeHtml(descText)}
        </div>
        ${resolutionHtml}
        ${tagsHtml}
      </div>

      ${mediaHtml}

      <div class="card-footer bg-transparent d-flex align-items-center gap-2 px-3 py-2 feed-card-footer">
        <div class="d-flex gap-1 flex-grow-1 flex-wrap">
          <button class="btn btn-light btn-sm rounded-pill" style="font-size:13px" onclick="event.stopPropagation()">
            <i class="fa-regular fa-comment me-1"></i>
            ${commentCount}
          </button>
          <button class="btn btn-light btn-sm rounded-pill" style="font-size:13px" onclick="event.stopPropagation()">
            <i class="fa-regular fa-eye me-1"></i>Seguir
          </button>
          <button class="btn btn-light btn-sm rounded-pill" style="font-size:13px" onclick="event.stopPropagation()">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>Yo también reporto
          </button>
        </div>
        <button class="feed-action-btn btn btn-primary btn-sm rounded-pill" data-route="/feed/${inc.id}" title="Ver detalle" style="white-space:nowrap" onclick="event.stopPropagation()">
          <i class="fa-solid fa-arrow-up-right-from-square me-1"></i>Ver detalle
        </button>
      </div>
    </div>
  `;
}

// ── Mini-map initializer ──────────────────────────────────

async function initMiniMaps() {
  const containers = document.querySelectorAll(
    '.feed-minimap:not([data-map-init])',
  );
  if (!containers.length) return;

  try {
    await loadLeaflet();
  } catch {
    return;
  }

  containers.forEach((el) => {
    const lat = parseFloat(el.dataset.lat);
    const lng = parseFloat(el.dataset.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    if (el._leaflet_map) return;

    const map = L.map(el, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      attributionControl: false,
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.marker([lat, lng]).addTo(map);

    el._leaflet_map = map;
    el.dataset.mapInit = '';
  });
}

function disposeMiniMaps() {
  document.querySelectorAll('.feed-minimap').forEach((el) => {
    if (el._leaflet_map) {
      el._leaflet_map.remove();
      delete el._leaflet_map;
    }
  });
}

// ── DOM ids (single responsive template) ───────────────────

const LIST = 'feed-list';
const FILTERS = 'feed-filters';
const SKELETON = 'feed-cargando';
const VACIO = 'feed-vacio';
const SENTINEL = 'feed-sentinel';
const SCROLL_REGION = 'feed-scroll-region';
const CHIP_SELECTOR = '.feed-chip';

// ── Component ──────────────────────────────────────────────

export default {
  template,
  style,

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
    // Keyboard parity: Enter / Space on the card root (or any non-button
    // descendant) triggers the same navigation. Internal buttons still
    // fire their own native handlers.
    function navigateFromTarget(target, originalEvent) {
      if (!target) return;
      originalEvent.preventDefault();
      router.navigate(target.dataset.route);
    }

    feedList.addEventListener('click', (e) => {
      const target = e.target.closest('[data-route]');
      if (!target) return;
      navigateFromTarget(target, e);
    });

    feedList.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target.closest('[data-route]');
      if (!target) return;
      if (e.target.closest('button')) return;
      navigateFromTarget(target, e);
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
            disposeMiniMaps();
            listEl.innerHTML = todasLasIncidencias.map(renderCard).join('');
          }
          initMiniMaps();
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

      // The feed-scroll-region is the only scrollable area when the
      // feed is mounted (we force `body.feed-view { overflow: hidden }`
      // in the component CSS to disable the app-shell-main scroll).
      // Scope the IntersectionObserver to it so the infinite-scroll
      // trigger fires when the sentinel reaches its bottom. Guard
      // against a missing root so we don't silently fall back to the
      // viewport (REL-1 fix).
      const root = document.getElementById(SCROLL_REGION);
      if (!root) {
        console.warn(
          '[feed] #feed-scroll-region not found, skipping infinite scroll',
        );
        return;
      }

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
        { root, rootMargin: '0px 0px 200px 0px' },
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
          disposeMiniMaps();
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
          initMiniMaps();
        }
      });
    }

    // ── First load ──
    await fetchIncidencias(1, false);
    setupInfiniteScroll();
  },

  onDestroy() {
    disposeMiniMaps();
    document.body.classList.remove('feed-view');
  },
};
