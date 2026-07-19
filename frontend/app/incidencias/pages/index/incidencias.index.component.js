import {
  badgeEstado,
  badgePrioridad,
  escapeHtml,
  formatearFecha,
} from '../../../utils/format.js';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';
import { renderPaginacion } from '../../../shared/pagination/pagination.js';
import { permissionService } from '../../../shared/permission.service.js';
import {
  initSelect,
  clearSelect,
  destroyAll,
} from '../../../shared/select-search.js';
import { mount } from '../../../shared/table-actions/table-actions.component.js';
import { isDesktop, mostrarEstado, mostrarToast } from '../../../utils/ui.js';

const POR_PAGINA = 10;

export default {
  templateUrl: 'app/incidencias/pages/index/incidencias.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      const esDesktop = isDesktop();
      const tbody = document.getElementById('tabla-body');
      const cards = document.getElementById('contenedor-cards');

      // Desktop: tabla
      if (esDesktop) {
        tbody.innerHTML = datos
          .map((inc) => {
            const categoria = inc.category?.name || '—';
            const ubicacion = inc.location?.name || '—';
            const titulo = inc.title || 'Sin título';
            return `<tr data-id="${inc.id}" style="cursor:pointer;" class="lista-row">
            <td class="text-center"><input type="checkbox" class="form-check-input check-row" data-id="${inc.id}" /></td>
            <td>
              <div style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${inc.title ?? ''}">
                <span class="fw-semibold">${titulo}</span>
              </div>
              <small class="text-muted">${categoria}</small>
            </td>
            <td>${badgePrioridad(inc.priority)}</td>
            <td>${badgeEstado(inc.status)}</td>
            <td class="small text-muted">${ubicacion}</td>
            <td class="small text-muted">${formatearFecha(inc.created_at)}</td>
            <td class="text-center">
              <table-actions id="ta-desktop-${inc.id}"></table-actions>
            </td>
          </tr>`;
          })
          .join('');

        // Mount table-actions on each row (async — does not block DOM insertion)
        datos.forEach((inc) => {
          const el = document.getElementById('ta-desktop-' + inc.id);
          if (el) {
            mount(el, {
              id: inc.id,
              titulo: inc.title || 'Sin título',
              slugs: { update: 'incidents.update', delete: 'incidents.delete' },
            });
          }
        });

        cards.innerHTML = '';
      } else {
        // Mobile: cards — compact layout sin scroll horizontal
        tbody.innerHTML = '';
        cards.innerHTML = datos
          .map((inc) => {
            const categoria = inc.category?.name || '—';
            const ubicacion = inc.location?.name || '—';
            const titulo = inc.title || 'Sin título';
            return `
            <div class="card mb-2 shadow-sm lista-card" data-id="${inc.id}" style="cursor:pointer;">
              <div class="card-body p-1" style="padding:0.75rem !important;">
                <!-- Título y categoría -->
                <div class="mb-1">
                  <h6 class="card-title mb-0" style="font-size:0.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(titulo)}</h6>
                  <small class="text-muted" style="font-size:0.75rem;">${escapeHtml(categoria)}</small>
                </div>

                <!-- Prioridad y Estado -->
                <div class="d-flex gap-1 mb-2" style="font-size:0.75rem;">
                  ${badgePrioridad(inc.priority)}
                  ${badgeEstado(inc.status)}
                </div>

                <!-- Metadata (fecha, ubicación) -->
                <div class="mb-2" style="font-size:0.7rem;">
                  <div class="text-muted mb-1">
                    <i class="fas fa-calendar-alt" style="width:12px;"></i>
                    ${formatearFecha(inc.created_at)}
                  </div>
                  <div class="text-muted">
                    <i class="fas fa-map-marker-alt" style="width:12px;"></i>
                    <span style="overflow:hidden;text-overflow:ellipsis;display:inline-block;max-width:180px;vertical-align:middle;">
                      ${escapeHtml(ubicacion)}
                    </span>
                  </div>
                </div>

                <!-- table-actions component (Ver + kebab dropdown) -->
                <div class="d-flex gap-1 justify-content-end">
                  <table-actions id="ta-mobile-${inc.id}"></table-actions>
                </div>
              </div>
            </div>`;
          })
          .join('');

        // Mount table-actions on each mobile card (async — does not block DOM insertion)
        datos.forEach((inc) => {
          const el = document.getElementById('ta-mobile-' + inc.id);
          if (el) {
            mount(el, {
              id: inc.id,
              titulo: inc.title || 'Sin título',
              slugs: { update: 'incidents.update', delete: 'incidents.delete' },
            });
          }
        });
      }

      const desde = (paginaActual - 1) * POR_PAGINA + 1;
      const hasta = Math.min(paginaActual * POR_PAGINA, total);
      document.getElementById('info-resultados').textContent =
        `Mostrando ${desde}–${hasta} de ${total} incidencias`;

      renderPaginacion(
        document.getElementById('paginacion'),
        paginaActual,
        totalPaginas,
        cargarIncidencias,
      );
      mostrarEstado('tabla');
    }

    async function cargarIncidencias(pagina) {
      paginaActual = pagina || 1;
      mostrarEstado('cargando');

      const buscar = document.getElementById('filtro-buscar').value.trim();
      const params = new URLSearchParams({
        page: paginaActual,
        per_page: POR_PAGINA,
        priority: document.getElementById('filtro-prioridad').value,
        status: document.getElementById('filtro-estado').value,
      });
      if (buscar) params.set('title', buscar);

      try {
        const resp = await http.get('/incidents?' + params.toString());
        const datos = resp.data || resp;
        const total = resp.meta?.total || datos.length;
        totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
        renderTabla(datos, total);
      } catch {
        mostrarEstado('error');
      }
    }

    // Delegated event listeners for table-actions custom events
    function manejarTableActions(e) {
      const { id, titulo } = e.detail;
      if (e.type === 'table-actions:view') {
        router.navigate('/incidencias/' + id);
        return;
      }
      if (e.type === 'table-actions:edit') {
        router.navigate('/incidencias/crear?id=' + id);
        return;
      }
      if (e.type === 'table-actions:delete') {
        idEliminar = id;
        document.getElementById('modal-eliminar-titulo').textContent = titulo;
        new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
      }
    }

    const tablaBody = document.getElementById('tabla-body');
    const contenedorCards = document.getElementById('contenedor-cards');

    // Delegate table-actions:view/edit/delete from both desktop table and mobile cards
    tablaBody.addEventListener('table-actions:view', manejarTableActions);
    tablaBody.addEventListener('table-actions:edit', manejarTableActions);
    tablaBody.addEventListener('table-actions:delete', manejarTableActions);
    contenedorCards.addEventListener('table-actions:view', manejarTableActions);
    contenedorCards.addEventListener('table-actions:edit', manejarTableActions);
    contenedorCards.addEventListener(
      'table-actions:delete',
      manejarTableActions,
    );

    // Double-click handlers: abrir detalle
    function manejarDobleClic(e) {
      const fila = e.target.closest('.lista-row, .lista-card');
      if (!fila) return;
      const id = fila.dataset.id;
      if (id) router.navigate('/incidencias/' + id);
    }

    document
      .getElementById('tabla-body')
      .addEventListener('dblclick', manejarDobleClic);
    document
      .getElementById('contenedor-cards')
      .addEventListener('dblclick', manejarDobleClic);

    document
      .getElementById('btn-confirmar-eliminar')
      .addEventListener('click', async function () {
        if (!idEliminar) return;
        document.getElementById('eliminar-texto').classList.add('d-none');
        document.getElementById('eliminar-loading').classList.remove('d-none');
        this.disabled = true;

        try {
          await http.delete('/incidents/' + idEliminar);
          bootstrap.Modal.getInstance(
            document.getElementById('modal-eliminar'),
          ).hide();
          mostrarToast('Incidencia eliminada correctamente.', 'success');
          cargarIncidencias(paginaActual);
        } catch {
          mostrarToast('No se pudo eliminar la incidencia.', 'danger');
        } finally {
          document.getElementById('eliminar-texto').classList.remove('d-none');
          document.getElementById('eliminar-loading').classList.add('d-none');
          document.getElementById('btn-confirmar-eliminar').disabled = false;
        }
      });

    // Filter handlers
    document
      .getElementById('btn-filtrar')
      .addEventListener('click', () => cargarIncidencias(1));
    document
      .getElementById('filtro-buscar')
      .addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cargarIncidencias(1);
      });
    document.getElementById('btn-limpiar').addEventListener('click', () => {
      document.getElementById('filtro-buscar').value = '';
      clearSelect('filtro-prioridad');
      clearSelect('filtro-estado');
      cargarIncidencias(1);
    });
    document
      .getElementById('btn-reintentar')
      .addEventListener('click', () => cargarIncidencias(paginaActual));

    // ─── Tom Select en filtros ─────────────────────────────────────────
    initSelect('filtro-prioridad', { placeholder: 'Buscar prioridad...' });
    initSelect('filtro-estado', { placeholder: 'Buscar estado...' });

    // "Nueva incidencia" is the sole entry point to /incidencias/crear now
    // (menu_id 4 was removed from MenuSeeder) — its permission gate moved
    // here client-side. Fail closed: no confirmed permission, stays hidden.
    let permisos;
    try {
      permisos = await permissionService.getMyPermissions();
    } catch {
      permisos = new Set();
    }
    if (permisos.has('incidents.manage')) {
      document
        .getElementById('btn-nueva-incidencia')
        ?.classList.remove('d-none');
      document
        .getElementById('btn-registrar-primera')
        ?.classList.remove('d-none');
    }

    cargarIncidencias(1);
  },

  onDestroy() {
    destroyAll();
  },
};
