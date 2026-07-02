/**
 * appShell unit tests — lifecycle (T-1.8) and role-specific rendering (T-1.10).
 *
 * Tests the appShell interface (mount + init + destroy + outlet + updateActive)
 * across the three role buckets: admin, citizen, guest.
 */
import { auth } from '../auth/auth.service.js';

const TEMPLATE_HTML = `
<header class="app-shell-header">
  <div class="app-shell-header__brand">GeoReporta</div>

  <!-- Admin-only header (search + user menu) -->
  <div class="app-shell-header__admin" data-show-on-role="admin">
    <input type="text" class="form-control app-shell-header__search" placeholder="Buscar..." />
    <button class="app-shell-user-menu__trigger" id="app-shell-user-menu-trigger">
      <span class="app-shell-user-menu__avatar" id="app-shell-user-avatar">U</span>
      <span class="app-shell-user-menu__name" id="app-shell-user-name">Usuario</span>
    </button>
  </div>

  <!-- Citizen header (bell + avatar) -->
  <div class="app-shell-header__citizen" data-show-on-role="citizen">
    <button class="app-shell-header__bell" id="app-shell-bell">
      <i class="fa-regular fa-bell"></i>
    </button>
    <span class="app-shell-avatar" id="app-shell-avatar">?</span>
  </div>

  <!-- Guest header (login button) -->
  <a href="#/login" class="app-shell-login-btn" id="app-shell-login-btn" data-show-on-role="guest">
    Ingresar
  </a>
</header>

<aside class="app-shell-sidebar">
  <!-- Admin sidebar nav -->
  <nav class="app-shell-sidebar__nav" id="app-shell-admin-sidebar" data-show-on-role="admin">
    <ul>
      <li class="app-shell-section"><span>PRINCIPAL</span></li>
      <li><a href="#/dashboard" class="app-shell-nav-item" data-route="/dashboard">Dashboard</a></li>
      <li><a href="#/incidencias" class="app-shell-nav-item" data-route="/incidencias">Incidencias</a></li>
      <li class="app-shell-section"><span>GESTIÓN</span></li>
      <li><a href="#/usuarios" class="app-shell-nav-item" data-route="/usuarios">Usuarios</a></li>
      <li><a href="#/organizaciones" class="app-shell-nav-item" data-route="/organizaciones">Organizaciones</a></li>
      <li><a href="#/localizaciones" class="app-shell-nav-item" data-route="/localizaciones">Localizaciones</a></li>
      <li><a href="#/categorias" class="app-shell-nav-item" data-route="/categorias">Categorías</a></li>
      <li class="app-shell-section"><span>CONFIGURACIÓN</span></li>
      <li><a href="#/configuracion/perfil" class="app-shell-nav-item" data-route="/configuracion/perfil">Perfil</a></li>
    </ul>
  </nav>

  <!-- Citizen sidebar nav -->
  <nav class="app-shell-sidebar__nav" id="app-shell-citizen-sidebar" data-show-on-role="citizen">
    <ul>
      <li><a href="#/feed" class="app-shell-nav-item" data-route="/feed">Inicio</a></li>
      <li><a href="#/mapa" class="app-shell-nav-item" data-route="/mapa">Mapa</a></li>
      <li><a href="#/alertas" class="app-shell-nav-item" data-route="/alertas">Alertas</a></li>
      <li><a href="#/configuracion/perfil" class="app-shell-nav-item" data-route="/configuracion/perfil">Perfil</a></li>
    </ul>
  </nav>
</aside>

<main class="app-shell-main">
  <div id="page-outlet"></div>
</main>

<nav class="app-shell-bottom-nav">
  <!-- Admin bottom nav: 5 items, 3rd slot is "Crear incidencia" -->
  <a href="#/dashboard" class="app-shell-nav-item" data-route="/dashboard" data-show-on-role="admin">
    <i class="fa-solid fa-gauge-high"></i><span>Dashboard</span>
  </a>
  <a href="#/incidencias" class="app-shell-nav-item" data-route="/incidencias" data-show-on-role="admin">
    <i class="fa-solid fa-clipboard-list"></i><span>Incidencias</span>
  </a>
  <a href="#/incidencias/crear" class="app-shell-nav-item app-shell-bottom-nav__create" data-route="/incidencias/crear" data-show-on-role="admin">
    <i class="fa-solid fa-circle-plus"></i><span>Crear</span>
  </a>
  <a href="#/alertas" class="app-shell-nav-item" data-route="/alertas" data-show-on-role="admin">
    <i class="fa-solid fa-bell"></i><span>Alertas</span>
  </a>
  <a href="#/configuracion/perfil" class="app-shell-nav-item" data-route="/configuracion/perfil" data-show-on-role="admin">
    <i class="fa-solid fa-user"></i><span>Perfil</span>
  </a>

  <!-- Citizen bottom nav: 5 items, 3rd slot is "+" plus button -->
  <a href="#/feed" class="app-shell-nav-item" data-route="/feed" data-show-on-role="citizen,guest">
    <i class="fa-solid fa-house"></i><span>Feed</span>
  </a>
  <a href="#/mapa" class="app-shell-nav-item" data-route="/mapa" data-show-on-role="citizen,guest">
    <i class="fa-solid fa-map"></i><span>Mapa</span>
  </a>
  <a href="javascript:void(0)" class="app-shell-nav-item app-shell-bottom-nav__plus" id="app-shell-bottom-plus" data-show-on-role="citizen,guest">
    <i class="fa-solid fa-circle-plus"></i>
  </a>
  <a href="#/alertas" class="app-shell-nav-item" data-route="/alertas" data-show-on-role="citizen,guest">
    <i class="fa-solid fa-bell"></i><span>Alertas</span>
  </a>
  <a href="#/configuracion/perfil" class="app-shell-nav-item" data-route="/configuracion/perfil" data-show-on-role="citizen,guest">
    <i class="fa-solid fa-user"></i><span>Perfil</span>
  </a>
</nav>
`;

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(body),
  };
}

function mockFetchTemplate(templateHtml = TEMPLATE_HTML) {
  return vi.fn(async (url) => {
    if (url.includes('app-shell.component.html')) {
      return htmlResponse(templateHtml);
    }
    return htmlResponse('');
  });
}

describe('appShell — lifecycle (T-1.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `<div id="shell-outlet"></div>`;
    document.body.removeAttribute('data-role');
    vi.stubGlobal('fetch', mockFetchTemplate());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mount() injects template HTML into #shell-outlet', async () => {
    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();

    const outlet = document.getElementById('shell-outlet');
    expect(outlet.querySelector('.app-shell-header')).toBeTruthy();
    expect(outlet.querySelector('.app-shell-sidebar')).toBeTruthy();
    expect(outlet.querySelector('.app-shell-main')).toBeTruthy();
    expect(outlet.querySelector('.app-shell-bottom-nav')).toBeTruthy();
    expect(outlet.querySelector('#page-outlet')).toBeTruthy();
  });

  it('init() sets body.dataset.role', async () => {
    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    const unsub = await appShell.init();

    expect(document.body.dataset.role).toBeTruthy();
    expect(['admin', 'citizen', 'guest']).toContain(document.body.dataset.role);

    if (typeof unsub === 'function') unsub();
  });

  it('outlet property is "#page-outlet"', async () => {
    const { appShell } = await import('./app-shell.component.js');

    expect(appShell.outlet).toBe('#page-outlet');
  });

  it('updateActive(path) toggles .active on matching data-route items', async () => {
    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    await appShell.init();

    // Before: nothing active
    const itemsBefore = document.querySelectorAll('.app-shell-nav-item');
    expect(itemsBefore.length).toBeGreaterThan(0);
    itemsBefore.forEach((item) => {
      expect(item.classList.contains('active')).toBe(false);
    });

    // Activate /incidencias
    appShell.updateActive('/incidencias');

    const active = document.querySelectorAll('.app-shell-nav-item.active');
    expect(active.length).toBeGreaterThan(0);
    active.forEach((item) => {
      expect(item.dataset.route).toBe('/incidencias');
    });

    // Activate a different path — old active should clear
    appShell.updateActive('/dashboard');
    const dashboardActive = document.querySelectorAll(
      '.app-shell-nav-item.active',
    );
    expect(dashboardActive.length).toBeGreaterThan(0);
    dashboardActive.forEach((item) => {
      expect(item.dataset.route).toBe('/dashboard');
    });
  });

  it('destroy() is callable and does not throw', async () => {
    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    await appShell.init();

    expect(() => appShell.destroy()).not.toThrow();
  });
});

describe('appShell — role-specific rendering (T-1.10)', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `<div id="shell-outlet"></div>`;
    document.body.removeAttribute('data-role');
    fetchMock = mockFetchTemplate();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('data-role="admin" renders admin nav items in DOM after init', async () => {
    vi.spyOn(auth, 'getUser').mockReturnValue({
      id: 1,
      first_name: 'Maria',
      last_name: 'Gonzalez',
      email: 'maria@example.com',
      role: { id: 1, name: 'admin_sistema' },
    });

    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    const unsub = await appShell.init();

    expect(document.body.dataset.role).toBe('admin');

    // Admin sidebar nav must be present
    expect(document.getElementById('app-shell-admin-sidebar')).toBeTruthy();

    // Admin-specific sidebar items
    const adminRoutes = [
      '/dashboard',
      '/incidencias',
      '/usuarios',
      '/organizaciones',
      '/localizaciones',
      '/categorias',
      '/configuracion/perfil',
    ];
    adminRoutes.forEach((route) => {
      const item = document.querySelector(
        `#app-shell-admin-sidebar [data-route="${route}"]`,
      );
      expect(item).toBeTruthy();
    });

    // Admin-specific bottom nav items
    const adminBottom = document.querySelector(
      '.app-shell-bottom-nav [data-route="/incidencias/crear"]',
    );
    expect(adminBottom).toBeTruthy();
    expect(adminBottom.textContent).toMatch(/Crear/);

    if (typeof unsub === 'function') unsub();
  });

  it('data-role="citizen" renders citizen nav items in DOM after init', async () => {
    vi.spyOn(auth, 'getUser').mockReturnValue({
      id: 2,
      first_name: 'Juan',
      email: 'juan@example.com',
      role: { id: 5, name: 'usuario' },
    });

    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    const unsub = await appShell.init();

    expect(document.body.dataset.role).toBe('citizen');

    // Citizen sidebar nav must be present
    expect(document.getElementById('app-shell-citizen-sidebar')).toBeTruthy();

    // Citizen-specific sidebar items
    const citizenRoutes = [
      '/feed',
      '/mapa',
      '/alertas',
      '/configuracion/perfil',
    ];
    citizenRoutes.forEach((route) => {
      const item = document.querySelector(
        `#app-shell-citizen-sidebar [data-route="${route}"]`,
      );
      expect(item).toBeTruthy();
    });

    // Citizen bottom nav: 5 items, 3rd is the "+" plus button
    const plusBtn = document.getElementById('app-shell-bottom-plus');
    expect(plusBtn).toBeTruthy();
    expect(plusBtn.classList.contains('app-shell-bottom-nav__plus')).toBe(true);

    if (typeof unsub === 'function') unsub();
  });

  it('data-role="guest" makes the login button visible after init', async () => {
    vi.spyOn(auth, 'getUser').mockReturnValue(null);

    const { appShell } = await import('./app-shell.component.js');

    await appShell.mount();
    const unsub = await appShell.init();

    expect(document.body.dataset.role).toBe('guest');

    // Login button must be present
    const loginBtn = document.getElementById('app-shell-login-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.getAttribute('href')).toBe('#/login');

    if (typeof unsub === 'function') unsub();
  });
});
