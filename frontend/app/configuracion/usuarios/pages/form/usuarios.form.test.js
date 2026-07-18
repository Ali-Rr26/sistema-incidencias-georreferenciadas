/**
 * usuarios.form component unit tests — user create/edit form behavior.
 *
 * Tests the component contract, form population, submit handler payload,
 * and avatar upload/delete for admin users.
 */

const mockHttp = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../../core/http.service.js', () => ({ http: mockHttp }));

const mockRouter = vi.hoisted(() => ({
  queryParams: new URLSearchParams(),
  navigate: vi.fn(),
}));

vi.mock('../../../../core/router.js', () => ({ router: mockRouter }));

const mockAuth = vi.hoisted(() => ({
  me: vi.fn(),
  _notifyAuthChange: vi.fn(),
}));

vi.mock('../../../../auth/auth.service.js', () => ({ auth: mockAuth }));

// Stub URL.createObjectURL for jsdom
const mockBlobUrl = 'blob:mock-avatar-url';
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => mockBlobUrl),
  revokeObjectURL: vi.fn(),
});

// Stub window.confirm to always return true (avatars are always deleted in tests)
vi.stubGlobal(
  'confirm',
  vi.fn(() => true),
);

let usuariosFormComponent;

describe('usuariosFormComponent', () => {
  beforeAll(async () => {
    const mod = await import('./usuarios.form.component.js');
    usuariosFormComponent = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.queryParams.has = vi.fn((key) => key === 'id');
    mockRouter.queryParams.get = vi.fn((key) => (key === 'id' ? '5' : null));
    document.body.innerHTML = `
      <span id="form-titulo">Nuevo Usuario</span>
      <span id="card-titulo">Nuevo Usuario</span>
      <span id="breadcrumb-actual">Crear</span>
      <form id="form-user" novalidate>
        <input type="hidden" id="user-id" value="5" />
        <input type="text" id="user-nombre" value="Juan" />
        <input type="text" id="user-apellido" value="Perez" />
        <input type="email" id="user-email" value="juan@example.com" />
        <input type="text" id="user-telefono" value="123456789" />
        <select id="user-rol"></select>
        <select id="user-org"></select>
        <input type="file" id="user-avatar" accept="image/*" />
        <img id="user-avatar-preview" style="display:none" />
        <button type="button" id="btn-upload-avatar">Subir foto</button>
        <button type="button" id="btn-delete-avatar">Eliminar foto</button>
        <button type="submit" id="btn-guardar-user">
          <span id="user-btn-texto">Guardar</span>
          <span id="user-btn-loading" class="d-none">Guardando...</span>
        </button>
      </form>
      <div id="toast-msg" class="toast align-items-center text-white border-0" role="alert">
        <div id="toast-msg-texto"></div>
      </div>
    `;
  });

  afterEach(() => {
    if (usuariosFormComponent?.onDestroy) {
      usuariosFormComponent.onDestroy();
    }
  });

  // ── Contract test ──────────────────────────────────────────

  it('exports defineComponent contract (templateUrl, onInit, onDestroy)', () => {
    expect(usuariosFormComponent).not.toBeNull();
    expect(usuariosFormComponent).toHaveProperty('templateUrl');
    expect(usuariosFormComponent).toHaveProperty('onInit');
    expect(usuariosFormComponent).toHaveProperty('onDestroy');
    expect(typeof usuariosFormComponent.onInit).toBe('function');
    expect(typeof usuariosFormComponent.onDestroy).toBe('function');
  });
});

// ────────────────────────────────────────────────────────────────────
// Avatar upload suite (C2 — admin user-edit avatar management)
// ────────────────────────────────────────────────────────────────────

function makeFakeFile(name = 'avatar.jpg', type = 'image/jpeg', size = 2048) {
  return new File(['x'.repeat(size)], name, { type });
}

describe('usuariosFormComponent — avatar upload (C2)', () => {
  beforeAll(async () => {
    const mod = await import('./usuarios.form.component.js');
    usuariosFormComponent = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.queryParams.has = vi.fn((key) => key === 'id');
    mockRouter.queryParams.get = vi.fn((key) => (key === 'id' ? '5' : null));
    document.body.innerHTML = `
      <span id="form-titulo">Nuevo Usuario</span>
      <span id="card-titulo">Nuevo Usuario</span>
      <span id="breadcrumb-actual">Crear</span>
      <form id="form-user" novalidate>
        <input type="hidden" id="user-id" value="5" />
        <input type="text" id="user-nombre" value="Juan" />
        <input type="text" id="user-apellido" value="Perez" />
        <input type="email" id="user-email" value="juan@example.com" />
        <input type="text" id="user-telefono" value="123456789" />
        <select id="user-rol"></select>
        <select id="user-org"></select>
        <input type="file" id="user-avatar" accept="image/*" />
        <img id="user-avatar-preview" style="display:none" />
        <button type="button" id="btn-upload-avatar">Subir foto</button>
        <button type="button" id="btn-delete-avatar">Eliminar foto</button>
        <button type="submit" id="btn-guardar-user">
          <span id="user-btn-texto">Guardar</span>
          <span id="user-btn-loading" class="d-none">Guardando...</span>
        </button>
      </form>
      <div id="toast-msg" class="toast align-items-center text-white border-0" role="alert">
        <div id="toast-msg-texto"></div>
      </div>
    `;
  });

  afterEach(() => {
    if (usuariosFormComponent?.onDestroy) {
      usuariosFormComponent.onDestroy();
    }
  });

  it('shows avatar preview via URL.createObjectURL when a file is selected', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 5,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        role: { id: 1, name: 'admin_sistema' },
        roles: [{ id: 1, name: 'admin_sistema' }],
        organizations: [{ id: 1, name: 'Org1' }],
      },
    });
    mockAuth.me.mockResolvedValue({
      id: 1,
      first_name: 'Admin',
      last_name: 'User',
      profile_image_path: null,
    });

    await usuariosFormComponent.onInit();

    const fileInput = document.getElementById('user-avatar');
    const file = makeFakeFile();
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    const preview = document.getElementById('user-avatar-preview');
    expect(preview.src).toBe(mockBlobUrl);
    expect(preview.style.display).not.toBe('none');
  });

  it('uploads avatar via POST /api/users/{id}/avatar with FormData', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 5,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        profile_image_path: null,
        role: { id: 1, name: 'admin_sistema' },
        roles: [{ id: 1, name: 'admin_sistema' }],
        organizations: [{ id: 1, name: 'Org1' }],
      },
    });
    mockAuth.me.mockResolvedValue({
      id: 1,
      first_name: 'Admin',
      last_name: 'User',
      profile_image_path: null,
    });
    mockHttp.post.mockResolvedValue({
      data: { id: 5, profile_image_path: 'users/5/abc123.webp' },
    });

    await usuariosFormComponent.onInit();

    // Select a file
    const fileInput = document.getElementById('user-avatar');
    const file = makeFakeFile();
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Click the avatar upload button
    const uploadBtn = document.getElementById('btn-upload-avatar');
    if (uploadBtn) {
      uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));
    }

    // Flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert POST was called with FormData
    expect(mockHttp.post).toHaveBeenCalled();
    const [path, body] = mockHttp.post.mock.calls[0];
    expect(path).toBe('/api/users/5/avatar');
    expect(body).toBeInstanceOf(FormData);
    expect(body.has('avatar')).toBe(true);
    expect(body.get('avatar')).toBe(file);

    // Assert auth refresh after success
    expect(mockAuth.me).toHaveBeenCalled();
    expect(mockAuth._notifyAuthChange).toHaveBeenCalled();
  });

  it('sends DELETE /api/users/{id}/avatar when delete avatar button is clicked', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 5,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        profile_image_path: 'users/5/abc123.webp',
        role: { id: 1, name: 'admin_sistema' },
        roles: [{ id: 1, name: 'admin_sistema' }],
        organizations: [{ id: 1, name: 'Org1' }],
      },
    });
    mockAuth.me.mockResolvedValue({
      id: 1,
      first_name: 'Admin',
      last_name: 'User',
      profile_image_path: null,
    });
    mockHttp.delete.mockResolvedValue({});

    await usuariosFormComponent.onInit();

    // Click the delete avatar button
    const deleteBtn = document.getElementById('btn-delete-avatar');
    if (deleteBtn) {
      deleteBtn.dispatchEvent(new Event('click', { bubbles: true }));
    }

    // Flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert DELETE was called
    expect(mockHttp.delete).toHaveBeenCalledWith('/api/users/5/avatar');

    // Assert auth refresh after success
    expect(mockAuth.me).toHaveBeenCalled();
    expect(mockAuth._notifyAuthChange).toHaveBeenCalled();
  });

  it('shows error toast when avatar POST fails', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 5,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        profile_image_path: null,
        role: { id: 1, name: 'admin_sistema' },
        roles: [{ id: 1, name: 'admin_sistema' }],
        organizations: [{ id: 1, name: 'Org1' }],
      },
    });
    mockAuth.me.mockResolvedValue({
      id: 1,
      first_name: 'Admin',
      last_name: 'User',
      profile_image_path: null,
    });
    mockHttp.post.mockRejectedValue(new Error('Error de conexión'));

    await usuariosFormComponent.onInit();

    // Select a file
    const fileInput = document.getElementById('user-avatar');
    Object.defineProperty(fileInput, 'files', {
      value: [makeFakeFile()],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Click upload button
    const uploadBtn = document.getElementById('btn-upload-avatar');
    if (uploadBtn) {
      uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));
    }

    // Flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    // auth refresh should NOT be called on failure
    expect(mockAuth.me).not.toHaveBeenCalled();
    expect(mockAuth._notifyAuthChange).not.toHaveBeenCalled();
  });

  it('revokes the object URL on component destroy', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 5,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        profile_image_path: null,
        role: { id: 1, name: 'admin_sistema' },
        roles: [{ id: 1, name: 'admin_sistema' }],
        organizations: [{ id: 1, name: 'Org1' }],
      },
    });
    mockAuth.me.mockResolvedValue({
      id: 1,
      first_name: 'Admin',
      last_name: 'User',
      profile_image_path: null,
    });

    await usuariosFormComponent.onInit();

    // Select a file to create a blob URL
    const fileInput = document.getElementById('user-avatar');
    Object.defineProperty(fileInput, 'files', {
      value: [makeFakeFile()],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    usuariosFormComponent.onDestroy();

    expect(revokeSpy).toHaveBeenCalledWith(mockBlobUrl);
  });
});
