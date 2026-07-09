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
    <div id="ici-map"></div>
    <div id="ici-error-geom"></div>
    <input type="file" id="ici-images" multiple />
    <div id="ici-image-preview"></div>
    <input type="text" id="ici-title" />
    <textarea id="ici-description"></textarea>
    <select id="ici-priority">
      <option value="">-- Seleccione --</option>
      <option value="high">Alta</option>
      <option value="medium">Media</option>
      <option value="low">Baja</option>
    </select>
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
    <h1 id="ici-page-title"></h1>
    <span id="ici-breadcrumb-active"></span>
    <h5 id="ici-card-title"></h5>
    <span id="ici-submit-btn-text"></span>
    <span id="ici-toast-text"></span>
  `;
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
    vi.stubGlobal(
      'L',
      { marker: vi.fn(() => makeFakeMarker()) },
    );
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
    it('renders the province select with the country node\'s direct children', async () => {
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
      expect(
        document.getElementById('ici-location-neighborhood').value,
      ).toBe('400');
    });
  });
});
