import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';
import { isForbidden } from '../../../../shared/forbidden.js';
// eslint-disable-next-line no-unused-vars
import { permissionService } from '../../../../shared/permission.service.js';
import { mount } from '../../../../shared/table-actions/table-actions.component.js';

const POR_PAGINA = 15;

export default {
  templateUrl: 'app/configuracion/roles/pages/index/roles.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      if (!el) return;
      el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      new bootstrap.Toast(el, { delay: 3000 }).show();
    }

    function mostrarEstado(cual) {
      ['cargando', 'vacio', 'error', 'tabla'].forEach((s) => {
        const el = document.getElementById(
          s === 'tabla' ? 'contenedor-tabla' : 'estado-' + s,
        );
        if (el) el.classList.toggle('d-none', s !== cual);
      });
    }

    function isDesktop() {
      return window.matchMedia('(min-width: 768px)').matches;
    }

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      const esDesktop = isDesktop();
      const tbody = document.getElementById('tabla-body');
      const cards = document.getElementById('contenedor-cards');

      if (esDesktop) {
        tbody.innerHTML = datos
          .map(
            (rol) => `
                <tr>
                    <td class="fw-semibold">${rol.name}</td>
                    <td class="text-center"><span class="badge bg-secondary">${rol.permissions_count ?? 0}</span></td>
                    <td class="text-center">
                        <table-actions id="ta-desktop-${rol.id}"></table-actions>
                    </td>
                </tr>`,
          )
          .join('');

        datos.forEach((rol) => {
          const el = document.getElementById('ta-desktop-' + rol.id);
          if (el) {
            mount(el, {
              id: rol.id,
              titulo: rol.name,
              slugs: { update: 'roles.update', delete: 'roles.delete' },
            });
          }
        });

        cards.innerHTML = '';
      } else {
        tbody.innerHTML = '';
        cards.innerHTML = datos
          .map(
            (rol) => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${rol.name} <span class="badge bg-secondary ms-1">${rol.permissions_count ?? 0}</span></h6>
                            </div>
                            <table-actions id="ta-mobile-${rol.id}"></table-actions>
                        </div>
                    </div>
                </div>`,
          )
          .join('');

        datos.forEach((rol) => {
          const el = document.getElementById('ta-mobile-' + rol.id);
          if (el) {
            mount(el, {
              id: rol.id,
              titulo: rol.name,
              slugs: { update: 'roles.update', delete: 'roles.delete' },
            });
          }
        });
      }

      const desde = (paginaActual - 1) * POR_PAGINA + 1;
      const hasta = Math.min(paginaActual * POR_PAGINA, total);
      document.getElementById('info-resultados').textContent =
        `Mostrando ${desde}–${hasta} de ${total}`;

      renderPaginacion(
        document.getElementById('paginacion'),
        paginaActual,
        totalPaginas,
        cargar,
      );
      mostrarEstado('tabla');
    }

    async function cargar(pagina = 1) {
      paginaActual = pagina;
      mostrarEstado('cargando');

      const buscar = document.getElementById('filtro-buscar').value.trim();
      const params = new URLSearchParams({
        page: paginaActual,
        per_page: POR_PAGINA,
        ...(buscar ? { search: buscar } : {}),
      });

      try {
        const resp = await http.get('/roles?' + params.toString());
        const datos = resp.data ?? resp;
        const total = resp.meta?.total ?? resp.total ?? datos.length;
        totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
        renderTabla(datos, total);
      } catch (err) {
        // Defense in depth (R-24): distinguish 403 from generic failure.
        if (isForbidden(err)) {
          mostrarToast('No tienes acceso a este recurso.', 'warning');
        }
        mostrarEstado('error');
      }
    }

    // Delegated event handlers for table-actions custom events
    function manejarTableActions(e) {
      const { id, titulo } = e.detail;
      if (e.type === 'table-actions:view') {
        router.navigate('/roles/' + id);
        return;
      }
      if (e.type === 'table-actions:edit') {
        router.navigate('/roles/crear?id=' + id);
        return;
      }
      if (e.type === 'table-actions:delete') {
        idEliminar = id;
        document.getElementById('modal-eliminar-nombre').textContent = titulo;
        new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
      }
    }

    const tablaBody = document.getElementById('tabla-body');
    const contenedorCards = document.getElementById('contenedor-cards');

    tablaBody.addEventListener('table-actions:view', manejarTableActions);
    tablaBody.addEventListener('table-actions:edit', manejarTableActions);
    tablaBody.addEventListener('table-actions:delete', manejarTableActions);
    contenedorCards.addEventListener('table-actions:view', manejarTableActions);
    contenedorCards.addEventListener('table-actions:edit', manejarTableActions);
    contenedorCards.addEventListener('table-actions:delete', manejarTableActions);

    document.getElementById('btn-nuevo-rol').addEventListener('click', () => {
      router.navigate('/roles/0');
    });

    document
      .getElementById('btn-confirmar-eliminar')
      .addEventListener('click', async function () {
        if (!idEliminar) return;
        document.getElementById('eliminar-texto').classList.add('d-none');
        document.getElementById('eliminar-loading').classList.remove('d-none');
        this.disabled = true;
        try {
          await http.delete('/roles/' + idEliminar);
          bootstrap.Modal.getInstance(
            document.getElementById('modal-eliminar'),
          ).hide();
          mostrarToast('Rol eliminado.', 'success');
          cargar(paginaActual);
        } catch {
          mostrarToast('No se pudo eliminar.', 'danger');
        } finally {
          document.getElementById('eliminar-texto').classList.remove('d-none');
          document.getElementById('eliminar-loading').classList.add('d-none');
          document.getElementById('btn-confirmar-eliminar').disabled = false;
        }
      });

    document
      .getElementById('btn-filtrar')
      .addEventListener('click', () => cargar(1));
    document
      .getElementById('filtro-buscar')
      .addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cargar(1);
      });
    document.getElementById('btn-limpiar').addEventListener('click', () => {
      document.getElementById('filtro-buscar').value = '';
      cargar(1);
    });
    document
      .getElementById('btn-reintentar')
      .addEventListener('click', () => cargar(paginaActual));

    cargar(1);
  },

  onDestroy() {},
};
