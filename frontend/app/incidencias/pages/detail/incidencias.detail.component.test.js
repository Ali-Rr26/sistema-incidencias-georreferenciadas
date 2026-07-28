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
  get: vi.fn().mockResolvedValue({ data: [] }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  post: vi.fn().mockResolvedValue({ data: {} }),
  patch: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue(null),
  request: vi.fn().mockResolvedValue({ data: [] }),
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

const mockRouter = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('../../../core/router.js', () => ({ router: mockRouter }));

const mockAuth = vi.hoisted(() => ({ getUser: vi.fn(() => null) }));
vi.mock('../../../auth/auth.service.js', () => ({ auth: mockAuth }));

const mockPermissionService = vi.hoisted(() => ({
  getMyPermissions: vi.fn(),
}));
vi.mock('../../../shared/permission.service.js', () => ({
  permissionService: mockPermissionService,
}));

// notificationService.approve / .reject are the only paths the detail
// page uses to drive the admin decision flow (per spec S10 + the WU6
// wiring). We mock the service so the test can pin the exact call args
// (notification id, reason) without going through http.post directly.
const mockNotificationService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue({ data: [], meta: null, unreadCount: 0 }),
  unreadCount: vi.fn().mockResolvedValue(0),
  markRead: vi.fn().mockResolvedValue(null),
  markAllRead: vi.fn().mockResolvedValue(null),
  approve: vi.fn().mockResolvedValue({}),
  reject: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../shared/notification.service.js', () => ({
  notificationService: mockNotificationService,
}));

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
      <input type="file" id="detalle-comment-images" />
      <button type="button" id="detalle-comment-attach-btn"></button>
      <div id="detalle-comment-error" class="d-none"></div>
      <button type="submit" id="detalle-comment-submit">Publicar</button>
    </form>
    <div id="detalle-comments-loading"></div>
    <ul id="detalle-comments-list"></ul>
    <p id="detalle-comments-vacio" class="d-none">Sin comentarios todavía.</p>

    <div id="detalle-acciones" class="d-none mb-3">
      <div id="detalle-claim-actions" class="d-none">
        <button id="btn-reclamar"></button>
        <button id="btn-liberar"></button>
      </div>
      <div id="detalle-confirm-actions" class="d-none">
        <button id="btn-confirmar"></button>
      </div>
      <div id="detalle-approval-actions" class="d-none">
        <button id="btn-aprobar" class="btn-aprobar"></button>
        <button id="btn-rechazar" class="btn-rechazar"></button>
      </div>
      <div id="detalle-approval-form" class="d-none">
        <textarea id="detalle-reject-reason" rows="3"></textarea>
        <button id="btn-reject-cancel"></button>
        <button id="btn-reject-confirm"></button>
        <small id="detalle-reject-error" class="d-none"></small>
      </div>
      <div id="detalle-acciones-loading" class="d-none"></div>
      <div id="detalle-acciones-error" class="d-none">
        <div id="detalle-acciones-msg"></div>
      </div>
    </div>

    <div id="detalle-asignaciones-card">
      <div id="detalle-asignaciones-loading"></div>
      <div id="detalle-asignaciones-list"></div>
      <p id="detalle-asignaciones-vacio" class="d-none">Sin operadores asignados.</p>
      <div id="detalle-asignaciones-error" class="d-none">
        <div id="detalle-asignaciones-msg"></div>
      </div>
      <form id="detalle-asignaciones-form" class="d-none">
        <select id="detalle-asignaciones-select"></select>
        <input type="radio" name="asignacion-rol" id="detalle-asignaciones-rol-responsable" value="responsable" checked />
        <input type="radio" name="asignacion-rol" id="detalle-asignaciones-rol-apoyo" value="apoyo" />
        <button type="submit" id="detalle-asignaciones-submit">Asignar</button>
      </form>
    </div>
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
    // Default: no assignments permissions — most tests in this file don't
    // exercise the assignments card, so it should render read-only/empty
    // without extra setup. The assignments-specific describe block below
    // overrides this per-test.
    mockPermissionService.getMyPermissions.mockResolvedValue(new Set());
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
      () =>
        document.getElementById('detalle-comments-list').children.length > 0,
    );

    const list = document.getElementById('detalle-comments-list');
    expect(list.children).toHaveLength(1);
    expect(list.textContent).toContain('Primer comentario');
    expect(list.textContent).toContain('Ana Lopez');
    expect(
      document
        .getElementById('detalle-comments-vacio')
        .classList.contains('d-none'),
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
      document
        .getElementById('detalle-comments-vacio')
        .classList.contains('d-none'),
    ).toBe(false);
    expect(
      document.getElementById('detalle-comments-list').children,
    ).toHaveLength(0);
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
          data: [
            commentFixture(),
            commentFixture({
              id: 2,
              message: 'Segundo comentario',
              user: { first_name: 'Luis' },
            }),
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
    mockHttp.post.mockResolvedValue({
      data: commentFixture({ id: 2, message: 'Segundo comentario' }),
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-comments-list').children.length > 0,
    );

    document.getElementById('detalle-comment-input').value =
      'Segundo comentario';
    document
      .getElementById('detalle-comment-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitUntil(() => mockHttp.post.mock.calls.length > 0);

    expect(mockHttp.post).toHaveBeenCalledWith('/incidents/42/comments', {
      message: 'Segundo comentario',
    });

    await vi.waitUntil(
      () =>
        document.getElementById('detalle-comments-list').children.length === 2,
    );
    expect(
      document.getElementById('detalle-comments-list').textContent,
    ).toContain('Segundo comentario');
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
      document
        .getElementById('detalle-comments-loading')
        .classList.contains('d-none'),
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

  it('triggers the file input when clicking the camera photo attach button', async () => {
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

    const attachBtn = document.getElementById('detalle-comment-attach-btn');
    const fileInput = document.getElementById('detalle-comment-images');
    expect(attachBtn).not.toBeNull();

    const clickSpy = vi.spyOn(fileInput, 'click');
    attachBtn.click();

    expect(clickSpy).toHaveBeenCalled();
  });
});

/**
 * incidencias.detail — assignments wiring (Phase 3 —
 * historial-asignacion-operadores).
 *
 * The operator detail view gained an "Asignaciones" card backed by
 * assignmentService (GET/POST/DELETE /incidents/{id}/assignments) plus an
 * operator-picker sourced from /roles + /users. permissionService is
 * mocked entirely (mirrors permission.guard.test.js) so each test can pin
 * an exact permission set instead of exercising the real caching service.
 */
function assignmentFixture(overrides = {}) {
  return {
    id: 1,
    incident_id: 42,
    user_id: 7,
    role: 'responsable',
    user: { first_name: 'Carla', last_name: 'Ruiz' },
    ...overrides,
  };
}

const incidentWithOrgFixture = {
  ...incidentFixture,
  organization: { id: 9, name: 'Org X' },
};

describe('incidencias.detail — assignments', () => {
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

  it('renders the assignment list returned by the initial GET', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(new Set());
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [assignmentFixture()] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(() =>
      document
        .getElementById('detalle-asignaciones-loading')
        .classList.contains('d-none'),
    );

    const listEl = document.getElementById('detalle-asignaciones-list');
    expect(listEl.textContent).toContain('Carla Ruiz');
    expect(listEl.textContent).toContain('Responsable');
    expect(
      document
        .getElementById('detalle-asignaciones-vacio')
        .classList.contains('d-none'),
    ).toBe(true);
  });

  it('hides the assignment form when assignments.create is absent', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(() =>
      document
        .getElementById('detalle-asignaciones-loading')
        .classList.contains('d-none'),
    );

    expect(
      document
        .getElementById('detalle-asignaciones-form')
        .classList.contains('d-none'),
    ).toBe(true);
    // No role-lookup calls should fire when the form stays hidden.
    expect(mockHttp.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/roles'),
    );
  });

  it('shows the form, creates an assignment, and refreshes the list on submit', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.create']),
    );
    let assignmentsCallCount = 0;
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentWithOrgFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        assignmentsCallCount += 1;
        if (assignmentsCallCount === 1) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [assignmentFixture()] });
      }
      if (path.startsWith('/incidents/42/available-operators')) {
        return Promise.resolve({
          data: [{ id: 7, first_name: 'Carla', last_name: 'Ruiz' }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    mockHttp.post.mockResolvedValue({ data: assignmentFixture() });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-select').children.length >
        0,
    );

    expect(mockHttp.get).toHaveBeenCalledWith(
      expect.stringContaining('/incidents/42/available-operators'),
    );

    document.getElementById('detalle-asignaciones-select').value = '7';
    document
      .getElementById('detalle-asignaciones-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitUntil(() => mockHttp.post.mock.calls.length > 0);

    expect(mockHttp.post).toHaveBeenCalledWith('/incidents/42/assignments', {
      user_id: 7,
      role: 'responsable',
    });

    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-list').textContent
          .length > 0,
    );
    expect(
      document.getElementById('detalle-asignaciones-list').textContent,
    ).toContain('Carla Ruiz');
  });

  it('shows a 422 error inline when a second responsable is attempted', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.create']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentWithOrgFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [assignmentFixture()] });
      }
      if (path.startsWith('/incidents/42/available-operators')) {
        return Promise.resolve({
          data: [{ id: 8, first_name: 'Luis', last_name: 'Mora' }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    const conflictErr = new Error(
      'Esta incidencia ya tiene un responsable asignado.',
    );
    conflictErr.status = 422;
    mockHttp.post.mockRejectedValue(conflictErr);

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-select').children.length >
        0,
    );

    document.getElementById('detalle-asignaciones-select').value = '8';
    document
      .getElementById('detalle-asignaciones-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitUntil(() => mockHttp.post.mock.calls.length > 0);
    await vi.waitUntil(
      () =>
        !document
          .getElementById('detalle-asignaciones-error')
          .classList.contains('d-none'),
    );

    expect(
      document.getElementById('detalle-asignaciones-msg').textContent,
    ).toBe('Esta incidencia ya tiene un responsable asignado.');
  });

  it('shows a delete button when assignments.delete is present, and clicking it removes the assignment then refreshes the list', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.delete']),
    );
    let assignmentsCallCount = 0;
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        assignmentsCallCount += 1;
        if (assignmentsCallCount === 1) {
          return Promise.resolve({ data: [assignmentFixture()] });
        }
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
    mockHttp.delete.mockResolvedValue(null);

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(() =>
      document.querySelector('.btn-eliminar-asignacion'),
    );

    const btn = document.querySelector('.btn-eliminar-asignacion');
    expect(btn.dataset.id).toBe('1');
    btn.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitUntil(() => mockHttp.delete.mock.calls.length > 0);
    expect(mockHttp.delete).toHaveBeenCalledWith('/incidents/42/assignments/1');

    await vi.waitUntil(
      () =>
        !document
          .getElementById('detalle-asignaciones-vacio')
          .classList.contains('d-none'),
    );
    expect(document.querySelector('.btn-eliminar-asignacion')).toBeNull();
  });

  it('shows a visible error (not hidden by the create-form ancestor) when removing an assignment fails for a delete-only user', async () => {
    // Deliberately no assignments.create — reproduces the R4-001 bug
    // scenario: create-form stays hidden, but the delete error banner
    // (which used to live inside that form) must still be visible.
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.delete']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [assignmentFixture()] });
      }
      return Promise.resolve({ data: [] });
    });
    mockHttp.delete.mockRejectedValue(
      new Error('No se pudo eliminar la asignación.'),
    );

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(() =>
      document.querySelector('.btn-eliminar-asignacion'),
    );

    document
      .querySelector('.btn-eliminar-asignacion')
      .dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitUntil(() => mockHttp.delete.mock.calls.length > 0);
    await vi.waitUntil(
      () =>
        !document
          .getElementById('detalle-asignaciones-error')
          .classList.contains('d-none'),
    );

    const errorEl = document.getElementById('detalle-asignaciones-error');
    const formEl = document.getElementById('detalle-asignaciones-form');
    expect(
      document.getElementById('detalle-asignaciones-msg').textContent,
    ).toBe('No se pudo eliminar la asignación.');
    // The create-form stays hidden (no assignments.create)...
    expect(formEl.classList.contains('d-none')).toBe(true);
    // ...but the error banner is NOT a descendant of it, so it's visible
    // regardless. This is the actual regression check for R4-001.
    expect(formEl.contains(errorEl)).toBe(false);
    expect(errorEl.classList.contains('d-none')).toBe(false);
    // The delete button re-enables so the user can retry.
    expect(document.querySelector('.btn-eliminar-asignacion').disabled).toBe(
      false,
    );
  });

  it('disables the operator select and submit button, and shows an error option, when the /roles fetch fails', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.create']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentWithOrgFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [] });
      }
      if (path.startsWith('/incidents/42/available-operators')) {
        return Promise.reject(new Error('roles fetch failed'));
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-select').textContent
          .length > 0,
    );

    const selectEl = document.getElementById('detalle-asignaciones-select');
    expect(selectEl.disabled).toBe(true);
    expect(selectEl.textContent).toContain('Error al cargar operadores');
    expect(
      document.getElementById('detalle-asignaciones-submit').disabled,
    ).toBe(true);
  });

  it('shows "sin organización" and disables the picker + submit when the incident has no organization', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.create']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        // incidentFixture.organization is null.
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-select').textContent
          .length > 0,
    );

    const selectEl = document.getElementById('detalle-asignaciones-select');
    expect(selectEl.disabled).toBe(true);
    expect(selectEl.textContent).toContain('Sin organización asignada');
    expect(
      document.getElementById('detalle-asignaciones-submit').disabled,
    ).toBe(true);
    expect(mockHttp.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/roles'),
    );
  });

  it('shows "sin operadores disponibles" and disables the picker + submit when /users returns zero operators', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(
      new Set(['assignments.view', 'assignments.create']),
    );
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentWithOrgFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.resolve({ data: [] });
      }
      if (path === '/roles?per_page=100') {
        return Promise.resolve({
          data: [{ id: 4, name: 'operador_organizacion' }],
        });
      }
      if (path.startsWith('/users?')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(
      () =>
        document.getElementById('detalle-asignaciones-select').textContent
          .length > 0,
    );

    const selectEl = document.getElementById('detalle-asignaciones-select');
    expect(selectEl.disabled).toBe(true);
    expect(selectEl.textContent).toContain('Sin operadores disponibles');
    expect(
      document.getElementById('detalle-asignaciones-submit').disabled,
    ).toBe(true);
  });

  it('shows an error message and clears the list when the assignments GET fails', async () => {
    mockPermissionService.getMyPermissions.mockResolvedValue(new Set());
    mockHttp.get.mockImplementation((path) => {
      if (path === '/incidents/42') {
        return Promise.resolve({ data: incidentFixture });
      }
      if (path.startsWith('/incidents/42/assignments')) {
        return Promise.reject(new Error('list failed'));
      }
      return Promise.resolve({ data: [] });
    });

    await component.onInit({ params: { id: 42 } });
    await vi.waitUntil(() =>
      document
        .getElementById('detalle-asignaciones-loading')
        .classList.contains('d-none'),
    );

    const vacioEl = document.getElementById('detalle-asignaciones-vacio');
    expect(vacioEl.classList.contains('d-none')).toBe(false);
    expect(vacioEl.textContent).toBe('Error al cargar asignaciones.');
        expect(document.getElementById('detalle-asignaciones-list').innerHTML).toBe(
          '',
        );
      });
    });

    /**
     * incidencias.detail — WU6 approve / reject buttons.
     *
     * The operator detail view gained admin-approval controls: Aprobar /
     * Rechazar buttons are visible ONLY when both
     *   (a) the loaded incident has status === 'resolved' AND
     *   (b) the authenticated user has the `incidents.approve` permission.
     *
     * Both buttons route through the already-wired `notificationService`
     * (not raw `http.post`) so the existing decision pipeline (audit
     * actor binding, side-effect notifications, 422 reason validation)
     * stays in one place. After clicking either button the page re-fetches
     * the incident via `cargarIncidencia(id)` so the status badge and the
     * action buttons re-render without a full page reload.
     */
    describe('incidencias.detail — WU6 approval buttons', () => {
      let component;

      function resolvedIncidentFixture(overrides = {}) {
        return {
          id: 42,
          title: 'Bache resuelto',
          description: 'Bache profundo',
          status: 'resolved',
          priority: 'medium',
          created_at: '2026-07-01T10:00:00Z',
          category: { name: 'Infraestructura' },
          location: { name: 'Centro' },
          user: { first_name: 'Juan', last_name: 'Perez' },
          organization: { id: 9, name: 'Org X' },
          images: [],
          status_history: [],
          comments: [],
          assignments: [],
          ...overrides,
        };
      }

      async function mountWithStatus(status, permissions = new Set()) {
        const fixture = resolvedIncidentFixture({ status });
        let incidentsCallCount = 0;
        mockHttp.get.mockImplementation((path) => {
          if (path === '/incidents/42') {
            incidentsCallCount += 1;
            if (incidentsCallCount === 1) {
              return Promise.resolve({ data: fixture });
            }
            // Reload after decision — return the next status so the
            // status badge re-paints and the buttons re-evaluate.
            const next = { ...fixture, status: 'in_progress' };
            return Promise.resolve({ data: next });
          }
          return Promise.resolve({ data: [] });
        });
        mockPermissionService.getMyPermissions.mockResolvedValue(permissions);
        await component.onInit({ params: { id: 42 } });
        // setupActionButtons runs as part of onInit; let the
        // permissionService.getMyPermissions promise resolve.
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      }

      beforeAll(async () => {
        const mod = await import('./incidencias.detail.component.js');
        component = mod.default;
      });

      beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.getUser.mockReturnValue({
          id: 99,
          role: { name: 'admin_organizacion' },
        });
        buildDetailDom();
      });

      afterEach(() => {
        component.onDestroy?.();
      });

      it('renders Aprobar / Rechazar when status=resolved AND user has incidents.approve', async () => {
        // Buttons only mount when a matching open approval notification
        // exists in the user's queue — the helper looks the notification up
        // via notificationService.list so it can call the right
        // /notifications/{id}/{approve,reject} endpoint. We seed the queue
        // here so the test exercises the happy path end-to-end.
        mockNotificationService.list.mockResolvedValue({
          data: [
            {
              id: 11,
              type: 'incidencia_atendida_para_aprobacion',
              data: { incident_id: 42, decision: null },
              read: false,
            },
          ],
          meta: null,
          unreadCount: 1,
        });

        await mountWithStatus('resolved', new Set(['incidents.approve']));

        const approvalActions = document.getElementById(
          'detalle-approval-actions',
        );
        expect(approvalActions.classList.contains('d-none')).toBe(false);
        expect(document.getElementById('btn-aprobar')).not.toBeNull();
        expect(document.getElementById('btn-rechazar')).not.toBeNull();
      });

      it('does NOT render approval buttons when status is in_progress', async () => {
        await mountWithStatus('in_progress', new Set(['incidents.approve']));

        const approvalActions = document.getElementById(
          'detalle-approval-actions',
        );
        expect(approvalActions.classList.contains('d-none')).toBe(true);
      });

      it('does NOT render approval buttons when status is pending', async () => {
        await mountWithStatus('pending', new Set(['incidents.approve']));

        const approvalActions = document.getElementById(
          'detalle-approval-actions',
        );
        expect(approvalActions.classList.contains('d-none')).toBe(true);
      });

      it('does NOT render approval buttons when the user lacks incidents.approve', async () => {
        await mountWithStatus('resolved', new Set(['incidents.view']));

        const approvalActions = document.getElementById(
          'detalle-approval-actions',
        );
        expect(approvalActions.classList.contains('d-none')).toBe(true);
      });

      it('clicking Aprobar calls notificationService.approve with the notification id and reloads the incident', async () => {
        // The detail page finds the approval notification via the user's
        // notification queue (or the embedded data fixture). The simplest
        // way for the test to pin the id is to populate the notification
        // list with a single approval row that references this incident.
        mockNotificationService.list.mockResolvedValue({
          data: [
            {
              id: 7,
              type: 'incidencia_atendida_para_aprobacion',
              data: { incident_id: 42, decision: null },
              read: false,
            },
          ],
          meta: null,
          unreadCount: 1,
        });

        await mountWithStatus('resolved', new Set(['incidents.approve']));

        document.getElementById('btn-aprobar').click();

        await vi.waitUntil(() => mockNotificationService.approve.mock.calls.length > 0);
        expect(mockNotificationService.approve).toHaveBeenCalledWith(7);

        // The page must refetch the incident so the status badge reflects
        // the new 'closed' state and the buttons disappear (scenario S10).
        await vi.waitUntil(
          () => mockHttp.get.mock.calls.filter((c) => c[0] === '/incidents/42').length >= 2,
        );
      });

      it('clicking Rechazar opens the inline reject form; Confirming calls notificationService.reject with the reason and reloads', async () => {
        mockNotificationService.list.mockResolvedValue({
          data: [
            {
              id: 8,
              type: 'incidencia_atendida_para_aprobacion',
              data: { incident_id: 42, decision: null },
              read: false,
            },
          ],
          meta: null,
          unreadCount: 1,
        });

        await mountWithStatus('resolved', new Set(['incidents.approve']));

        document.getElementById('btn-rechazar').click();

        const form = document.getElementById('detalle-approval-form');
        expect(form.classList.contains('d-none')).toBe(false);
        const textarea = document.getElementById('detalle-reject-reason');
        textarea.value = 'falta evidencia fotográfica';
        textarea.dispatchEvent(new Event('input'));

        document.getElementById('btn-reject-confirm').click();

        await vi.waitUntil(
          () => mockNotificationService.reject.mock.calls.length > 0,
        );
        expect(mockNotificationService.reject).toHaveBeenCalledWith(
          8,
          'falta evidencia fotográfica',
        );

        // After the decision, the page re-fetches the incident so the
        // status flips from 'resolved' to 'in_progress' and the approval
        // buttons disappear (S4 / S10).
        await vi.waitUntil(
          () =>
            mockHttp.get.mock.calls.filter((c) => c[0] === '/incidents/42')
              .length >= 2,
        );
      });

      it('surfaces the server-side 422 errors.reason[0] when the API rejects the rejection', async () => {
        mockNotificationService.list.mockResolvedValue({
          data: [
            {
              id: 9,
              type: 'incidencia_atendida_para_aprobacion',
              data: { incident_id: 42, decision: null },
              read: false,
            },
          ],
          meta: null,
          unreadCount: 1,
        });
        const serverError = new Error('Validation failed');
        serverError.status = 422;
        serverError.data = {
          errors: { reason: ['El motivo es obligatorio.'] },
        };
        mockNotificationService.reject.mockRejectedValueOnce(serverError);

        await mountWithStatus('resolved', new Set(['incidents.approve']));
        document.getElementById('btn-rechazar').click();
        const textarea = document.getElementById('detalle-reject-reason');
        textarea.value = 'x';
        textarea.dispatchEvent(new Event('input'));
        document.getElementById('btn-reject-confirm').click();

        await vi.waitUntil(() =>
          document
            .getElementById('detalle-reject-error')
            ?.textContent?.length > 0,
        );
        expect(
          document.getElementById('detalle-reject-error').textContent,
        ).toContain('El motivo es obligatorio.');
      });
    });
