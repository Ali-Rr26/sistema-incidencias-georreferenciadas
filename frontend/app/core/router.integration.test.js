/**
 * Router integration test — shell route mounting with registerShell.
 *
 * Verifies that the router correctly mounts a route inside a registered shell.
 *
 * Also covers the role-mismatch guard added in PR #2 of consolidar-layout-unico:
 * when a route is tagged with a `role` and the current user's role does not
 * match (and the tag is not 'both'), the router redirects to that user's
 * home shell.
 */
const layout = vi.hoisted(() => ({
  initPage: vi.fn(),
  initShell: vi.fn(),
}));

vi.mock('../utils/layout.js', () => layout);

import { router } from './router.js';

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe('router integration', () => {
  let fetchMock;

  beforeEach(() => {
    router.routes = [];
    router.currentComponent = null;
    router.resetShell();
    layout.initShell.mockClear();
    layout.initPage.mockClear();
    // Reset role-tracking state introduced by PR #2 (T-2.4).
    if (typeof router.setCurrentUserRole === 'function') {
      router.setCurrentUserRole(null);
    }

    document.body.innerHTML = `
      <div id="main-wrapper">
        <div id="shell-outlet">
          <div id="page-outlet"></div>
        </div>
      </div>
      <div id="auth-outlet"></div>
      <ul id="sidebarnav">
        <li class="sidebar-item">
          <a class="sidebar-link" href="#/dashboard">Dashboard</a>
        </li>
      </ul>
    `;

    // Register admin shell mock (matches the real adminShell interface)
    router.registerShell('admin', {
      mount: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockImplementation(() => layout.initShell()),
      outlet: '#page-outlet',
      updateActive(path) {
        document.querySelectorAll('#sidebarnav .sidebar-item').forEach((li) => {
          const a = li.querySelector(':scope > a.sidebar-link');
          if (!a) return;
          const active = a.getAttribute('href') === `#${path}`;
          li.classList.toggle('selected', active);
          a.classList.toggle('active', active);
        });
      },
    });

    // Register 'app' shell mock (PR #2 — transitional: alongside 'admin' and 'user').
    // The unified appShell introduced in PR #1 mounts under the same #page-outlet,
    // so its mock here mirrors the admin one for outlet purposes.
    router.registerShell('app', {
      mount: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockImplementation(() => layout.initShell()),
      outlet: '#page-outlet',
      updateActive() {
        // No-op: in production, appShell.updateActive toggles
        // .app-shell-nav-item[data-route=...].active.
      },
    });

    window.location.hash = '#/dashboard';
    fetchMock = vi.fn(async (url) => {
      if (url === '/templates/dashboard.html') {
        return htmlResponse('<section id="dashboard-page">Dashboard</section>');
      }

      if (url === '/styles/dashboard.css') {
        return htmlResponse('#dashboard-page { color: rebeccapurple; }');
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts a shell route inside the persistent layout', async () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();

    router.addRoute(
      '/dashboard',
      {
        templateUrl: '/templates/dashboard.html',
        styleUrl: '/styles/dashboard.css',
        onInit,
        onDestroy,
      },
      [],
      'admin',
    );

    await router.resolve();

    expect(layout.initShell).toHaveBeenCalledTimes(1);
    expect(layout.initPage).toHaveBeenCalledTimes(1);
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(document.getElementById('page-outlet').innerHTML).toContain(
      'Dashboard',
    );
    expect(document.getElementById('auth-outlet').innerHTML).toBe('');
    expect(
      document.querySelector('.sidebar-link')?.classList.contains('active'),
    ).toBe(true);
    expect(
      document.querySelector('.sidebar-item')?.classList.contains('selected'),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/templates/dashboard.html', {
      cache: 'no-store',
    });
    expect(fetchMock).toHaveBeenCalledWith('/styles/dashboard.css', {
      cache: 'no-store',
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Role-mismatch guard (PR #2 — T-2.2 + T-2.1 + T-2.4)
  // ──────────────────────────────────────────────────────────────

  it('redirects to the user home when the current user role does not match the route role', async () => {
    const onInit = vi.fn();

    // Citizen is trying to reach an admin-tagged route.
    router.setCurrentUserRole('citizen');

    router.addRoute(
      '/dashboard',
      {
        templateUrl: '/templates/dashboard.html',
        styleUrl: '/styles/dashboard.css',
        onInit,
      },
      [],
      'admin', // shell (existing semantics)
      'admin', // role tag (NEW in PR #2)
    );

    await router.resolve();

    // Citizen's home is /feed. The router must redirect — not mount the page.
    expect(window.location.hash).toBe('#/feed');
    expect(onInit).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // Shell teardown across the shell→full→shell round trip
  // (regression: "second login after logout throws Outlet not found")
  // ──────────────────────────────────────────────────────────────

  it('re-mounts a shell cleanly after a full-page navigation tears it down', async () => {
    // The beforeEach's shell.mount() is a no-op mock, which would mask
    // the bug we want to catch (the router would always throw "Outlet
    // not found" because the page-outlet never gets recreated). Replace
    // 'app' with a mount that ACTUALLY injects the page outlet, and
    // track the call count so we can prove it ran again on the second
    // shell mount.
    router.shells.delete('app');
    router._shellState.delete('app');
    const shellMount = vi.fn().mockImplementation(async () => {
      const shellOutlet = document.getElementById('shell-outlet');
      if (shellOutlet) {
        shellOutlet.innerHTML = '<div id="page-outlet"></div>';
      }
    });
    router.registerShell('app', {
      mount: shellMount,
      init: vi.fn().mockResolvedValue(undefined),
      outlet: '#page-outlet',
      updateActive: vi.fn(),
    });

    const dashboardOnInit = vi.fn();
    router.addRoute(
      '/dashboard',
      {
        templateUrl: '/templates/dashboard.html',
        styleUrl: '/styles/dashboard.css',
        onInit: dashboardOnInit,
        onDestroy: vi.fn(),
      },
      [],
      'app',
      'admin',
    );
    router.addRoute('/login', {
      templateUrl: '/templates/login.html',
      styleUrl: '/styles/login.css',
      onInit: vi.fn(),
      onDestroy: vi.fn(),
    });

    // Add the login template URLs to the fetch mock; the beforeEach's
    // default only knows about dashboard.
    fetchMock.mockImplementation(async (url) => {
      if (url === '/templates/dashboard.html') {
        return htmlResponse('<section id="dashboard-page">Dashboard</section>');
      }
      if (url === '/styles/dashboard.css') {
        return htmlResponse('#dashboard-page {}');
      }
      if (url === '/templates/login.html') {
        return htmlResponse('<form id="login-form"></form>');
      }
      if (url === '/styles/login.css') {
        return htmlResponse('/* */');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    // 1. First shell mount — sanity check that the initial mount works.
    window.location.hash = '#/dashboard';
    await router.resolve();
    expect(shellMount).toHaveBeenCalledTimes(1);
    expect(document.getElementById('page-outlet')).toBeTruthy();
    expect(dashboardOnInit).toHaveBeenCalledTimes(1);

    // 2. Full-page navigation (logout-like). Without the fix this leaves
    //    `_shellState['app'].mounted = true`, which makes step 3 throw
    //    "Outlet not found" because shell.mount() is skipped and
    //    #page-outlet stays missing.
    window.location.hash = '#/login';
    await router.resolve();
    expect(document.getElementById('shell-outlet').innerHTML).toBe('');

    // 3. Back to a shell route. This is the regression check.
    window.location.hash = '#/dashboard';
    await expect(router.resolve()).resolves.not.toThrow();
    // shell.mount ran again — proves _shellState was reset (otherwise
    // the `if (!state.mounted)` branch would skip it).
    expect(shellMount).toHaveBeenCalledTimes(2);
    expect(document.getElementById('page-outlet')).toBeTruthy();
    expect(dashboardOnInit).toHaveBeenCalledTimes(2);
  });
});
