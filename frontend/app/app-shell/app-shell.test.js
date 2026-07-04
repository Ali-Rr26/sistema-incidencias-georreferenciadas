/**
 * appShell unit tests — lifecycle (T-1.8) and role-specific rendering (T-1.10).
 *
 * Tests the appShell interface (mount + init + destroy + outlet + updateActive)
 * across the three role buckets: admin, citizen, guest.
 */
import { auth } from '../auth/auth.service.js';

const TEMPLATE_HTML = `
<div class="app-shell">
<header class="app-shell-header">
  <button type="button" class="app-shell-sidebar-toggle" id="app-shell-sidebar-toggle" aria-label="Alternar barra lateral" aria-controls="app-shell-sidebar" aria-expanded="true">
<i class="fa-solid fa-angles-left app-shell-sidebar-toggle__icon" aria-hidden="true"></i>
  </button>
  <div class="app-shell-header__brand">GeoReporta</div>

  <!-- Admin-only header (search + user menu) -->
  <div class="app-shell-header__admin" data-show-on-role="admin">
    <input type="text" class="form-control app-shell-header__search" placeholder="Buscar..." />
    <div class="app-shell-user-menu">
      <button class="app-shell-user-menu__trigger" id="app-shell-user-menu-trigger" aria-haspopup="menu" aria-expanded="false">
    <span class="app-shell-user-menu__avatar" id="app-shell-user-avatar">U</span>
    <span class="app-shell-user-menu__name" id="app-shell-user-name">Usuario</span>
      </button>
      <ul role="menu" id="app-shell-user-menu-panel" class="app-shell-user-menu__panel" hidden>
    <li role="menuitem" tabindex="-1" id="app-shell-user-menu-profile" class="app-shell-user-menu__item">Mi perfil</li>
    <li role="menuitem" tabindex="-1" id="app-shell-user-menu-logout" class="app-shell-user-menu__item app-shell-user-menu__item--logout" aria-disabled="false">Cerrar sesión</li>
      </ul>
    </div>
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

</div>
<aside class="app-shell-sidebar" id="app-shell-sidebar">
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
        document.body.replaceChildren(
          Object.assign(document.createElement('div'), {
            id: 'shell-outlet',
          }),
        );
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

    /**
     * Sidebar collapse/expand toggle tests.
     *
     * The toggle button (#app-shell-sidebar-toggle) lives in the header and
     * works in two modes:
     *   - Desktop (>=768px): toggles a persisted collapsed preference that
     *     narrows the grid from 240px to 72px (icon-only). State persists
     *     across sessions via localStorage.
     *   - Mobile (<768px): opens/closes an off-canvas overlay. State is
     *     transient (not persisted) because the sidebar is off-screen by
     *     default on mobile.
     */
    describe('appShell — sidebar toggle', () => {
      // jsdom 25 does not expose localStorage for opaque origins, so we
      // install an in-memory mock for tests that exercise persistence.
      const memoryStorage = (() => {
        const store = new Map();
        return {
          getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
          setItem: vi.fn((k, v) => store.set(k, String(v))),
          removeItem: vi.fn((k) => store.delete(k)),
          clear: vi.fn(() => store.clear()),
        };
      })();

      beforeEach(() => {
        vi.clearAllMocks();
        memoryStorage.clear();
        // Install localStorage before the appShell runs so init() can read
        // the persisted collapsed preference. jsdom returns undefined
        // here, so we stub a fresh in-memory implementation per test.
        Object.defineProperty(window, 'localStorage', {
          value: memoryStorage,
          writable: true,
          configurable: true,
        });
        document.body.replaceChildren(
          Object.assign(document.createElement('div'), {
            id: 'shell-outlet',
          }),
        );
        document.body.removeAttribute('data-role');
        vi.stubGlobal('fetch', mockFetchTemplate());
        try {
          localStorage.clear();
        } catch (_e) {
          /* storage may be disabled in jsdom */
        }
        // Default matchMedia: desktop viewport. Individual tests can override.
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: !/max-width.*7\d{2}/.test(query),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('renders a sidebar toggle button in the header', async () => {
        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const btn = document.getElementById('app-shell-sidebar-toggle');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBeTruthy();
        expect(btn.getAttribute('aria-controls')).toBe('app-shell-sidebar');
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        appShell.destroy();
      });

      it('toggles the desktop collapsed class on the grid container', async () => {
        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const grid = document.querySelector('.app-shell');
        const btn = document.getElementById('app-shell-sidebar-toggle');

        expect(grid.classList.contains('app-shell--sidebar-collapsed')).toBe(false);
        btn.click();
        expect(grid.classList.contains('app-shell--sidebar-collapsed')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
        btn.click();
        expect(grid.classList.contains('app-shell--sidebar-collapsed')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        appShell.destroy();
      });

      it('persists the desktop collapsed preference to localStorage', async () => {
        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const btn = document.getElementById('app-shell-sidebar-toggle');
        btn.click();
        expect(localStorage.getItem('appShell:sidebarCollapsed')).toBe('1');
        btn.click();
        expect(localStorage.getItem('appShell:sidebarCollapsed')).toBe('0');

        appShell.destroy();
      });

      it('restores the desktop collapsed preference on init', async () => {
        try {
          localStorage.setItem('appShell:sidebarCollapsed', '1');
        } catch (_e) {
          /* skip if storage disabled */
        }

        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const grid = document.querySelector('.app-shell');
        const btn = document.getElementById('app-shell-sidebar-toggle');
        expect(grid.classList.contains('app-shell--sidebar-collapsed')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');

        appShell.destroy();
      });

      it('opens the mobile off-canvas overlay when the toggle is clicked', async () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: /max-width.*7\d{2}/.test(query),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const sidebar = document.getElementById('app-shell-sidebar');
        const btn = document.getElementById('app-shell-sidebar-toggle');

        expect(sidebar.classList.contains('is-open')).toBe(false);
        btn.click();
        expect(sidebar.classList.contains('is-open')).toBe(true);
        const backdrop = document.querySelector('.app-shell-sidebar-backdrop');
        expect(backdrop).toBeTruthy();
        expect(backdrop.classList.contains('is-open')).toBe(true);

        btn.click();
        expect(sidebar.classList.contains('is-open')).toBe(false);
        expect(backdrop.classList.contains('is-open')).toBe(false);

        appShell.destroy();
      });

      it('closes the mobile overlay when the backdrop is clicked', async () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: /max-width.*7\d{2}/.test(query),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const btn = document.getElementById('app-shell-sidebar-toggle');
        const sidebar = document.getElementById('app-shell-sidebar');
        btn.click();
        expect(sidebar.classList.contains('is-open')).toBe(true);

        const backdrop = document.querySelector('.app-shell-sidebar-backdrop');
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(sidebar.classList.contains('is-open')).toBe(false);

        appShell.destroy();
      });

      it('closes the mobile overlay when Escape is pressed', async () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: /max-width.*7\d{2}/.test(query),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const btn = document.getElementById('app-shell-sidebar-toggle');
        const sidebar = document.getElementById('app-shell-sidebar');
        btn.click();
        expect(sidebar.classList.contains('is-open')).toBe(true);

        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        expect(sidebar.classList.contains('is-open')).toBe(false);

        appShell.destroy();
      });

      it('destroy() removes the mobile backdrop from the DOM', async () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: /max-width.*7\d{2}/.test(query),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const { appShell } = await import('./app-shell.component.js');
        await appShell.mount();
        await appShell.init();

        const btn = document.getElementById('app-shell-sidebar-toggle');
        btn.click();
        const backdrop = document.querySelector('.app-shell-sidebar-backdrop');
        expect(backdrop).toBeTruthy();

        appShell.destroy();

        expect(document.querySelector('.app-shell-sidebar-backdrop')).toBeFalsy();
      });
    });

describe('appShell — role-specific rendering (T-1.10)', () => {
  let fetchMock;

      beforeEach(() => {
        vi.clearAllMocks();
        document.body.replaceChildren(
          Object.assign(document.createElement('div'), {
            id: 'shell-outlet',
          }),
        );
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

/**
 * User-menu dropdown tests (T-1.11.14) — WAI-ARIA menu-button pattern.
 *
 * Covers REQ-1 through REQ-7 of the navbar-restructuring spec:
 *   - REQ-1: trigger exposes aria-haspopup + toggles aria-expanded
 *   - REQ-2: panel has exactly 2 role="menuitem" items, hidden by default
 *   - REQ-3: "Mi perfil" navigates + closes
 *   - REQ-4: "Cerrar sesión" awaits auth.logout() then redirects + role flip
 *   - REQ-5: Escape closes + restores focus
 *   - REQ-6: outside-click closes; destroy() removes listeners
 *   - REQ-7: mobile CSS fallback present in source
 */
describe('user-menu dropdown (T-1.11)', () => {
  let consoleErrorSpy;

      beforeEach(async () => {
        vi.clearAllMocks();
        document.body.replaceChildren(
          Object.assign(document.createElement('div'), {
            id: 'shell-outlet',
          }),
        );
        document.body.removeAttribute('data-role');
        vi.stubGlobal('fetch', mockFetchTemplate());
        // Set up admin user so init() classifies as 'admin' and populates header.
    vi.spyOn(auth, 'getUser').mockReturnValue({
      id: 1,
      first_name: 'Maria',
      last_name: 'Gonzalez',
      email: 'maria@example.com',
      role: { id: 1, name: 'admin_sistema' },
    });
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'onAuthChange').mockImplementation(() => () => {});
    // auth.me() returns null by default unless overridden — tests that need
    // the header populated override this per-test.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  async function mountAsAdmin() {
    const { appShell } = await import('./app-shell.component.js');
    await appShell.mount();
    const unsub = await appShell.init();
    return { appShell, unsub };
  }

  function refs() {
    return {
      trigger: document.getElementById('app-shell-user-menu-trigger'),
      panel: document.getElementById('app-shell-user-menu-panel'),
      profile: document.getElementById('app-shell-user-menu-profile'),
      logout: document.getElementById('app-shell-user-menu-logout'),
    };
  }

  // Case 1: Open toggle — click trigger → aria-expanded="true", hidden removed.
  it('opens the panel on trigger click (aria-expanded="true", hidden removed)', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel } = refs();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(panel.hasAttribute('hidden')).toBe(true);

      trigger.click();

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(panel.hasAttribute('hidden')).toBe(false);
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 2: Close toggle — second click → hidden re-added, aria-expanded="false".
  it('closes the panel on second trigger click', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel } = refs();
      trigger.click();
      expect(panel.hasAttribute('hidden')).toBe(false);

      trigger.click();

      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 3: Escape closes + restores focus to trigger.
  it('Escape key closes the panel and restores focus to the trigger', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel } = refs();
      trigger.click();
      expect(panel.hasAttribute('hidden')).toBe(false);

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );

      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 4: Mi perfil — hash set + panel closes.
  it('"Mi perfil" sets window.location.hash to "#/configuracion/perfil" and closes the panel', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const hashSpy = vi.fn();
      const originalHash = window.location.hash;
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          get hash() {
            return originalHash;
          },
          set hash(v) {
            hashSpy(v);
          },
        },
        writable: true,
        configurable: true,
      });

      const { trigger, panel, profile } = refs();
      trigger.click();
      expect(panel.hasAttribute('hidden')).toBe(false);

      profile.click();

      expect(hashSpy).toHaveBeenCalledWith('#/configuracion/perfil');
      expect(panel.hasAttribute('hidden')).toBe(true);

      // Restore hash for subsequent tests.
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hash: originalHash },
        writable: true,
        configurable: true,
      });
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 5: Cerrar sesión — awaits auth.logout, redirects, role flips; double-click is no-op.
  it('"Cerrar sesión" calls auth.logout() exactly once, redirects to #/login, and flips role to guest', async () => {
    vi.useFakeTimers();
    // Replace auth.logout with a stub that mirrors the real flow's
    // post-condition: fire _notifyAuthChange() so the registered
    // onAuthChange callback (from appShell.init) flips body[data-role].
    const logoutSpy = vi.spyOn(auth, 'logout').mockImplementation(async () => {
      auth._notifyAuthChange();
    });

    const { appShell, unsub } = await mountAsAdmin();
    try {
      // After logout, getUser() returns null → classifyRole(null) === 'guest'.
      vi.spyOn(auth, 'getUser').mockReturnValue(null);
      // Drain the auth-change microtask queue so the role flip completes
      // before we assert.

      const hashSpy = vi.fn();
      const originalHash = window.location.hash;
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          get hash() {
            return originalHash;
          },
          set hash(v) {
            hashSpy(v);
          },
        },
        writable: true,
        configurable: true,
      });

      const { trigger, panel, logout: logoutItem } = refs();
      trigger.click();
      expect(panel.hasAttribute('hidden')).toBe(false);

      logoutItem.click();

      // auth.logout was called once (the debounce blocks the second click inside 300ms).
      expect(logoutSpy).toHaveBeenCalledTimes(1);

      // Drain microtasks so the await auth.logout() resolves and the
      // auth-change callback finishes its async body.
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(hashSpy).toHaveBeenCalledWith('#/login');
      expect(document.body.dataset.role).toBe('guest');

      // Restore hash.
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hash: originalHash },
        writable: true,
        configurable: true,
      });
    } finally {
      vi.useRealTimers();
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  it('second click on "Cerrar sesión" during 300ms debounce window is a no-op', async () => {
    vi.useFakeTimers();
    const logoutSpy = vi.spyOn(auth, 'logout').mockResolvedValue(undefined);

    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, logout: logoutItem } = refs();
      trigger.click();
      logoutItem.click();
      logoutItem.click(); // second click during debounce
      logoutItem.click(); // third click during debounce

      expect(logoutSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 6: Outside-click closes; destroy() removes listeners.
  it('clicking outside the trigger and panel closes an open panel', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel } = refs();
      trigger.click();
      expect(panel.hasAttribute('hidden')).toBe(false);

      // Dispatch a click outside the trigger/panel subtree.
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  it('destroy() removes the document click listener (subsequent outside-click does not throw)', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    const { trigger, panel } = refs();
    trigger.click();
    expect(panel.hasAttribute('hidden')).toBe(false);

    appShell.destroy();
    if (typeof unsub === 'function') unsub();

    // After destroy, outside click must not throw and must not flip the
    // (already-closed) panel back open.
    expect(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  // Case 7: A11y attributes — aria-haspopup, aria-expanded, role="menu", 2 menuitems.
  it('exposes WAI-ARIA menu-button attributes on trigger and panel', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel } = refs();
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      expect(panel.getAttribute('role')).toBe('menu');

      const items = panel.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(2);
      expect(items[0].textContent.trim()).toBe('Mi perfil');
      expect(items[1].textContent.trim()).toBe('Cerrar sesión');
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });

  // Case 9: No console errors during the dropdown flow.
  it('does not log console.error during the full open → close flow', async () => {
    const { appShell, unsub } = await mountAsAdmin();
    try {
      const { trigger, panel, logout: logoutItem } = refs();
      vi.spyOn(auth, 'logout').mockResolvedValue(undefined);
      trigger.click(); // open
      expect(panel.hasAttribute('hidden')).toBe(false);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ); // close via Escape
      trigger.click(); // open again
      logoutItem.click(); // logout
      await Promise.resolve(); // drain await

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      appShell.destroy();
      if (typeof unsub === 'function') unsub();
    }
  });
});
