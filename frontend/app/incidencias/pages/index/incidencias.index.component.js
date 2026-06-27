import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';
import { renderPaginacion } from '../../../shared/pagination/pagination.js';
import {
  initSelect,
  clearSelect,
  destroyAll,
} from '../../../shared/select-search.js';

const POR_PAGINA = 10;

export default defineComponent({
  templateUrl: 'app/incidencias/pages/index/incidencias.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;

    // Helpers
    function badgePrioridad(p) {
      const map = { high: 'danger', medium: 'warning', low: 'success' };
      const labels = { high: 'Alta', medium: 'Media', low: 'Baja' };
      const label = labels[p] || '—';
      return `<span class="badge bg-${map[p] || 'secondary'}">${label}</span>`;
    }

    function badgeEstado(e) {
      const map = {
        pending: { color: 'secondary', label: 'Pendiente' },
        in_progress: { color: 'primary', label: 'En proceso' },
        resolved: { color: 'success', label: 'Resuelto' },
      };
      const cfg = map[e] || { color: 'secondary', label: e || '—' };
      return `<span class="badge bg-${cfg.color}">${cfg.label}</span>`;
    }

    function formatearFecha(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    function mostrarEstado(cual) {
      ['cargando', 'vacio', 'error', 'tabla'].forEach((s) => {
        const el = document.getElementById(
          s === 'tabla' ? 'contenedor-tabla' : 'estado-' + s,
        );
        if (el) el.classList.toggle('d-none', s !== cual);
      });
    }

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      new bootstrap.Toast(el, { delay: 3000 }).show();
    }

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      const tbody = document.getElementById('tabla-body');
      tbody.innerHTML = datos
        .map((inc) => {
          const categoria = inc.category?.name || '—';
          const ubicacion = inc.location?.name || '—';
          return `<tr>
          <td class="ps-3 text-muted small">${inc.id}</td>
          <td>
            <span class="fw-semibold">${categoria}</span>
            <br><small class="text-muted">${inc.status.replace('_', ' ')} — ${badgePrioridad(inc.priority).replace(/^<span /, '<span style="font-size:0.7rem" ')}</small>
          </td>
          <td>${badgePrioridad(inc.priority)}</td>
          <td>
            <span class="small">${categoria}</span>
          </td>
          <td>${badgeEstado(inc.status)}</td>
          <td class="small text-muted">${ubicacion}</td>
          <td class="small text-muted">${formatearFecha(inc.created_at)}</td>
          <td class="text-center">
            <div class="d-flex justify-content-center gap-1">
              <a href="#/incidencias/${inc.id}" class="btn btn-sm btn-outline-primary" title="Ver detalle">
                <i class="fas fa-eye"></i>
              </a>
              <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar"
                data-id="${inc.id}" data-titulo="${categoria}" title="Eliminar">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>`;
        })
        .join('');

      const cards = document.getElementById('contenedor-cards');
      cards.innerHTML = datos
        .map((inc) => {
          const categoria = inc.category?.name || '—';
          const ubicacion = inc.location?.name || '—';
          return `
          <div class="card mb-2 shadow-sm">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <h6 class="card-title mb-0 me-2" style="font-size:.9rem;">${categoria}</h6>
                ${badgePrioridad(inc.priority)}
              </div>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <span class="badge bg-light text-dark border" style="font-size:.75rem;">
                  <i class="fas fa-tag" style="font-size:0.7rem;"></i>
                  ${categoria}
                </span>
                ${badgeEstado(inc.status)}
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">
                  <i class="fas fa-calendar-alt" style="font-size:0.75rem;"></i>
                  ${formatearFecha(inc.created_at)}
                </small>
                <small class="text-muted">
                  <i class="fas fa-map-marker-alt" style="font-size:0.75rem;"></i>
                  ${ubicacion}
                </small>
                <div class="d-flex gap-1">
                  <a href="#/incidencias/${inc.id}" class="btn btn-sm btn-outline-primary" title="Ver detalle">
                    <i class="fas fa-eye"></i>
                  </a>
                  <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar"
                    data-id="${inc.id}" data-titulo="${categoria}" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>`;
        })
        .join('');

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

      const params = new URLSearchParams({
        page: paginaActual,
        per_page: POR_PAGINA,
        priority: document.getElementById('filtro-prioridad').value,
        status: document.getElementById('filtro-estado').value,
      });

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

    // Eliminar handlers
    function abrirModalEliminar(e) {
      const btn = e.target.closest('.btn-eliminar');
      if (!btn) return;
      idEliminar = btn.dataset.id;
      document.getElementById('modal-eliminar-titulo').textContent =
        btn.dataset.titulo;
      new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
    }

    document
      .getElementById('tabla-body')
      .addEventListener('click', abrirModalEliminar);
    document
      .getElementById('contenedor-cards')
      .addEventListener('click', abrirModalEliminar);

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

    cargarIncidencias(1);
  },

  onDestroy() {
    destroyAll();
  },
});
