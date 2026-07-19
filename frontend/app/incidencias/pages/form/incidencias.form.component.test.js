/**
 * incidencias.form component unit tests — category/subcategory dropdown
 * reactivity (Phase 3 — 33bd3210).
 *
 * The create/edit form was split from a single flat category select into a
 * parent (`ici-category`) + dynamic child (`ici-subcategory`) pair fed by
 * GET /incident-categories/tree. These tests pin:
 *   - selecting a parent populates the subcategory select with its children
 *   - changing the parent resets/reloads the subcategory list (including
 *     the "no children" and "no parent selected" placeholder states)
 *   - edit-mode preload resolves whether the incident's existing category
 *     is a root node or a child node, and preselects both selects
 *     accordingly
 *
 * Follows the perfil.test.js / feed-detail.test.js convention: mock
 * http.service.js + router.js + init-map-view.js directly (vi.mock), build
 * a minimal DOM fixture with just the ids the component touches
 * unconditionally, then call onInit() directly — the router's template
 * fetch is out of scope for this component (onInit assumes the markup is
 * already in the DOM).
 */

const mockHttp = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('../../../core/http.service.js', () => ({ http: mockHttp }));

const mockRouter = vi.hoisted(() => ({
  queryParams: new URLSearchParams(),
  navigate: vi.fn(),
}));
vi.mock('../../../core/router.js', () => ({ router: mockRouter }));

// initMapView is heavy (Leaflet + tile layer); mock it so onInit doesn't
// bail out early (`if (!map) return;`) or touch the real Leaflet global.
function makeFakeMap() {
  return {
    on: vi.fn(),
    setView: vi.fn(),
    getZoom: vi.fn(() => 13),
    invalidateSize: vi.fn(),
  };
}
const fakeMap = makeFakeMap();
vi.mock('../../../shared/init-map-view.js', () => ({
  default: vi.fn(async () => ({ map: fakeMap, remove: vi.fn() })),
}));

function makeFakeMarker() {
  const marker = {
    setLatLng: vi.fn(),
    on: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
  };
  marker.addTo = vi.fn(() => marker);
  return marker;
}

const categoryTreeFixture = [
  {
    id: 1,
    name: 'Infraestructura',
    children: [
      { id: 11, name: 'Baches', parent_id: 1 },
      { id: 12, name: 'Alumbrado', parent_id: 1 },
    ],
  },
  {
    id: 2,
    name: 'Seguridad',
    children: [],
  },
];

// Rooted at the single country node — provinceSelect only ever sees its
// direct children, mirroring the real GET /locations/tree shape (country
// → province → city → neighborhood).
const locationTreeFixture = [
  {
    id: 100,
    name: 'Ecuador',
    children: [
      {
        id: 200,
        name: 'Pichincha',
        children: [
          {
            id: 300,
            name: 'Quito',
            children: [
              { id: 400, name: 'La Mariscal', parent_id: 300 },
              { id: 401, name: 'Iñaquito', parent_id: 300 },
            ],
          },
          {
            id: 301,
            name: 'Rumiñahui',
            children: [],
          },
        ],
      },
      {
        id: 201,
        name: 'Guayas',
        children: [],
      },
    ],
  },
];

function buildFormDom() {
  document.body.innerHTML = `
    <h1 id="ici-page-title"></h1>
    <span id="ici-breadcrumb-active"></span>
    <h5 id="ici-card-title"></h5>
    <div id="ici-error" class="d-none"></div>

    <ol id="ici-stepper">
      <li id="ici-stepper-1"></li>
      <li id="ici-stepper-2"></li>
      <li id="ici-stepper-3"></li>
      <li id="ici-stepper-4"></li>
    </ol>

    <form id="ici-form">
      <div id="ici-step-1" class="ici-step">
        <input type="text" id="ici-title" />
        <div id="ici-error-title"></div>
        <small id="ici-char-counter-title"></small>
        <select id="ici-priority">
          <option value="">-- Seleccione --</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <div id="ici-error-priority"></div>
        <textarea id="ici-description"></textarea>
        <div id="ici-error-description"></div>
        <small id="ici-char-counter-description"></small>
      </div>

      <div id="ici-step-2" class="ici-step d-none">
        <select id="ici-category">
          <option value="">-- Seleccione categoría --</option>
        </select>
        <div id="ici-error-category"></div>
        <select id="ici-subcategory" disabled>
          <option value="">-- Seleccione una categoría primero --</option>
        </select>
        <div id="ici-error-subcategory"></div>
        <select id="ici-location-province">
          <option value="">-- Sin ubicación fija --</option>
        </select>
        <select id="ici-location-city" disabled>
          <option value="">-- Seleccione una provincia primero --</option>
        </select>
        <select id="ici-location-neighborhood" disabled>
          <option value="">-- Seleccione un cantón primero --</option>
        </select>
        <div id="ici-error-location"></div>
        <input type="file" id="ici-images" multiple />
        <div id="ici-image-preview"></div>
      </div>

      <div id="ici-step-3" class="ici-step d-none">
        <div id="ici-map"></div>
        <div id="ici-error-geom"></div>
        <button type="button" id="ici-btn-geo"></button>
      </div>

      <div id="ici-step-4" class="ici-step d-none">
        <a href="#" id="ici-review-edit-1"></a>
        <span id="ici-review-title"></span>
        <span id="ici-review-priority"></span>
        <span id="ici-review-description"></span>
        <a href="#" id="ici-review-edit-2"></a>
        <span id="ici-review-category"></span>
        <span id="ici-review-location"></span>
        <span id="ici-review-images-count"></span>
        <a href="#" id="ici-review-edit-3"></a>
        <span id="ici-review-coords"></span>
      </div>

      <button type="button" id="ici-btn-prev"></button>
      <a href="#/incidencias" id="ici-btn-cancel"></a>
      <button type="button" id="ici-btn-next"></button>
      <button type="submit" id="ici-submit">
        <span id="ici-submit-text">
          <span id="ici-submit-btn-text"></span>
        </span>
        <span id="ici-submit-loading" class="d-none"></span>
      </button>
    </form>

    <div id="ici-toast">
      <span id="ici-toast-text"></span>
    </div>
  `;
}

/** Simulates a map click by invoking the handler registered via `map.on('click', ...)`. */
function clickMap(lat, lng) {
  const call = fakeMap.on.mock.calls.find(([evt]) => evt === 'click');
  call[1]({ latlng: { lat, lng } });
}

describe('incidencias.form — category/subcategory dropdown reactivity', () => {
  let component;

  beforeAll(async () => {
    const mod = await import('./incidencias.form.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    buildFormDom();
    vi.stubGlobal('L', { marker: vi.fn(() => makeFakeMarker()) });
    mockRouter.queryParams = new URLSearchParams();
    mockRouter.navigate.mockClear();

    mockHttp.get.mockImplementation((path) => {
      if (path === '/incident-categories/tree') {
        return Promise.resolve({ data: categoryTreeFixture });
      }
      if (path === '/locations/tree') {
        return Promise.resolve({ data: locationTreeFixture });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    component.onDestroy?.();
  });

  it('renders the parent category select with the root nodes from the tree', async () => {
    await component.onInit();

    const catSelect = document.getElementById('ici-category');
    const options = Array.from(catSelect.options).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));

    expect(options).toEqual([
      { value: '', text: '-- Seleccione categoría --' },
      { value: '1', text: 'Infraestructura' },
      { value: '2', text: 'Seguridad' },
    ]);
    // Subcategory starts disabled until a parent is picked.
    expect(document.getElementById('ici-subcategory').disabled).toBe(true);
  });

  it('selecting a parent with children populates the subcategory select', async () => {
    await component.onInit();

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));

    const subcatSelect = document.getElementById('ici-subcategory');
    expect(subcatSelect.disabled).toBe(false);
    const options = Array.from(subcatSelect.options).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));
    expect(options).toEqual([
      { value: '', text: '-- Seleccione subcategoría (opcional) --' },
      { value: '11', text: 'Baches' },
      { value: '12', text: 'Alumbrado' },
    ]);
  });

  it('selecting a parent with no children disables the subcategory select', async () => {
    await component.onInit();

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '2';
    catSelect.dispatchEvent(new Event('change'));

    const subcatSelect = document.getElementById('ici-subcategory');
    expect(subcatSelect.disabled).toBe(true);
    expect(subcatSelect.options.length).toBe(1);
    expect(subcatSelect.options[0].textContent).toBe('-- Sin subcategorías --');
  });

  it('changing the parent back to the placeholder resets the subcategory list', async () => {
    await component.onInit();

    const catSelect = document.getElementById('ici-category');
    const subcatSelect = document.getElementById('ici-subcategory');

    // First pick a parent with children...
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    expect(subcatSelect.disabled).toBe(false);

    // ...then reset to "no parent selected".
    catSelect.value = '';
    catSelect.dispatchEvent(new Event('change'));

    expect(subcatSelect.disabled).toBe(true);
    expect(subcatSelect.options.length).toBe(1);
    expect(subcatSelect.options[0].textContent).toBe(
      '-- Seleccione una categoría primero --',
    );
  });

  it('re-selecting a different parent reloads the subcategory list (no stale options)', async () => {
    await component.onInit();

    const catSelect = document.getElementById('ici-category');
    const subcatSelect = document.getElementById('ici-subcategory');

    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    expect(subcatSelect.options.length).toBe(3); // placeholder + 2 children

    catSelect.value = '2';
    catSelect.dispatchEvent(new Event('change'));
    // Stale "Baches"/"Alumbrado" options from the previous parent must be gone.
    expect(subcatSelect.options.length).toBe(1);
    expect(
      Array.from(subcatSelect.options).some((o) => o.textContent === 'Baches'),
    ).toBe(false);
  });

  describe('edit mode — preload resolves root vs. child category', () => {
    beforeEach(() => {
      mockRouter.queryParams = new URLSearchParams('id=42');
    });

    it('preselects the parent select when the incident category is a root node', async () => {
      mockHttp.get.mockImplementation((path) => {
        if (path === '/incident-categories/tree') {
          return Promise.resolve({ data: categoryTreeFixture });
        }
        if (path === '/locations/tree') return Promise.resolve({ data: [] });
        if (path === '/incidents/42') {
          return Promise.resolve({
            data: {
              id: 42,
              title: 'Bache en la vía',
              description: '',
              priority: 'medium',
              incident_category_id: 2, // root, no children
              location_id: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      await component.onInit();

      const catSelect = document.getElementById('ici-category');
      const subcatSelect = document.getElementById('ici-subcategory');
      expect(catSelect.value).toBe('2');
      expect(subcatSelect.disabled).toBe(true);
      expect(subcatSelect.value).toBe('');
    });

    it('preselects both the parent and the child select when the incident category is a child node', async () => {
      mockHttp.get.mockImplementation((path) => {
        if (path === '/incident-categories/tree') {
          return Promise.resolve({ data: categoryTreeFixture });
        }
        if (path === '/locations/tree') return Promise.resolve({ data: [] });
        if (path === '/incidents/42') {
          return Promise.resolve({
            data: {
              id: 42,
              title: 'Poste sin luz',
              description: '',
              priority: 'high',
              incident_category_id: 12, // child of "Infraestructura" (1)
              location_id: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      await component.onInit();

      const catSelect = document.getElementById('ici-category');
      const subcatSelect = document.getElementById('ici-subcategory');
      expect(catSelect.value).toBe('1');
      expect(subcatSelect.disabled).toBe(false);
      expect(subcatSelect.value).toBe('12');
    });
  });

  describe('location cascade — Provincia → Cantón → Parroquia', () => {
    it("renders the province select with the country node's direct children", async () => {
      await component.onInit();

      const provinceSelect = document.getElementById('ici-location-province');
      const options = Array.from(provinceSelect.options).map((o) => ({
        value: o.value,
        text: o.textContent,
      }));

      expect(options).toEqual([
        { value: '', text: '-- Sin ubicación fija --' },
        { value: '200', text: 'Pichincha' },
        { value: '201', text: 'Guayas' },
      ]);
      expect(document.getElementById('ici-location-city').disabled).toBe(true);
      expect(
        document.getElementById('ici-location-neighborhood').disabled,
      ).toBe(true);
    });

    it('selecting a province populates the city select', async () => {
      await component.onInit();

      const provinceSelect = document.getElementById('ici-location-province');
      provinceSelect.value = '200';
      provinceSelect.dispatchEvent(new Event('change'));

      const citySelect = document.getElementById('ici-location-city');
      expect(citySelect.disabled).toBe(false);
      const options = Array.from(citySelect.options).map((o) => ({
        value: o.value,
        text: o.textContent,
      }));
      expect(options).toEqual([
        { value: '', text: '-- Seleccione cantón --' },
        { value: '300', text: 'Quito' },
        { value: '301', text: 'Rumiñahui' },
      ]);
    });

    it('selecting a city with neighborhoods populates the (optional) neighborhood select', async () => {
      await component.onInit();

      const provinceSelect = document.getElementById('ici-location-province');
      provinceSelect.value = '200';
      provinceSelect.dispatchEvent(new Event('change'));

      const citySelect = document.getElementById('ici-location-city');
      citySelect.value = '300'; // Quito
      citySelect.dispatchEvent(new Event('change'));

      const neighborhoodSelect = document.getElementById(
        'ici-location-neighborhood',
      );
      expect(neighborhoodSelect.disabled).toBe(false);
      const options = Array.from(neighborhoodSelect.options).map((o) => ({
        value: o.value,
        text: o.textContent,
      }));
      expect(options).toEqual([
        { value: '', text: '-- Seleccione parroquia (opcional) --' },
        { value: '400', text: 'La Mariscal' },
        { value: '401', text: 'Iñaquito' },
      ]);
    });

    it('selecting a city with no neighborhoods disables the neighborhood select', async () => {
      await component.onInit();

      const provinceSelect = document.getElementById('ici-location-province');
      provinceSelect.value = '200';
      provinceSelect.dispatchEvent(new Event('change'));

      const citySelect = document.getElementById('ici-location-city');
      citySelect.value = '301'; // Rumiñahui, no children
      citySelect.dispatchEvent(new Event('change'));

      const neighborhoodSelect = document.getElementById(
        'ici-location-neighborhood',
      );
      expect(neighborhoodSelect.disabled).toBe(true);
      expect(neighborhoodSelect.options.length).toBe(1);
      expect(neighborhoodSelect.options[0].textContent).toBe(
        '-- Sin parroquias --',
      );
    });

    it('resetting the province back to the placeholder resets city and neighborhood', async () => {
      await component.onInit();

      const provinceSelect = document.getElementById('ici-location-province');
      const citySelect = document.getElementById('ici-location-city');

      provinceSelect.value = '200';
      provinceSelect.dispatchEvent(new Event('change'));
      citySelect.value = '300';
      citySelect.dispatchEvent(new Event('change'));
      expect(citySelect.disabled).toBe(false);

      provinceSelect.value = '';
      provinceSelect.dispatchEvent(new Event('change'));

      expect(citySelect.disabled).toBe(true);
      expect(citySelect.options.length).toBe(1);
      expect(citySelect.options[0].textContent).toBe(
        '-- Seleccione una provincia primero --',
      );
    });
  });

  describe('edit mode — preload resolves city vs. neighborhood location', () => {
    beforeEach(() => {
      mockRouter.queryParams = new URLSearchParams('id=42');
    });

    it('preselects province + city when the incident location is a city node with no neighborhood', async () => {
      mockHttp.get.mockImplementation((path) => {
        if (path === '/incident-categories/tree') {
          return Promise.resolve({ data: categoryTreeFixture });
        }
        if (path === '/locations/tree') {
          return Promise.resolve({ data: locationTreeFixture });
        }
        if (path === '/incidents/42') {
          return Promise.resolve({
            data: {
              id: 42,
              title: 'Bache en la vía',
              description: '',
              priority: 'medium',
              incident_category_id: 2,
              location_id: 301, // Rumiñahui (city, no neighborhood)
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      await component.onInit();

      expect(document.getElementById('ici-location-province').value).toBe(
        '200',
      );
      expect(document.getElementById('ici-location-city').value).toBe('301');
      expect(
        document.getElementById('ici-location-neighborhood').disabled,
      ).toBe(true);
    });

    it('preselects province + city + neighborhood when the incident location is a neighborhood node', async () => {
      mockHttp.get.mockImplementation((path) => {
        if (path === '/incident-categories/tree') {
          return Promise.resolve({ data: categoryTreeFixture });
        }
        if (path === '/locations/tree') {
          return Promise.resolve({ data: locationTreeFixture });
        }
        if (path === '/incidents/42') {
          return Promise.resolve({
            data: {
              id: 42,
              title: 'Poste sin luz',
              description: '',
              priority: 'high',
              incident_category_id: 2,
              location_id: 400, // La Mariscal (neighborhood of Quito)
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      await component.onInit();

      expect(document.getElementById('ici-location-province').value).toBe(
        '200',
      );
      expect(document.getElementById('ici-location-city').value).toBe('300');
      expect(document.getElementById('ici-location-neighborhood').value).toBe(
        '400',
      );
    });
  });
});

describe('incidencias.form — 4-step stepper', () => {
  let component;

  beforeAll(async () => {
    const mod = await import('./incidencias.form.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    buildFormDom();
    vi.stubGlobal('L', { marker: vi.fn(() => makeFakeMarker()) });
    mockRouter.queryParams = new URLSearchParams();
    mockRouter.navigate.mockClear();

    mockHttp.get.mockImplementation((path) => {
      if (path === '/incident-categories/tree') {
        return Promise.resolve({ data: categoryTreeFixture });
      }
      if (path === '/locations/tree') {
        return Promise.resolve({ data: locationTreeFixture });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    component.onDestroy?.();
  });

  function fillStep1(overrides = {}) {
    document.getElementById('ici-title').value =
      overrides.title ?? 'Fuga de agua';
    document.getElementById('ici-priority').value =
      overrides.priority ?? 'high';
  }

  function step(n) {
    return document.getElementById('ici-step-' + n);
  }

  it('starts on step 1 with prev/submit hidden and cancel/next visible', async () => {
    await component.onInit();

    expect(step(1).classList.contains('d-none')).toBe(false);
    expect(step(2).classList.contains('d-none')).toBe(true);
    expect(step(3).classList.contains('d-none')).toBe(true);
    expect(step(4).classList.contains('d-none')).toBe(true);
    expect(document.getElementById('ici-btn-prev').classList).toContain(
      'd-none',
    );
    expect(document.getElementById('ici-submit').classList).toContain('d-none');
    expect(document.getElementById('ici-btn-cancel').classList).not.toContain(
      'd-none',
    );
    expect(document.getElementById('ici-btn-next').classList).not.toContain(
      'd-none',
    );
  });

  it('shows only Cancelar/Siguiente synchronously, before any fetch resolves', async () => {
    // No `await` yet — assert on the state left behind by the
    // synchronous portion of onInit(), before it yields at its first
    // `await` (Leaflet map init). This is what a user would see during
    // the categories/locations/map loading window.
    const pending = component.onInit();

    expect(document.getElementById('ici-btn-prev').classList).toContain(
      'd-none',
    );
    expect(document.getElementById('ici-submit').classList).toContain('d-none');
    expect(document.getElementById('ici-btn-cancel').classList).not.toContain(
      'd-none',
    );
    expect(document.getElementById('ici-btn-next').classList).not.toContain(
      'd-none',
    );

    await pending;
  });

  it('Siguiente already works (not a dead button) before categories/locations resolve', async () => {
    let resolveCategories;
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incident-categories/tree') {
        return new Promise((resolve) => {
          resolveCategories = () => resolve({ data: categoryTreeFixture });
        });
      }
      if (path === '/locations/tree') {
        return Promise.resolve({ data: locationTreeFixture });
      }
      return Promise.resolve({ data: [] });
    });

    const pending = component.onInit();
    fillStep1();

    // Let the map-init await resolve so onInit reaches (and calls)
    // the categories fetch above, which is what constructs the
    // controlled, still-pending promise and captures
    // `resolveCategories` — without actually resolving it yet.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Click Siguiente while the categories fetch is still pending —
    // step 1 -> 2 doesn't need that data, so it must not be a dead
    // button and must not throw (TDZ) either.
    document.getElementById('ici-btn-next').click();

    expect(step(1).classList.contains('d-none')).toBe(true);
    expect(step(2).classList.contains('d-none')).toBe(false);

    resolveCategories();
    await pending;
  });

  it('blocks advancing past step 1 without title and priority', async () => {
    await component.onInit();

    document.getElementById('ici-btn-next').click();

    expect(step(1).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-error-title').textContent).toMatch(
      /obligatorio/i,
    );
    expect(document.getElementById('ici-error-priority').textContent).toMatch(
      /prioridad/i,
    );
  });

  it('advances to step 2 once title and priority are filled', async () => {
    await component.onInit();
    fillStep1();

    document.getElementById('ici-btn-next').click();

    expect(step(1).classList.contains('d-none')).toBe(true);
    expect(step(2).classList.contains('d-none')).toBe(false);
  });

  it('blocks advancing past step 2 without a category', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2

    document.getElementById('ici-btn-next').click();

    expect(step(2).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-error-category').textContent).toMatch(
      /categoría/i,
    );
  });

  it('blocks advancing past step 3 without a map marker', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    document.getElementById('ici-btn-next').click(); // -> step 3

    document.getElementById('ici-btn-next').click();

    expect(step(3).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-error-geom').textContent).toMatch(
      /ubicación en el mapa/i,
    );
  });

  it('reaches step 4 and renders a live review summary', async () => {
    await component.onInit();
    fillStep1({ title: 'Bache profundo', priority: 'medium' });
    document.getElementById('ici-btn-next').click(); // -> step 2

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    const subcatSelect = document.getElementById('ici-subcategory');
    subcatSelect.value = '11';
    document.getElementById('ici-btn-next').click(); // -> step 3

    clickMap(10, 20);
    document.getElementById('ici-btn-next').click(); // -> step 4

    expect(step(4).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-review-title').textContent).toBe(
      'Bache profundo',
    );
    expect(document.getElementById('ici-review-priority').textContent).toBe(
      'Media',
    );
    expect(document.getElementById('ici-review-category').textContent).toBe(
      'Baches',
    );
    expect(document.getElementById('ici-review-coords').textContent).toBe(
      'Lat: 10, Lng: 20',
    );
    expect(document.getElementById('ici-btn-next').classList).toContain(
      'd-none',
    );
    expect(document.getElementById('ici-submit').classList).not.toContain(
      'd-none',
    );
  });

  it('invalidates the Leaflet map size the moment step 3 becomes visible', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2
    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));

    expect(fakeMap.invalidateSize).not.toHaveBeenCalled();

    document.getElementById('ici-btn-next').click(); // -> step 3

    expect(fakeMap.invalidateSize).toHaveBeenCalled();
  });

  it('review summary never shows a province-only selection as saved location (it would submit as null)', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));

    // Province chosen, city/neighborhood left blank — mirrors the
    // submit handler, which drops a province-only pick to
    // location_id: null (no province-level fallback).
    const provinceSelect = document.getElementById('ici-location-province');
    provinceSelect.value = '200';
    provinceSelect.dispatchEvent(new Event('change'));

    document.getElementById('ici-btn-next').click(); // -> step 3
    clickMap(1, 2);
    document.getElementById('ici-btn-next').click(); // -> step 4

    expect(document.getElementById('ici-review-location').textContent).toBe(
      'Sin ubicación fija',
    );
  });

  it('review summary shows the full path when a city (or neighborhood) is actually chosen', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2

    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));

    const provinceSelect = document.getElementById('ici-location-province');
    provinceSelect.value = '200';
    provinceSelect.dispatchEvent(new Event('change'));
    const citySelect = document.getElementById('ici-location-city');
    citySelect.value = '301'; // Rumiñahui — no neighborhoods
    citySelect.dispatchEvent(new Event('change'));

    document.getElementById('ici-btn-next').click(); // -> step 3
    clickMap(1, 2);
    document.getElementById('ici-btn-next').click(); // -> step 4

    expect(document.getElementById('ici-review-location').textContent).toMatch(
      /Rumiñahui/,
    );
  });

  it('"Editar" on the review step jumps back to the right step without losing data', async () => {
    await component.onInit();
    fillStep1({ title: 'Poste caído' });
    document.getElementById('ici-btn-next').click();
    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    document.getElementById('ici-btn-next').click();
    clickMap(1, 2);
    document.getElementById('ici-btn-next').click(); // -> step 4

    document.getElementById('ici-review-edit-1').click();

    expect(step(1).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-title').value).toBe('Poste caído');
  });

  it('"Anterior" moves back one step', async () => {
    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click(); // -> step 2

    document.getElementById('ici-btn-prev').click();

    expect(step(1).classList.contains('d-none')).toBe(false);
    expect(step(2).classList.contains('d-none')).toBe(true);
  });

  it('submits the full payload from step 4, including priority', async () => {
    mockHttp.post.mockResolvedValue({ data: { id: 99 } });

    await component.onInit();
    fillStep1({ title: 'Fuga de agua', priority: 'low' });
    document.getElementById('ici-btn-next').click();
    const catSelect = document.getElementById('ici-category');
    catSelect.value = '2'; // Seguridad — no children
    catSelect.dispatchEvent(new Event('change'));
    document.getElementById('ici-btn-next').click();
    clickMap(-0.2, -78.5);
    document.getElementById('ici-btn-next').click(); // -> step 4

    document
      .getElementById('ici-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockHttp.post).toHaveBeenCalledWith(
      '/incidents',
      expect.objectContaining({
        title: 'Fuga de agua',
        priority: 'low',
        incident_category_id: 2,
      }),
    );
  });

  it('a 422 error on a step-3 field (geom) jumps back to step 3', async () => {
    mockHttp.post.mockRejectedValue({
      status: 422,
      errors: { geom: ['El punto debe estar dentro del municipio'] },
      message: 'Datos inválidos',
    });

    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click();
    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    document.getElementById('ici-btn-next').click();
    clickMap(0, 0);
    document.getElementById('ici-btn-next').click(); // -> step 4

    document
      .getElementById('ici-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(step(3).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-error-geom').textContent).toMatch(
      /municipio/i,
    );
  });

  it('a 422 spanning step-1 and step-3 fields lands on step 1 (the earliest), not whichever field the backend listed first', async () => {
    mockHttp.post.mockRejectedValue({
      status: 422,
      // `geom` (step 3) listed before `title` (step 1) on purpose — the
      // fix must pick the minimum step across all fields, not the
      // first key iterated from the backend's response.
      errors: {
        geom: ['El punto debe estar dentro del municipio'],
        title: ['El título ya existe'],
      },
      message: 'Datos inválidos',
    });

    await component.onInit();
    fillStep1();
    document.getElementById('ici-btn-next').click();
    const catSelect = document.getElementById('ici-category');
    catSelect.value = '1';
    catSelect.dispatchEvent(new Event('change'));
    document.getElementById('ici-btn-next').click();
    clickMap(0, 0);
    document.getElementById('ici-btn-next').click(); // -> step 4

    document
      .getElementById('ici-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(step(1).classList.contains('d-none')).toBe(false);
    expect(document.getElementById('ici-error-title').textContent).toMatch(
      /ya existe/i,
    );
    // The step-3 error is still written into its own (now hidden) panel
    // so it's not lost — just not where the user is landed first.
    expect(document.getElementById('ici-error-geom').textContent).toMatch(
      /municipio/i,
    );
  });
});
