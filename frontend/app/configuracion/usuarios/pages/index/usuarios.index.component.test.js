/**
 * usuarios.index.component — error differentiation tests (R-24).
 *
 * The component's cargar() catch block must NOT show the same generic
 * error toast for a 403 (which means "you can see the route but not the
 * data" — usually a stale permission state) as for a network/server
 * failure. Defense-in-depth: even if the permissionGuard upstream lets a
 * user slip through, a 403 response is a clearer signal than a generic
 * "no se pudo conectar con el servidor".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setAccessToken,
  clearAuthState,
} from '../../../../core/http.service.js';

vi.mock('../../../../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    http: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { http } from '../../../../core/http.service.js';
import usuariosComponent from './usuarios.index.component.js';

/**
 * Build the slice of DOM that usuarios.index.component.js's onInit() reads
 * with document.getElementById. The component is wired to a real Bootstrap
 * template; here we just create the IDs it touches.
 */
function mountUsuariosDom() {
  document.body.innerHTML = `
    <input id="filtro-buscar" />
    <select id="filtro-rol"><option value="">Todos</option></select>
    <select id="filtro-org"><option value="">Todas</option></select>
    <div id="estado-cargando"></div>
    <div id="estado-vacio" class="d-none"></div>
    <div id="estado-error" class="d-none"></div>
    <div id="contenedor-tabla" class="d-none">
      <small id="info-resultados"></small>
      <ul id="paginacion"></ul>
    </div>
    <table><tbody id="tabla-body"></tbody></table>
    <div id="contenedor-cards"></div>
    <button id="btn-filtrar"></button>
    <button id="btn-limpiar"></button>
    <button id="btn-reintentar"></button>
    <div id="modal-eliminar"></div>
    <strong id="modal-eliminar-nombre"></strong>
    <button id="btn-confirmar-eliminar"></button>
    <span id="eliminar-texto"></span>
    <span id="eliminar-loading" class="d-none"></span>
    <div id="toast-msg" class="toast align-items-center text-white border-0">
      <div id="toast-msg-texto"></div>
    </div>
  `;
}

describe('usuarios.index.component — R-24 403 differentiation', () => {
  beforeEach(() => {
    clearAuthState();
    setAccessToken('test-token');
    vi.clearAllMocks();
    // Roles/orgs fetches must return something so cargarFiltros doesn't throw.
    http.get.mockImplementation((path) => {
      if (path.startsWith('/roles')) return Promise.resolve({ data: [] });
      if (path.startsWith('/organizations'))
        return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    mountUsuariosDom();
  });

  it('shows the "No tienes acceso" toast on a 403 from /users (R-24)', async () => {
    // The first /users call rejects with a 403-shaped error.
    http.get.mockImplementation((path) => {
      if (path.startsWith('/users')) {
        const err = new Error('This action is unauthorized.');
        err.status = 403;
        return Promise.reject(err);
      }
      if (path.startsWith('/roles')) return Promise.resolve({ data: [] });
      if (path.startsWith('/organizations'))
        return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await usuariosComponent.onInit();

    // Microtask flush: toast mutation happens inside the awaited onInit.
    expect(document.getElementById('toast-msg-texto').textContent).toContain(
      'No tienes acceso',
    );
    // The generic error panel still shows so retry is possible.
    expect(
      document.getElementById('estado-error').classList.contains('d-none'),
    ).toBe(false);
  });

  it('does NOT show the "No tienes acceso" toast on a network/server error', async () => {
    // Generic 500-ish error.
    http.get.mockImplementation((path) => {
      if (path.startsWith('/users')) {
        return Promise.reject(new Error('Network down'));
      }
      if (path.startsWith('/roles')) return Promise.resolve({ data: [] });
      if (path.startsWith('/organizations'))
        return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await usuariosComponent.onInit();

    expect(
      document.getElementById('toast-msg-texto').textContent,
    ).not.toContain('No tienes acceso');
    // Generic error state still shown.
    expect(
      document.getElementById('estado-error').classList.contains('d-none'),
    ).toBe(false);
  });
});
