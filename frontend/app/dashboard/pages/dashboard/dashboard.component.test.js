/**
 * dashboard component unit tests — average resolution time stat card
 * (Phase 3 — 33bd3210).
 *
 * GET /incidents/stats now returns `average_resolution_time` (an object
 * with `{ days, hours, seconds, formatted }`, or `null` when there are no
 * resolved incidents yet). The dashboard renders it as plain text into
 * #stat-tiempo-resolucion — no counter animation, since animating
 * "days/hours" numerically doesn't make sense.
 *
 * Convention: mock http.service.js directly (perfil.test.js pattern), stub
 * `window.c3` so the C3/D3 lazy-loader short-circuits instead of hanging on
 * unresolved <script> tags in jsdom, and build a minimal DOM fixture with
 * only the ids this test cares about (the counter-animation ids are
 * deliberately omitted so `animateCounter` no-ops rather than kicking off a
 * requestAnimationFrame loop unrelated to this test).
 */

const mockHttp = vi.hoisted(() => ({
  get: vi.fn(),
}));
vi.mock('../../../core/http.service.js', () => ({ http: mockHttp }));

describe('dashboard — average resolution time stat card', () => {
  let component;

  beforeAll(async () => {
    const mod = await import('./dashboard.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Short-circuit loadC3(): if window.c3 is already truthy, the component
    // resolves immediately instead of injecting <script src="..."> tags
    // that never fire onload/onerror under jsdom (which would hang
    // Promise.allSettled in onInit forever).
    window.c3 = {};

    document.body.innerHTML = `
      <div id="stat-tiempo-resolucion">—</div>
    `;

    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents?per_page=5') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    delete window.c3;
  });

  it('renders "Xd Yh" when the average has both days and hours', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({
          total: 10,
          by_status: {},
          average_resolution_time: {
            days: 2,
            hours: 5,
            seconds: 190800,
            formatted: '2 days, 5 hours',
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      '2d 5h',
    );
  });

  it('renders only days when hours is 0', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({
          average_resolution_time: { days: 3, hours: 0, seconds: 259200 },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      '3d',
    );
  });

  it('renders only hours when days is 0', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({
          average_resolution_time: { days: 0, hours: 7, seconds: 25200 },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      '7h',
    );
  });

  it('renders a placeholder ("Sin datos") when there are no resolved incidents yet (null)', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({
          total: 0,
          by_status: {},
          average_resolution_time: null,
        });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      'Sin datos',
    );
  });

  it('renders the placeholder when the field is missing from the response entirely', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({ total: 0, by_status: {} });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      'Sin datos',
    );
  });

  it('renders the placeholder when GET /incidents/stats fails (allSettled swallows the rejection)', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('stat-tiempo-resolucion').textContent).toBe(
      'Sin datos',
    );
  });
});
