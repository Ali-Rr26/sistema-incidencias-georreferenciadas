/**
 * Layout Usuario integration test — bottom nav navigation and auth guard.
 *
 * Tests:
 * - Bottom nav renders with 5 items
 * - Active state updates on click
 * - "+" button redirects to create if auth, or login if not
 */
import { auth } from '../auth/auth.service.js';

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe('layout-usuario bottom nav', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set initial hash
    window.location.hash = '#/feed';

    fetchMock = vi.fn(async (url) => {
      if (url.includes('layout-usuario.component.html')) {
        return htmlResponse(`
          <header class="lu-header">
            <div class="lu-header-left">
              <i class="fas fa-location-dot lu-logo-icon"></i>
              <span class="lu-logo-text">GeoReporta</span>
            </div>
            <div class="lu-header-right">
              <a href="#/login" class="lu-login-btn" id="lu-login-btn">Ingresar</a>
            </div>
          </header>
          <main class="lu-main">
            <div id="shell-content"></div>
          </main>
          <nav class="lu-bottom-nav" id="lu-bottom-nav">
            <a href="#/feed" class="lu-nav-item active" data-route="/feed">
              <i class="fas fa-house"></i>
              <span class="lu-nav-label">Feed</span>
            </a>
            <a href="#/feed" class="lu-nav-item" data-route="/mapa">
              <i class="fas fa-map"></i>
              <span class="lu-nav-label">Mapa</span>
            </a>
            <a href="javascript:void(0)" class="lu-nav-item lu-nav-plus" id="lu-nav-plus" data-route="">
              <i class="fas fa-circle-plus"></i>
            </a>
            <a href="#/feed" class="lu-nav-item" data-route="/alertas">
              <i class="fas fa-bell"></i>
              <span class="lu-nav-label">Alertas</span>
            </a>
            <a href="#/configuracion/perfil" class="lu-nav-item" data-route="/configuracion/perfil">
              <i class="fas fa-user"></i>
              <span class="lu-nav-label">Perfil</span>
            </a>
          </nav>
        `);
      }
      return htmlResponse('');
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders 5 bottom nav items', async () => {
    const { default: layoutComponent } =
      await import('./layout-usuario.component.js');

    // Need the layout template in DOM before onInit
    document.body.innerHTML = `
      <nav class="lu-bottom-nav" id="lu-bottom-nav">
        <a href="#/feed" class="lu-nav-item active" data-route="/feed">
          <i class="fas fa-house"></i>
          <span class="lu-nav-label">Feed</span>
        </a>
        <a href="#/feed" class="lu-nav-item" data-route="/mapa">
          <i class="fas fa-map"></i>
          <span class="lu-nav-label">Mapa</span>
        </a>
        <a href="javascript:void(0)" class="lu-nav-item lu-nav-plus" id="lu-nav-plus" data-route="">
          <i class="fas fa-circle-plus"></i>
        </a>
        <a href="#/feed" class="lu-nav-item" data-route="/alertas">
          <i class="fas fa-bell"></i>
          <span class="lu-nav-label">Alertas</span>
        </a>
        <a href="#/configuracion/perfil" class="lu-nav-item" data-route="/configuracion/perfil">
          <i class="fas fa-user"></i>
          <span class="lu-nav-label">Perfil</span>
        </a>
      </nav>
    `;

    await layoutComponent.onInit();

    const navItems = document.querySelectorAll('.lu-nav-item');
    expect(navItems.length).toBe(5);

    // Check active state initialized (Feed should be active)
    expect(navItems[0].classList.contains('active')).toBe(true);

    layoutComponent.onDestroy();
  });

  it('updates active state on nav item click', async () => {
    const { default: layoutComponent } =
      await import('./layout-usuario.component.js');

    document.body.innerHTML = `
      <nav class="lu-bottom-nav" id="lu-bottom-nav">
        <a href="#/feed" class="lu-nav-item active" data-route="/feed">
          <i class="fas fa-house"></i>
          <span class="lu-nav-label">Feed</span>
        </a>
        <a href="#/feed" class="lu-nav-item" data-route="/mapa">
          <i class="fas fa-map"></i>
          <span class="lu-nav-label">Mapa</span>
        </a>
        <a href="javascript:void(0)" class="lu-nav-item lu-nav-plus" data-route="">
          <i class="fas fa-circle-plus"></i>
        </a>
      </nav>
    `;

    await layoutComponent.onInit();

    const navItems = document.querySelectorAll('.lu-nav-item');

    // Click Mapa item (index 1)
    navItems[1].click();

    // Feed should no longer be active
    expect(navItems[0].classList.contains('active')).toBe(false);
    // Mapa should be active
    expect(navItems[1].classList.contains('active')).toBe(true);

    layoutComponent.onDestroy();
  });

  it('redirects "+" button to create when authenticated', async () => {
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);

    const { default: layoutComponent } =
      await import('./layout-usuario.component.js');

    document.body.innerHTML = `
      <nav class="lu-bottom-nav" id="lu-bottom-nav">
        <a href="javascript:void(0)" class="lu-nav-item lu-nav-plus" id="lu-nav-plus" data-route="">
          <i class="fas fa-circle-plus"></i>
        </a>
      </nav>
    `;

    await layoutComponent.onInit();

    // Click "+" button
    const plusBtn = document.getElementById('lu-nav-plus');
    plusBtn.click();

    expect(window.location.hash).toBe('#/feed/crear');

    layoutComponent.onDestroy();
  });

  it('redirects "+" button to login when not authenticated', async () => {
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(false);

    const { default: layoutComponent } =
      await import('./layout-usuario.component.js');

    document.body.innerHTML = `
      <nav class="lu-bottom-nav" id="lu-bottom-nav">
        <a href="javascript:void(0)" class="lu-nav-item lu-nav-plus" id="lu-nav-plus" data-route="">
          <i class="fas fa-circle-plus"></i>
        </a>
      </nav>
    `;

    window.location.hash = '#/feed';

    await layoutComponent.onInit();

    // Click "+" button
    const plusBtn = document.getElementById('lu-nav-plus');
    plusBtn.click();

    expect(window.location.hash).toBe('#/login');

    layoutComponent.onDestroy();
  });
});
