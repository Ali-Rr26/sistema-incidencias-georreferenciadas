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
  get: vi.fn().mockResolvedValue({ data: [] }),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  patch: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    setAccessToken: mod.setAccessToken,
    clearAuthState: mod.clearAuthState,
    http: mockHttp,
  };
});

// Mock location.service for progressive loading tests
const mockLocationService = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getChildren: vi.fn(),
  invalidateCache: vi.fn(),
}));
vi.mock('../../../shared/location.service.js', () => ({
  locationService: mockLocationService,
}));

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
      <div id="dashboard-error" hidden>
        <span id="dashboard-error-message"></span>
        <button id="dashboard-retry"></button>
      </div>
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

  it('renders the meaningful empty state when there are no resolved incidents yet', async () => {
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
      'Sin datos en este período',
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
      'Sin datos en este período',
    );
  });

  it('shows an inline retry state when GET /incidents/stats fails', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(document.getElementById('dashboard-error').hidden).toBe(false);
    expect(
      document.getElementById('dashboard-error-message').textContent,
    ).toContain('No pudimos cargar las estadísticas');
    expect(document.getElementById('dashboard-retry').textContent).toBe(
      'Reintentar',
    );
  });
});

describe('dashboard — progressive location filter (WU-2 migration)', () => {
  let component;

  const COUNTRIES = [
    { id: 1, name: 'Ecuador', code: 'EC', level: 'country', parent_id: null },
  ];

  const PROVINCES = [
    {
      id: 2,
      name: 'Pichincha',
      code: 'EC-PI',
      level: 'province',
      parent_id: 1,
    },
    { id: 3, name: 'Guayas', code: 'EC-GY', level: 'province', parent_id: 1 },
  ];

  beforeAll(async () => {
    const mod = await import('./dashboard.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.c3 = {};

    document.body.innerHTML = `
      <div id="stat-incidencias">0</div>
      <div id="stat-pendientes">0</div>
      <div id="stat-resueltas">0</div>
      <div id="stat-ubicaciones">0</div>
      <div id="stat-tiempo-resolucion">—</div>
      <div id="filter-inicio"></div>
      <div id="filter-fin"></div>
      <div id="filter-tipo"></div>
      <div id="filter-pais">
        <option value="">-- Seleccione país --</option>
      </div>
      <div id="filter-provincia">
        <option value="">-- Seleccione provincia --</option>
      </div>
      <div id="filter-ciudad">
        <option value="">-- Seleccione ciudad --</option>
      </div>
      <div id="btn-filter-apply"></div>
    `;

    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({ total: 0, by_status: {} });
      }
      if (path === '/incidents?per_page=5') {
        return Promise.resolve({ data: [] });
      }
      if (path === '/incident-categories/tree') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    mockLocationService.getRoots.mockResolvedValue(COUNTRIES);
    mockLocationService.getChildren.mockResolvedValue(PROVINCES);
  });

  afterEach(() => {
    delete window.c3;
  });

  it('loads countries via location.service.getRoots(level=country) on init', async () => {
    await component.onInit();

    expect(mockLocationService.getRoots).toHaveBeenCalledWith({
      level: 'country',
    });
  });

  it('does NOT call /locations/tree anymore (migrated to progressive loading)', async () => {
    await component.onInit();

    // The old endpoint should NOT be called
    const treeCalls = mockHttp.get.mock.calls.filter(
      ([path]) => path === '/locations/tree',
    );
    expect(treeCalls).toHaveLength(0);
  });

  it('disables province select until country is selected', async () => {
    await component.onInit();

    const provinciaSelect = document.getElementById('filter-provincia');
    // Province select should be disabled initially (no country selected)
    expect(provinciaSelect.disabled).toBe(true);
  });

  it('loads provinces when country is selected via locationService.getChildren', async () => {
    await component.onInit();

    // Select Ecuador (country)
    const paisSelect = document.getElementById('filter-pais');
    paisSelect.value = '1';
    paisSelect.dispatchEvent(new Event('change'));

    // Wait for the async province load
    await new Promise(setImmediate);

    expect(mockLocationService.getChildren).toHaveBeenCalledWith({
      parentId: 1,
    });
  });
});

/**
 * dashboard — WU7 "Pendientes de aprobación" stat card.
 *
 * GET /api/incidents/stats now returns `pending_approval` (the number of
 * incidents in `status=resolved` waiting for an admin to approve or
 * reject them). The dashboard renders it into
 * `<article id="stat-pendientes-aprobacion">` inside `.gr-stats-row` and
 * animates the value with the same `animateCounter()` used for the
 * other stat cards. Mirrors the rest of the row: `.gr-stat-card`
 * outer, label/value pair, and a label string of "Pendientes de
 * aprobación" so the user-facing copy matches spec S12 verbatim.
 */
describe('dashboard — WU7 pendientes de aprobación stat card', () => {
  let component;

  beforeAll(async () => {
    const mod = await import('./dashboard.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.c3 = {};

    document.body.innerHTML = `
          <div class="gr-stats-row">
            <div class="gr-stat-card gr-stat-card--orange" data-stat-card id="stat-pendientes-aprobacion">
              <div class="gr-stat-card__left">
                <div>
                  <div class="gr-stat-card__num is-loading" id="stat-pendientes-aprobacion-value">
                    <span class="gr-skeleton gr-skeleton--value"></span>
                  </div>
                  <div class="gr-stat-card__label">Pendientes de aprobación</div>
                </div>
              </div>
              <div class="gr-stat-card__icon">
                <i class="fa-solid fa-clipboard-check"></i>
              </div>
              <div class="gr-stat-card__trend">Incidencias en estado resolved</div>
            </div>
            <div id="stat-tiempo-resolucion">—</div>
            <div id="stat-incidencias">0</div>
            <div id="stat-pendientes">0</div>
            <div id="stat-en-proceso">0</div>
            <div id="stat-resueltas">0</div>
            <div id="stat-ubicaciones">0</div>
          </div>
          <div id="dashboard-error" hidden>
            <span id="dashboard-error-message"></span>
            <button id="dashboard-retry"></button>
          </div>
        `;

    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats') {
        return Promise.resolve({ total: 0, by_status: {} });
      }
      if (path === '/incidents?per_page=5') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    delete window.c3;
  });

  it('renders the count from stats.pending_approval into the new card', async () => {
    let statsCallCount = 0;
    mockHttp.get.mockImplementation((path) => {
      // Match both the bare and query-stringed path. `filterState`
      // is module-level and can leak from a previous test (e.g. the
      // country picker in the "progressive location filter" block),
      // so the dashboard may append `?pais_id=…` to /incidents/stats.
      if (path === '/incidents/stats' || path.startsWith('/incidents/stats?')) {
        statsCallCount += 1;
        return Promise.resolve({
          total: 12,
          by_status: { pending: 5, in_progress: 4, resolved: 3, closed: 0 },
          pending_approval: 3,
        });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    expect(statsCallCount).toBeGreaterThan(0);

    const card = document.getElementById('stat-pendientes-aprobacion');
    expect(card).not.toBeNull();
    // The label is fixed by the template; pin it to keep the user-facing
    // copy locked to the spec ("Pendientes de aprobación" — S12).
    const label = card.querySelector('.gr-stat-card__label');
    expect(label?.textContent).toBe('Pendientes de aprobación');
    // animateCounter() writes to the inner counter element over a few
    // requestAnimationFrame frames. In jsdom rAF fires on the next
    // macrotask, so we yield a few ticks via setTimeout to let the
    // animation settle on the target value before reading the
    // textContent. The duration is 900ms; we yield 1100ms to be safe.
    await new Promise((r) => setTimeout(r, 1100));
    const counter = document.getElementById('stat-pendientes-aprobacion-value');
    expect(counter.textContent.trim()).toBe('3');
  });

  it('falls back to 0 when the backend omits the pending_approval field', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/stats' || path.startsWith('/incidents/stats?')) {
        // Same shape the controller returned before WU7 — no
        // pending_approval key. The component should still render
        // the card and show 0 rather than crashing.
        return Promise.resolve({ total: 0, by_status: {} });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit();

    const card = document.getElementById('stat-pendientes-aprobacion');
    expect(card).not.toBeNull();
    // 0 must be rendered as the empty-state message ("Sin datos en
    // este período"), not as a numeric counter — same convention as
    // the other stat cards when their value is 0.
    await vi.waitUntil(() => card.textContent.includes('Sin datos'));
    expect(card.textContent).toContain('Sin datos');
  });
});
