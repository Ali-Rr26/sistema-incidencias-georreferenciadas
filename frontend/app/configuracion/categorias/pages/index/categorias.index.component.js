import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';

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

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      document.getElementById('tabla-body').innerHTML = datos
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
              <td>
                <div class="d-flex gap-1">
                  <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${cat.id}" title="Editar">
                    <i class="fa-solid fa-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${cat.id}" data-nombre="${cat.name}" title="Eliminar">
                    <i class="fa-solid fa-trash-alt"></i>
                  </button>
                </div>
              </td>
            </tr>`,
        )
        .join('');

      document.getElementById('contenedor-cards').innerHTML = datos
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
                  <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${cat.id}">
                      <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${cat.id}" data-nombre="${cat.name}">
                      <i class="fa-solid fa-trash-alt"></i>
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
        if (err?.status === 403) {
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

    function delegarClicks(contenedor) {
      contenedor.addEventListener('click', (e) => {
        const editar = e.target.closest('.btn-editar');
        const eliminar = e.target.closest('.btn-eliminar');

        if (editar) {
          router.navigate('/categorias/crear?id=' + editar.dataset.id);
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
