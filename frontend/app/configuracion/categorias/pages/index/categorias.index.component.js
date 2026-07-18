import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';
import { isForbidden } from '../../../../shared/forbidden.js';
// eslint-disable-next-line no-unused-vars
import { permissionService } from '../../../../shared/permission.service.js';
import { mount } from '../../../../shared/table-actions/table-actions.component.js';

const POR_PAGINA = 15;

export default {
  templateUrl:
    'app/configuracion/categorias/pages/index/categorias.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;
    let categoriasPadre = [];

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
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
            (cat) => `
            <tr>
              <td class="text-center"><input type="checkbox" class="form-check-input check-row" data-id="${cat.id}" /></td>
              <td class="fw-semibold">${cat.name}</td>
              <td>
                <span class="badge ${cat.parent_id ? 'bg-secondary' : 'bg-primary'}">
                  ${cat.parent_id ? 'Subcategoría' : 'Categoría Principal'}
                </span>
              </td>
              <td class="text-muted">${cat.parent?.name ?? '—'}</td>
              <td class="text-center">
                <table-actions id="ta-desktop-${cat.id}"></table-actions>
              </td>
            </tr>`,
          )
          .join('');

        datos.forEach((cat) => {
          const el = document.getElementById('ta-desktop-' + cat.id);
          if (el) {
            mount(el, {
              id: cat.id,
              titulo: cat.name,
              slugs: {
                update: 'incident-categories.update',
                delete: 'incident-categories.delete',
              },
              showView: false,
            });
          }
        });

        cards.innerHTML = '';
      } else {
        tbody.innerHTML = '';
        cards.innerHTML = datos
          .map(
            (cat) => `
            <div class="card mb-2 shadow-sm">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 class="mb-0">${cat.name}</h6>
                    <span class="badge ${cat.parent_id ? 'bg-secondary' : 'bg-primary'} mt-1">
                      ${cat.parent_id ? 'Subcategoría' : 'Categoría Principal'}
                    </span>
                    ${cat.parent ? `<br><small class="text-muted">Padre: ${cat.parent.name}</small>` : ''}
                  </div>
                  <table-actions id="ta-mobile-${cat.id}"></table-actions>
                </div>
              </div>
            </div>`,
          )
          .join('');

        datos.forEach((cat) => {
          const el = document.getElementById('ta-mobile-' + cat.id);
          if (el) {
            mount(el, {
              id: cat.id,
              titulo: cat.name,
              slugs: {
                update: 'incident-categories.update',
                delete: 'incident-categories.delete',
              },
              showView: false,
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
      const params = new URLSearchParams({
        page: paginaActual,
        per_page: POR_PAGINA,
        search: document.getElementById('filtro-buscar').value.trim(),
      });
      const padreVal = document.getElementById('filtro-padre').value;
      if (padreVal) {
        params.append('parent_id', padreVal);
      }
      try {
        const resp = await http.get(
          '/incident-categories?' + params.toString(),
        );
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

    async function cargarCategoriasPadre() {
      if (categoriasPadre.length) return;
      const resp = await http.get('/incident-categories?per_page=200');
      const todas = resp.data ?? resp;
      // Filtrar únicamente las principales (parent_id es null o vacio)
      categoriasPadre = todas.filter((c) => !c.parent_id);
      const sel = document.getElementById('filtro-padre');
      sel.innerHTML = '<option value="">Todas las categorías padre</option>';
      categoriasPadre.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        sel.appendChild(opt);
      });
    }

    // Delegated event handlers for table-actions custom events
    function manejarTableActions(e) {
      const { id, titulo } = e.detail;
      if (e.type === 'table-actions:view') {
        router.navigate('/categorias/' + id);
        return;
      }
      if (e.type === 'table-actions:edit') {
        router.navigate('/categorias/crear?id=' + id);
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
    contenedorCards.addEventListener(
      'table-actions:delete',
      manejarTableActions,
    );

    document
      .getElementById('btn-confirmar-eliminar')
      .addEventListener('click', async function () {
        if (!idEliminar) return;
        document.getElementById('eliminar-texto').classList.add('d-none');
        document.getElementById('eliminar-loading').classList.remove('d-none');
        this.disabled = true;
        try {
          await http.delete('/incident-categories/' + idEliminar);
          bootstrap.Modal.getInstance(
            document.getElementById('modal-eliminar'),
          ).hide();
          mostrarToast('Categoría eliminada.', 'success');
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
      document.getElementById('filtro-padre').value = '';
      cargar(1);
    });
    document
      .getElementById('btn-reintentar')
      .addEventListener('click', () => cargar(paginaActual));

    cargarCategoriasPadre().catch(() => {});
    cargar(1);
  },

  onDestroy() {},
};
