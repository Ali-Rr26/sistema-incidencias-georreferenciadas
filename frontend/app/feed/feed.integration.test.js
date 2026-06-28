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

import { auth } from '../auth/auth.service.js';

const FEED_TEMPLATE = `
<div class="feed-desktop-container d-none" id="feed-desktop">
  <div class="feed-main">
    <div class="composer-bar d-none" id="composer-bar">
      <div class="composer-avatar" id="composer-avatar">?</div>
      <div class="composer-input-wrap"><span class="composer-placeholder">¿Qué incidencia deseas reportar hoy?</span></div>
      <a href="#/feed/crear" class="composer-btn"><i class="fas fa-location-dot"></i> Reportar</a>
    </div>
    <div class="feed-filters" id="feed-filters">
      <button class="feed-chip active" data-status="">Todo</button>
      <button class="feed-chip" data-status="pending">Pendientes</button>
      <button class="feed-chip" data-status="in_progress">En proceso</button>
      <button class="feed-chip" data-status="resolved">Resueltos</button>
    </div>
    <div id="feed-cargando" class="feed-skeleton-wrap d-none">
      <div class="feed-skeleton-card"><div class="feed-skel-head"><div class="feed-skel-avatar"></div><div class="feed-skel-line w-40"></div></div><div class="feed-skel-map"></div><div class="feed-skel-body"><div class="feed-skel-line w-60"></div><div class="feed-skel-line w-30"></div></div></div>
    </div>
    <div id="feed-vacio" class="feed-empty d-none"><p>No hay incidencias publicadas.</p></div>
    <div id="feed-list" class="feed-cards"></div>
    <div id="feed-sentinel" class="feed-sentinel"></div>
  </div>
  <aside class="feed-right-panel">
    <div class="rp-card rp-map"><div class="rp-map-placeholder"></div></div>
  </aside>
</div>
<div class="feed-mobile-container" id="feed-mobile">
  <div class="mobile-filters" id="mobile-filters">
    <button class="mobile-chip active" data-status="">Todo</button>
  </div>
  <div id="feed-cargando-mobile" class="feed-skeleton-wrap d-none"></div>
  <div id="feed-vacio-mobile" class="feed-empty d-none"><p>No hay incidencias.</p></div>
  <div id="feed-list-mobile" class="feed-mobile-cards"></div>
  <div id="feed-sentinel-mobile" class="feed-sentinel"></div>
</div>
`;

const MOCK_INCIDENTS = [
  {
    id: 1,
    title: 'Bache en la Av. Principal',
    description: 'Se reporta un bache grande en la avenida principal que ha causado daños a vehículos.',
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
    description: 'Poste de luz en la calle 10 de Agosto no funciona hace una semana.',
    status: 'in_progress',
    priority: 'medium',
    category: { id: 2, name: 'Servicios' },
    geom: { type: 'Point', coordinates: [-80.7125, -0.9480] },
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
    geom: { type: 'Point', coordinates: [-80.7350, -0.9600] },
    location_name: 'Parque Central',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    user: { first_name: 'Ana', last_name: 'Ruiz', avatar: null },
    comments_count: 0,
    votes_count: 8,
  },
];

describe('feed integration', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'getUser').mockReturnValue({ first_name: 'Admin', last_name: 'Test' });

    // Setup admin shell DOM + feed template (as router would)
    document.body.innerHTML = `
      <div id="main-wrapper" style="display:block">
        <div id="page-outlet">${FEED_TEMPLATE}</div>
      </div>
      <div id="auth-outlet"></div>
      <div id="user-wrapper" style="display:none"></div>
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
      if (url.includes('feed.component.html') || url.includes('feed.component.css')) {
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

    // First card should contain the title
    expect(cards[0].textContent).toContain('Bache en la Av. Principal');

    // Status badges
    expect(cards[0].querySelector('.feed-status-pending')).not.toBeNull();
    expect(cards[1].querySelector('.feed-status-in_progress')).not.toBeNull();
    expect(cards[2].querySelector('.feed-status-resolved')).not.toBeNull();

    // "Ver detalle" links
    const detailLinks = feedList.querySelectorAll('a[href^="#/incidencias/"]');
    expect(detailLinks.length).toBe(3);
    expect(detailLinks[0].getAttribute('href')).toBe('#/incidencias/1');

    // Desktop container should be visible
    const desktop = document.getElementById('feed-desktop');
    expect(desktop.classList.contains('d-none')).toBe(false);

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
        return { ok: false, status: 500, json: () => Promise.reject(new Error('fail')) };
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
    expect(firstCard.querySelector('.feed-card-head')).not.toBeNull();
    expect(firstCard.querySelector('.feed-card-title')).not.toBeNull();
    expect(firstCard.querySelector('.feed-card-desc')).not.toBeNull();
    expect(firstCard.querySelector('.feed-card-map')).not.toBeNull();
    expect(firstCard.querySelector('.feed-card-actions')).not.toBeNull();
    expect(firstCard.querySelector('.feed-status-pending')).not.toBeNull();
    expect(firstCard.querySelector('.feed-priority-high')).not.toBeNull();

    feedComponent.onDestroy();
  });
});
