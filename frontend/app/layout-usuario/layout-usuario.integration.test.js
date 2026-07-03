/**
 * Layout Usuario integration test — bottom nav navigation and auth guard.
 *
 * Tests through the userShell interface (mount + init + destroy).
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

    // Need #shell-outlet for userShell.mount() to inject the template
    document.body.innerHTML = `<div id="shell-outlet"></div>`;

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
    const { userShell } = await import('./layout-usuario.component.js');

    // Mount the shell (fetches template via mock and injects into #shell-outlet)
    await userShell.mount();
    await userShell.init();

    const navItems = document.querySelectorAll('.lu-nav-item');
    expect(navItems.length).toBe(5);

    // Check active state initialized (Feed should be active)
    expect(navItems[0].classList.contains('active')).toBe(true);

    userShell.destroy();
  });

  it('updates active state on nav item click', async () => {
    const { userShell } = await import('./layout-usuario.component.js');

    await userShell.mount();
    await userShell.init();

    const navItems = document.querySelectorAll('.lu-nav-item');

    // Click Mapa item (index 1)
    navItems[1].click();

    // Feed should no longer be active
    expect(navItems[0].classList.contains('active')).toBe(false);
    // Mapa should be active
    expect(navItems[1].classList.contains('active')).toBe(true);

    userShell.destroy();
  });

  it('redirects "+" button to create when authenticated', async () => {
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);

    const { userShell } = await import('./layout-usuario.component.js');

    await userShell.mount();
    await userShell.init();

    // Click "+" button
    const plusBtn = document.getElementById('lu-nav-plus');
    plusBtn.click();

    expect(window.location.hash).toBe('#/feed/crear');

    userShell.destroy();
  });

  it('redirects "+" button to login when not authenticated', async () => {
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(false);

    const { userShell } = await import('./layout-usuario.component.js');

    await userShell.mount();
    await userShell.init();

    // Click "+" button
    const plusBtn = document.getElementById('lu-nav-plus');
    plusBtn.click();

    expect(window.location.hash).toBe('#/login');

    userShell.destroy();
  });
});
