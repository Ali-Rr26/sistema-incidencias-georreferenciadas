/**
 * Perfil component unit tests — profile update form behavior.
 *
 * Tests the component contract, onInit fetch, submit handler payload,
 * and error handling. Imports the component which does not exist yet
 * (RED phase — test confirms failure before GREEN implementation).
 */

const mockHttp = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../../core/http.service.js', () => ({ http: mockHttp }));

const mockRouter = vi.hoisted(() => ({
  queryParams: new URLSearchParams(),
  navigate: vi.fn(),
}));

vi.mock('../../core/router.js', () => ({ router: mockRouter }));

// ── Import the component (will fail until perfil.component.js exists) ──
let perfilComponent;

describe('perfilComponent — RED phase (test before code)', () => {
  beforeAll(async () => {
    // Dynamic import so the test file can load before the component exists
    // During actual RED-to-GREEN cycle, this import will succeed after
    // perfil.component.js is created.
    try {
      const mod = await import('./perfil.component.js');
      perfilComponent = mod.default;
    } catch {
      perfilComponent = null;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <form id="form-perfil" novalidate>
        <input type="text" id="perfil-nombre" />
        <input type="text" id="perfil-apellido" />
        <input type="text" id="perfil-telefono" />
        <input type="password" id="perfil-password" />
        <button type="submit" id="btn-guardar-perfil">
          <span id="perfil-btn-texto">Guardar</span>
          <span id="perfil-btn-loading" class="d-none">Guardando...</span>
        </button>
      </form>
      <div id="toast-msg" class="toast align-items-center text-white border-0" role="alert">
        <div id="toast-msg-texto"></div>
      </div>
    `;
  });

  afterEach(() => {
    if (perfilComponent?.onDestroy) {
      perfilComponent.onDestroy();
    }
  });

  // ── Contract test ──────────────────────────────────────────

  it('exports defineComponent contract (templateUrl, onInit, onDestroy)', () => {
    // At RED phase this will be null, at GREEN phase it must pass
    expect(perfilComponent).not.toBeNull();
    expect(perfilComponent).toHaveProperty('templateUrl');
    expect(perfilComponent).toHaveProperty('onInit');
    expect(perfilComponent).toHaveProperty('onDestroy');
    expect(typeof perfilComponent.onInit).toBe('function');
    expect(typeof perfilComponent.onDestroy).toBe('function');
  });

  // ── onInit fetches /auth/me and populates form ─────────────

  it('onInit fetches user profile via GET /auth/me and populates fields', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 1,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        role: { id: 1, name: 'Admin_sistema' },
        organization: { id: 1, name: 'Org1' },
      },
    });

    await perfilComponent.onInit();

    expect(mockHttp.get).toHaveBeenCalledWith('/auth/me');
    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(document.getElementById('perfil-nombre').value).toBe('Juan');
    expect(document.getElementById('perfil-apellido').value).toBe('Perez');
    expect(document.getElementById('perfil-telefono').value).toBe('123456789');
  });

  // ── Submit handler calls PUT /auth/profile ─────────────────

  it('sends PUT /auth/profile with correct payload on form submit', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 1,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        role: { id: 1, name: 'Admin_sistema' },
      },
    });
    mockHttp.put.mockResolvedValue({ data: { id: 1 } });

    await perfilComponent.onInit();

    // Modify fields
    document.getElementById('perfil-nombre').value = 'Juan Carlos';
    document.getElementById('perfil-telefono').value = '987654321';
    document.getElementById('perfil-password').value = 'newpass123';

    // Submit
    document.getElementById('form-perfil').dispatchEvent(new Event('submit'));

    // Wait for microtask queue
    await vi.waitUntil(() => mockHttp.put.mock.calls.length > 0);

    expect(mockHttp.put).toHaveBeenCalledWith('/auth/profile', {
      first_name: 'Juan Carlos',
      last_name: 'Perez',
      phone: '987654321',
      password: 'newpass123',
    });
  });

  // ── Submit without password ────────────────────────────────

  it('sends PUT /auth/profile without password when field is empty', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 1,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '',
        role: { id: 1, name: 'Admin_sistema' },
      },
    });
    mockHttp.put.mockResolvedValue({ data: { id: 1 } });

    await perfilComponent.onInit();

    document.getElementById('perfil-nombre').value = 'Juan';
    document.getElementById('perfil-apellido').value = 'Perez';
    document.getElementById('perfil-telefono').value = '';
    document.getElementById('perfil-password').value = '';

    document.getElementById('form-perfil').dispatchEvent(new Event('submit'));

    await vi.waitUntil(() => mockHttp.put.mock.calls.length > 0);

    expect(mockHttp.put).toHaveBeenCalledWith('/auth/profile', {
      first_name: 'Juan',
      last_name: 'Perez',
      phone: null,
    });
    // password MUST NOT be in the payload when empty
    const payload = mockHttp.put.mock.calls[0][1];
    expect(payload).not.toHaveProperty('password');
  });

  // ── Error handling ─────────────────────────────────────────

  it('shows error toast when PUT /auth/profile fails', async () => {
    mockHttp.get.mockResolvedValue({
      data: {
        id: 1,
        first_name: 'Juan',
        last_name: 'Perez',
        email: 'juan@example.com',
        phone: '123456789',
        role: { id: 1, name: 'Admin_sistema' },
      },
    });
    mockHttp.put.mockRejectedValue(new Error('Error de conexión'));

    const showSpy = vi.spyOn(bootstrap.Toast.prototype, 'show');

    await perfilComponent.onInit();

    document.getElementById('perfil-nombre').value = 'Juan';
    document.getElementById('form-perfil').dispatchEvent(new Event('submit'));

    await vi.waitUntil(() => mockHttp.put.mock.calls.length > 0);
    // Give the catch handler time to update the toast
    await vi.waitUntil(
      () => document.getElementById('toast-msg-texto').textContent.length > 0,
    );

    expect(document.getElementById('toast-msg-texto').textContent).toBe(
      'Error de conexión',
    );
    expect(showSpy).toHaveBeenCalled();
  });

  // ── Handles missing DOM gracefully ─────────────────────────

  it('onInit handles API failure gracefully (shows error toast)', async () => {
    mockHttp.get.mockRejectedValue(new Error('Error de red'));

    const showSpy = vi.spyOn(bootstrap.Toast.prototype, 'show');

    await perfilComponent.onInit();

    // Should show error toast
    await vi.waitUntil(
      () => document.getElementById('toast-msg-texto').textContent.length > 0,
    );

    expect(document.getElementById('toast-msg-texto').textContent).toBe(
      'Error al cargar el perfil.',
    );
    expect(showSpy).toHaveBeenCalled();
  });
});
