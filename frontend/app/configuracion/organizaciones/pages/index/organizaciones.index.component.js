import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';

const POR_PAGINA = 15;

export default {
  templateUrl:
    'app/configuracion/organizaciones/pages/index/organizaciones.index.component.html',

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

    function formatearFecha(isoStr) {
      if (!isoStr) return '—';
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      const tbody = document.getElementById('tabla-body');
      tbody.innerHTML = datos
        .map(
          (org) => `
                <tr>
                    <td class="text-center"><input type="checkbox" class="form-check-input check-row" data-id="${org.id}" /></td>
                    <td class="fw-semibold">${org.name}</td>
                    <td class="text-muted small">${org.location?.name ?? '—'}</td>
                    <td class="small text-muted">${formatearFecha(org.created_at)}</td>
                    <td class="text-center">
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${org.id}" title="Editar">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${org.id}" data-nombre="${org.name}" title="Eliminar">
                                <i class="fa-solid fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`,
        )
        .join('');

      const cards = document.getElementById('contenedor-cards');
      cards.innerHTML = datos
        .map(
          (org) => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${org.name}</h6>
                                <small class="text-muted">${org.location?.name ?? '—'}</small>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${org.id}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${org.id}" data-nombre="${org.name}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`,
        )
        .join('');

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
        search: buscar,
      });

      try {
        const resp = await http.get('/organizations?' + params.toString());
        const datos = resp.data ?? resp;
        const total = resp.meta?.total ?? resp.total ?? datos.length;
        totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
        renderTabla(datos, total);
      } catch (err) {
        // Defense in depth (R-24): distinguish 403 from generic failure.
        if (err?.status === 403) {
          mostrarToast('No tienes acceso a este recurso.', 'warning');
        }
        mostrarEstado('error');
      }
    }

    function delegarClicks(contenedor) {
      if (!contenedor) return;
      contenedor.addEventListener('click', (e) => {
        const editar = e.target.closest('.btn-editar');
        const eliminar = e.target.closest('.btn-eliminar');
        if (editar) {
          router.navigate('/organizaciones/crear?id=' + editar.dataset.id);
        }
        if (eliminar) {
          idEliminar = eliminar.dataset.id;
          document.getElementById('modal-eliminar-nombre').textContent =
            eliminar.dataset.nombre;
          new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
        }
      });
    }

    delegarClicks(document.getElementById('tabla-body'));
    delegarClicks(document.getElementById('contenedor-cards'));

    document
      .getElementById('btn-confirmar-eliminar')
      .addEventListener('click', async function () {
        if (!idEliminar) return;
        document.getElementById('eliminar-texto').classList.add('d-none');
        document.getElementById('eliminar-loading').classList.remove('d-none');
        this.disabled = true;
        try {
          await http.delete('/organizations/' + idEliminar);
          bootstrap.Modal.getInstance(
            document.getElementById('modal-eliminar'),
          ).hide();
          mostrarToast('Organización eliminada.', 'success');
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
