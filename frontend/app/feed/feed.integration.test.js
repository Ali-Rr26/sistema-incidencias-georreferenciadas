/**
 * Feed integration test — mock GET /incidents/feed, verify card rendering.
 *
 * Sets up the DOM as admin shell (desktop mode), loads the feed component,
 * and checks that incident cards are rendered with correct data.
 */
const layout = vi.hoisted(() => ({
  initPage: vi.fn(),
  initShell: vi.fn(),
}));

vi.mock('../utils/layout.js', () => layout);

// Control when the Leaflet loader resolves so we can exercise the TOCTOU
// race: the default (rejection) keeps the pre-existing tests behaving as
// before; the new race test overrides it with a deferred promise.
const leafletLoader = vi.hoisted(() => ({
  loadLeaflet: vi.fn(),
}));

vi.mock('../shared/leaflet.js', () => ({
  default: leafletLoader.loadLeaflet,
}));

import { auth } from '../auth/auth.service.js';

const FEED_TEMPLATE = `
<div id="feed" class="row">
  <div class="col-12 col-lg-8">
    <div class="composer-bar d-none card mb-3" id="composer-bar">
      <div class="card-body d-flex align-items-center gap-3">
        <div class="composer-avatar" id="composer-avatar">?</div>
        <div class="composer-input-wrap flex-grow-1">
          <span class="composer-placeholder">¿Qué incidencia deseas reportar hoy?</span>
        </div>
        <button class="composer-btn btn btn-primary">
          <i class="fa-solid fa-location-dot"></i> Reportar
        </button>
      </div>
    </div>
    <div id="stats-container" class="stats-cards mb-4">
      <div class="stats-card"><div class="stats-value" id="stat-new">14</div><div class="stats-label">Nuevas hoy</div></div>
      <div class="stats-card"><div class="stats-value" id="stat-resolved">8</div><div class="stats-label">Resueltas hoy</div></div>
      <div class="stats-card"><div class="stats-value" id="stat-avg">2.4d</div><div class="stats-label">Promedio resolución</div></div>
    </div>
    <div class="feed-search-input-wrap d-block d-lg-none mb-3">
      <div class="feed-search-input">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="feed-search-input" class="feed-search-input__field" placeholder="Buscar incidencia..." aria-label="Buscar incidencia" />
      </div>
    </div>
    <div class="feed-filter-section mb-4">
      <div class="feed-filter-toggle" id="feed-filter-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="feed-filter-content">
        <div class="fw-bold">Filtrar feed</div>
        <i class="fa-solid fa-chevron-down feed-filter-chevron"></i>
      </div>
      <div id="feed-filter-content" class="feed-filter-content feed-filter-collapsed">
        <div class="feed-filters d-flex flex-wrap gap-2 mt-3" id="feed-filters">
          <button class="feed-chip active btn btn-outline-primary btn-sm" data-status="">Todo</button>
          <button class="feed-chip btn btn-outline-primary btn-sm" data-status="pending">Pendientes</button>
          <button class="feed-chip btn btn-outline-primary btn-sm" data-status="in_progress">En proceso</button>
          <button class="feed-chip btn btn-outline-primary btn-sm" data-status="resolved">Resueltos</button>
        </div>
      </div>
    </div>
    <div id="feed-cargando" class="feed-skeleton-wrap d-none">
      <div class="feed-skeleton-card card">
        <div class="card-body">
          <div class="feed-skel-head d-flex align-items-center gap-2 mb-3">
            <div class="feed-skel-avatar"></div>
            <div class="feed-skel-line w-40"></div>
          </div>
          <div class="feed-skel-preview mb-3"></div>
          <div class="feed-skel-body">
            <div class="feed-skel-line w-60 mb-2"></div>
            <div class="feed-skel-line w-30"></div>
          </div>
        </div>
      </div>
    </div>
    <div id="feed-vacio" class="feed-empty d-none card text-center">
      <div class="card-body">
        <div class="feed-empty-icon">📭</div>
        <p>No hay incidencias publicadas.</p>
      </div>
    </div>
    <div id="feed-scroll-region" class="feed-scroll-region">
      <div id="feed-list" class="feed-cards row g-3"></div>
      <div id="feed-scroll-trigger" class="feed-scroll-trigger" aria-hidden="true"></div>
      <div id="feed-loading" class="feed-loading d-none">
        <div class="feed-spinner"></div>
      </div>
      <div class="feed-footer-message" role="status">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        <span>Has visto todos los incidentes</span>
      </div>
    </div>
  </div>
  <aside class="col-12 col-lg-4 position-sticky top-0 d-none d-lg-block">
    <div class="rp-card card shadow-sm border-0 rounded-3 p-3 mb-3">
      <div class="rp-card-title card-title fw-bold mb-3">Estadísticas hoy</div>
      <div class="rp-stat row align-items-center mb-2">
        <div class="col">
          <div class="rp-stat-value fs-5 fw-bold" id="rp-stat-new">14</div>
          <div class="rp-stat-label small text-muted">Nuevas hoy</div>
        </div>
      </div>
      <div class="rp-stat row align-items-center mb-2">
        <div class="col">
          <div class="rp-stat-value fs-5 fw-bold" id="rp-stat-resolved">8</div>
          <div class="rp-stat-label small text-muted">Resueltas hoy</div>
        </div>
      </div>
      <div class="rp-stat row align-items-center">
        <div class="col">
          <div class="rp-stat-value fs-5 fw-bold" id="rp-stat-avg">2.4 d</div>
          <div class="rp-stat-label small text-muted">Promedio resolución</div>
        </div>
      </div>
    </div>
  </aside>
</div>
`;

const MOCK_INCIDENTS = [
  {
    id: 1,
    title: 'Bache en la Av. Principal',
    description:
      'Se reporta un bache grande en la avenida principal que ha causado daños a vehículos.',
    status: 'pending',
    priority: 'high',
    category: { id: 1, name: 'Infraestructura' },
    geom: { type: 'Point', coordinates: [-80.7286, -0.9537] },
    location_name: 'Av. Principal',
    created_at: new Date().toISOString(),
    user: { first_name: 'María', last_name: 'García', avatar: null },
    comments_count: 3,
    votes_count: 5,
  },
  {
    id: 2,
    title: 'Luminaria dañada',
    description:
      'Poste de luz en la calle 10 de Agosto no funciona hace una semana.',
    status: 'in_progress',
    priority: 'medium',
    category: { id: 2, name: 'Servicios' },
    geom: { type: 'Point', coordinates: [-80.7125, -0.948] },
    location_name: 'Calle 10 de Agosto',
    created_at: new Date().toISOString(),
    user: { first_name: 'Carlos', last_name: 'Mendoza', avatar: null },
    comments_count: 1,
    votes_count: 2,
  },
  {
    id: 3,
    title: 'Árbol caído',
    description: 'Árbol obstruye el paso peatonal en el parque central.',
    status: 'resolved',
    priority: 'low',
    category: { id: 3, name: 'Medio ambiente' },
    geom: { type: 'Point', coordinates: [-80.735, -0.96] },
    location_name: 'Parque Central',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    user: { first_name: 'Ana', last_name: 'Ruiz', avatar: null },
    comments_count: 0,
    votes_count: 8,
  },
];

function makeFakeL() {
  return {
    map: vi.fn(() => ({
      setView: vi.fn(function () {
        return this;
      }),
      remove: vi.fn(),
      invalidateSize: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
  };
}

describe('feed integration', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Leaflet is unavailable in jsdom. The component swallows the
    // rejection, so pre-existing tests keep their current behavior.
    leafletLoader.loadLeaflet.mockRejectedValue(
      new Error('leaflet unavailable in jsdom'),
    );

    // Mock auth
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'getUser').mockReturnValue({
      first_name: 'Admin',
      last_name: 'Test',
    });

    // Setup admin shell DOM + feed template (as router would)
    document.body.innerHTML = `
      <div id="main-wrapper" style="display:block">
        <div id="page-outlet">${FEED_TEMPLATE}</div>
      </div>
      <div id="auth-outlet"></div>
    `;

    fetchMock = vi.fn(async (url) => {
      if (url.includes('/incidents/feed')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              data: MOCK_INCIDENTS,
              meta: { current_page: 1, last_page: 1 },
            }),
        };
      }
      if (url.includes('/incidents/stats')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              total: 3,
              by_status: {
                pending: 1,
                in_progress: 1,
                resolved: 1,
              },
              by_priority: {
                high: 1,
                medium: 1,
                low: 1,
              },
              recent_count: 3,
              locations_count: 3,
              average_resolution_time: {
                formatted: '1d 2h',
                days: 1,
                hours: 2,
                seconds: 93600,
              },
              trends: {
                total_pct: 10.5,
                pendientes_pct: -5.0,
                resolution_rate_pct: 33,
              },
              top_categories: [],
            }),
        };
      }
      if (
        url.includes('feed.component.html') ||
        url.includes('feed.component.css')
      ) {
        return { ok: true, status: 200, text: vi.fn().mockResolvedValue('') };
      }
      return { ok: true, status: 200, text: vi.fn().mockResolvedValue('') };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads feed and renders cards with incident data', async () => {
    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const feedList = document.getElementById('feed-list');
    expect(feedList).not.toBeNull();

    // Verify cards were rendered
    const cards = feedList.querySelectorAll('.feed-card');
    expect(cards.length).toBe(3);

    // First card should contain user info and description
    expect(cards[0].textContent).toContain('MG');
    expect(cards[0].textContent).toContain('Prioridad: Alta');

    // Status badges — soft-fill chip classes
    expect(
      cards[0].querySelector('.feed-status-chip.feed-status-pending'),
    ).not.toBeNull();
    expect(
      cards[1].querySelector('.feed-status-chip.feed-status-in_progress'),
    ).not.toBeNull();
    expect(
      cards[2].querySelector('.feed-status-chip.feed-status-resolved'),
    ).not.toBeNull();

    // "Ver detalle" buttons
    const detailBtns = feedList.querySelectorAll(
      '.feed-action-btn[title="Ver detalle"]',
    );
    expect(detailBtns.length).toBe(3);

    // Single #feed container with Bootstrap row layout
    const feed = document.getElementById('feed');
    expect(feed).not.toBeNull();
    expect(feed.querySelector('.col-lg-8')).not.toBeNull();
    expect(feed.querySelector('.col-lg-4')).not.toBeNull();
    expect(document.getElementById('feed-desktop')).toBeNull();
    expect(document.getElementById('feed-mobile')).toBeNull();

    feedComponent.onDestroy();
  });

  it('shows empty state when no incidents', async () => {
    fetchMock = vi.fn(async (url) => {
      if (url.includes('/incidents/feed')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              data: [],
              meta: { current_page: 1, last_page: 1 },
            }),
        };
      }
      return { ok: true, status: 200, text: vi.fn().mockResolvedValue('') };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const feedList = document.getElementById('feed-list');
    const vacio = document.getElementById('feed-vacio');

    expect(feedList.innerHTML).toBe('');
    expect(vacio.classList.contains('d-none')).toBe(false);

    feedComponent.onDestroy();
  });

  it('shows error state on API failure', async () => {
    fetchMock = vi.fn(async (url) => {
      if (url.includes('/incidents/feed')) {
        return {
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('fail')),
        };
      }
      return { ok: true, status: 200, text: vi.fn().mockResolvedValue('') };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const vacio = document.getElementById('feed-vacio');
    expect(vacio.classList.contains('d-none')).toBe(false);
    const p = vacio.querySelector('p');
    expect(p.textContent).toBe('Error al cargar. Intente de nuevo.');

    feedComponent.onDestroy();
  });

  it('renders cards with correct structure', async () => {
    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const cards = document.querySelectorAll('.feed-card');
    expect(cards.length).toBeGreaterThan(0);

    const firstCard = cards[0];
    expect(firstCard.querySelector('.card-header')).not.toBeNull();
    expect(firstCard.querySelector('.fw-bold')).not.toBeNull();
    // feed-minimap present (incidents have geom, no thumbnail_url), but
    // HIDDEN by default — the toggle button is what actually loads it.
    expect(firstCard.querySelector('.feed-minimap')).not.toBeNull();
    expect(
      firstCard.querySelector('.feed-minimap').classList.contains('d-none'),
    ).toBe(true);
    // Opt-in toggle: "Ver mapa" button is visible, aria-expanded=false
    const toggle = firstCard.querySelector('.feed-map-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.feed-map-toggle__label').textContent).toBe(
      'Ver mapa',
    );
    expect(firstCard.querySelector('.card-body')).not.toBeNull();
    expect(firstCard.querySelector('.card-footer')).not.toBeNull();
    expect(
      firstCard.querySelector('.feed-status-chip.feed-status-pending'),
    ).not.toBeNull();
    expect(firstCard.classList.contains('feed-priority-high')).toBe(true);

    feedComponent.onDestroy();
  });

  it('clicking the map toggle flips aria-expanded and toggles label', async () => {
    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const toggle = document.querySelector('.feed-map-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    const minimap = document.getElementById(`feed-mm-${toggle.dataset.incId}`);
    expect(minimap).not.toBeNull();
    expect(minimap.classList.contains('d-none')).toBe(true);

    // Click → open. Leaflet is not loaded in jsdom, so the map element
    // stays hidden (loadLeaflet() rejects silently in the test env), but
    // the aria/label/visibility state must flip regardless.
    toggle.click();

    // The toggle's own state flips even if Leaflet fails to load.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.querySelector('.feed-map-toggle__label').textContent).toBe(
      'Ocultar mapa',
    );
    expect(minimap.classList.contains('d-none')).toBe(false);

    // Click again → close.
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.feed-map-toggle__label').textContent).toBe(
      'Ver mapa',
    );
    expect(minimap.classList.contains('d-none')).toBe(true);

    feedComponent.onDestroy();
  });

  it('does not build a map when the toggle is collapsed during lazy load (TOCTOU race)', async () => {
    const fakeL = makeFakeL();
    vi.stubGlobal('L', fakeL);

    // Make loadLeaflet() stay pending until we resolve it manually.
    const deferred = {};
    deferred.promise = new Promise((resolve) => {
      deferred.resolve = resolve;
    });
    leafletLoader.loadLeaflet.mockResolvedValueOnce(deferred.promise);

    const { default: feedComponent } = await import('./feed.component.js');
    await feedComponent.onInit();

    const toggle = document.querySelector('.feed-map-toggle');
    expect(toggle).not.toBeNull();
    const container = document.getElementById(
      `feed-mm-${toggle.dataset.incId}`,
    );
    expect(container).not.toBeNull();

    // Expand: async init starts and stays pending.
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.classList.contains('d-none')).toBe(false);
    expect(leafletLoader.loadLeaflet).toHaveBeenCalledTimes(1);

    // Collapse while the load is still pending — the resumed init must NOT
    // build a map for a card the user asked to close.
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.classList.contains('d-none')).toBe(true);
    expect(container._leaflet_map).toBeUndefined();

    // Let the pending load finish and flush the resumed continuation.
    deferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeL.map).not.toHaveBeenCalled();
    expect(container._leaflet_map).toBeUndefined();
    expect(container.classList.contains('d-none')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.feed-map-toggle__label').textContent).toBe(
      'Ver mapa',
    );

    feedComponent.onDestroy();
  });
});
