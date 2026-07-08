/**
 * incidencias.detail component unit tests — public comments wiring
 * (Phase 3 — 33bd3210).
 *
 * The operator detail view gained a comment list + posting form backed by
 * commentService (GET/POST /incidents/{id}/comments). These tests pin:
 *   - the initial GET renders the returned comments into the list
 *   - submitting the form calls commentService.create with the right
 *     payload, then reloads the list so the newly posted comment appears
 *   - an empty comment shows a validation error instead of posting
 *   - an empty comment list renders the "no comments yet" placeholder
 *
 * Convention: mock http.service.js / router.js / auth.service.js directly
 * (perfil.test.js pattern) rather than the higher-level commentService, so
 * the request/response contract (endpoint, method, payload, response
 * envelope) is exercised end-to-end through the real commentService.
 *
 * DOM fixture: only the ids the component touches unconditionally
 * (detalle-loading, detalle-content, detalle-coords, detalle-comment-form,
 * detalle-comment-input, detalle-comments-list) plus the optional comment
 * ids used for a more complete assertion surface. Status-history and
 * status-change wiring are deliberately left out of the fixture — both are
 * individually guarded (`if (!select || !btnGuardar) return;` /
 * `if (!loadingEl || !listEl) return;`) so omitting their ids makes them
 * no-op instead of requiring an unrelated fixture for this test's scope.
 */

const mockHttp = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}));
vi.mock('../../../core/http.service.js', () => ({ http: mockHttp }));

const mockRouter = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('../../../core/router.js', () => ({ router: mockRouter }));

const mockAuth = vi.hoisted(() => ({ getUser: vi.fn(() => null) }));
vi.mock('../../../auth/auth.service.js', () => ({ auth: mockAuth }));

function buildDetailDom() {
  document.body.innerHTML = `
    <h1 id="detalle-titulo"></h1>
    <span id="detalle-breadcrumb"></span>
    <div id="detalle-loading"></div>
    <div id="detalle-content" class="d-none"></div>
    <div id="detalle-coords"></div>
    <span id="detalle-status"></span>
    <span id="detalle-priority"></span>
    <small id="detalle-fecha"></small>
    <p id="detalle-descripcion"></p>
    <span id="detalle-categoria"></span>
    <span id="detalle-ubicacion"></span>
    <span id="detalle-usuario"></span>
    <span id="detalle-organizacion"></span>
    <div id="detalle-thumbnail" class="d-none"></div>

    <input type="file" id="detalle-file-input" />
    <button id="btn-subir-imagen" disabled></button>
    <div id="detalle-upload-progress" class="d-none"></div>
    <div id="detalle-imagenes">
      <p id="detalle-sin-imagenes" class="text-muted small mb-0">Sin imágenes</p>
    </div>

    <form id="detalle-comment-form">
      <textarea id="detalle-comment-input"></textarea>
      <div id="detalle-comment-error" class="d-none"></div>
      <button type="submit" id="detalle-comment-submit">Publicar</button>
    </form>
    <div id="detalle-comments-loading"></div>
    <ul id="detalle-comments-list"></ul>
    <p id="detalle-comments-vacio" class="d-none">Sin comentarios todavía.</p>
  `;
}

const incidentFixture = {
  id: 42,
  title: 'Bache en la vía',
  description: 'Bache profundo',
  status: 'pending',
  priority: 'medium',
  created_at: '2026-07-01T10:00:00Z',
  category: { name: 'Infraestructura' },
  location: { name: 'Centro' },
  user: { first_name: 'Juan', last_name: 'Perez' },
  organization: null,
  images: [],
  // No geom — renderMap short-circuits to "Sin coordenadas" without
  // needing a mocked initMapView/Leaflet.
};

function commentFixture(overrides = {}) {
  return {
    id: 1,
    message: 'Primer comentario',
    user: { first_name: 'Ana', last_name: 'Lopez' },
    created_at: '2026-07-02T09:00:00Z',
    ...overrides,
  };
}

describe('incidencias.detail — public comments', () => {
  let component;

  beforeAll(async () => {
    const mod = await import('./incidencias.detail.component.js');
    component = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getUser.mockReturnValue(null);
    buildDetailDom();
  });

  afterEach(() => {
    component.onDestroy?.();
  });

  it('renders the comments returned by the initial GET', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/comments')) {
        return Promise.resolve({ data: [commentFixture()] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () => document.getElementById('detalle-comments-list').children.length > 0,
    );

    const list = document.getElementById('detalle-comments-list');
    expect(list.children).toHaveLength(1);
    expect(list.textContent).toContain('Primer comentario');
    expect(list.textContent).toContain('Ana Lopez');
    expect(
      document.getElementById('detalle-comments-vacio').classList.contains('d-none'),
    ).toBe(true);
  });

  it('shows the empty-state message when there are no comments yet', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/comments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        !document
          .getElementById('detalle-comments-vacio')
          .classList.contains('d-none'),
    );

    expect(
      document.getElementById('detalle-comments-vacio').classList.contains('d-none'),
    ).toBe(false);
    expect(document.getElementById('detalle-comments-list').children).toHaveLength(0);
  });

  it('posts a new comment via POST /incidents/{id}/comments and appends it after reload', async () => {
    let commentsCallCount = 0;
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/comments')) {
        commentsCallCount += 1;
        if (commentsCallCount === 1) {
          return Promise.resolve({ data: [commentFixture()] });
        }
        return Promise.resolve({
          data: [commentFixture(), commentFixture({ id: 2, message: 'Segundo comentario', user: { first_name: 'Luis' } })],
        });
      }
      return Promise.resolve({ data: [] });
    });
    mockHttp.post.mockResolvedValue({
      data: commentFixture({ id: 2, message: 'Segundo comentario' }),
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () => document.getElementById('detalle-comments-list').children.length > 0,
    );

    document.getElementById('detalle-comment-input').value = 'Segundo comentario';
    document
      .getElementById('detalle-comment-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitUntil(() => mockHttp.post.mock.calls.length > 0);

    expect(mockHttp.post).toHaveBeenCalledWith('/incidents/42/comments', {
      message: 'Segundo comentario',
    });

    await vi.waitUntil(
      () => document.getElementById('detalle-comments-list').children.length === 2,
    );
    expect(document.getElementById('detalle-comments-list').textContent).toContain(
      'Segundo comentario',
    );
    // Input is cleared after a successful post.
    expect(document.getElementById('detalle-comment-input').value).toBe('');
  });

  it('shows a validation error and does not call the API when the comment is empty', async () => {
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/comments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    // The submit handler is only wired up AFTER the initial
    // `await cargarComentarios()` resolves — waiting on the http.get call
    // count alone races that promise chain. #detalle-comments-loading
    // flips to hidden only once the initial load (and listener wiring)
    // has fully completed, which is a reliable synchronization point.
    await vi.waitUntil(() =>
      document.getElementById('detalle-comments-loading').classList.contains('d-none'),
    );

    document.getElementById('detalle-comment-input').value = '   ';
    document
      .getElementById('detalle-comment-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    // Give any (incorrect) async post a tick to fire before asserting it didn't.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockHttp.post).not.toHaveBeenCalled();
    const errorEl = document.getElementById('detalle-comment-error');
    expect(errorEl.classList.contains('d-none')).toBe(false);
    expect(errorEl.textContent).toBe('El comentario no puede estar vacío.');
  });
});
