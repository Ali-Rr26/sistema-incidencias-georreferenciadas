/**
 * Router integration test — shell route mounting with registerShell.
 *
 * Verifies that the router correctly mounts a route inside a registered shell.
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
});
