import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrudIndexPage } from './crud-index.js';
import { http } from '../core/http.service.js';
import { router } from '../core/router.js';
import { mount } from './table-actions/table-actions.component.js';

vi.mock('../core/http.service.js', () => ({
  http: { get: vi.fn(), delete: vi.fn() },
}));
vi.mock('../core/router.js', () => ({
  router: { navigate: vi.fn() },
}));
vi.mock('./table-actions/table-actions.component.js', () => ({
  mount: vi.fn(),
}));

function mountFixture() {
  document.body.innerHTML = `
    <div id="estado-cargando" class="d-none"></div>
    <div id="estado-vacio" class="d-none"></div>
    <div id="estado-error" class="d-none"></div>
    <div id="contenedor-tabla" class="d-none">
      <table><tbody id="tabla-body"></tbody></table>
    </div>
    <div id="contenedor-cards"></div>
    <span id="info-resultados"></span>
    <div id="paginacion"></div>
    <input id="filtro-buscar" value="" />
    <button id="btn-filtrar"></button>
    <button id="btn-limpiar"></button>
    <button id="btn-reintentar"></button>
    <div id="modal-eliminar">
      <span id="modal-eliminar-nombre"></span>
      <span id="eliminar-texto"></span>
      <span id="eliminar-loading" class="d-none"></span>
      <button id="btn-confirmar-eliminar"></button>
    </div>
    <div id="toast-msg"><span id="toast-msg-texto"></span></div>
  `;
}

function makePage(overrides = {}) {
  return createCrudIndexPage({
    endpoint: '/widgets',
    slugs: { update: 'widgets.update', delete: 'widgets.delete' },
    buildRow: (w) =>
      `<tr><td>${w.name}</td><td><table-actions id="ta-desktop-${w.id}"></table-actions></td></tr>`,
    buildCard: (w) =>
      `<div class="card">${w.name}<table-actions id="ta-mobile-${w.id}"></table-actions></div>`,
    filters: () => ({ search: document.getElementById('filtro-buscar').value }),
    viewPath: (id) => '/widgets/' + id,
    editPath: (id) => '/widgets/crear?id=' + id,
    deleteOkMsg: 'Widget eliminado.',
    ...overrides,
  });
}

describe('createCrudIndexPage', () => {
  beforeEach(() => {
    mountFixture();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    http.get.mockResolvedValue({
      data: [{ id: 1, name: 'Uno' }],
      meta: { total: 1 },
    });
  });

  it('loads page 1 on init, renders rows and mounts table-actions', async () => {
    makePage().init();
    await vi.waitFor(() => {
      expect(document.getElementById('tabla-body').innerHTML).toContain('Uno');
    });

    expect(http.get).toHaveBeenCalledWith(
      '/widgets?page=1&per_page=15&search=',
    );
    expect(mount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 1,
        titulo: 'Uno',
        slugs: { update: 'widgets.update', delete: 'widgets.delete' },
      }),
    );
    expect(
      document.getElementById('contenedor-tabla').classList.contains('d-none'),
    ).toBe(false);
  });

  it('shows the empty state when the endpoint returns no items', async () => {
    http.get.mockResolvedValue({ data: [], meta: { total: 0 } });
    makePage().init();

    await vi.waitFor(() => {
      expect(
        document.getElementById('estado-vacio').classList.contains('d-none'),
      ).toBe(false);
    });
  });

  it('shows the error state when the request fails', async () => {
    http.get.mockRejectedValue(new Error('boom'));
    makePage().init();

    await vi.waitFor(() => {
      expect(
        document.getElementById('estado-error').classList.contains('d-none'),
      ).toBe(false);
    });
  });

  it('navigates on edit events and opens the delete flow end to end', async () => {
    http.delete.mockResolvedValue({});
    makePage().init();
    await vi.waitFor(() =>
      expect(document.getElementById('tabla-body').innerHTML).toContain('Uno'),
    );

    const tbody = document.getElementById('tabla-body');
    tbody.dispatchEvent(
      new CustomEvent('table-actions:edit', {
        detail: { id: 1, titulo: 'Uno' },
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith('/widgets/crear?id=1');

    tbody.dispatchEvent(
      new CustomEvent('table-actions:delete', {
        detail: { id: 1, titulo: 'Uno' },
      }),
    );
    expect(document.getElementById('modal-eliminar-nombre').textContent).toBe(
      'Uno',
    );

    document.getElementById('btn-confirmar-eliminar').click();
    await vi.waitFor(() => {
      expect(http.delete).toHaveBeenCalledWith('/widgets/1');
    });
    expect(document.getElementById('toast-msg-texto').textContent).toBe(
      'Widget eliminado.',
    );
  });
});
