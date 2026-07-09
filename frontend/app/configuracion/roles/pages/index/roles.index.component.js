import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';

const POR_PAGINA = 15;

/**
 * Crea un <i> con clase FontAwesome.
 * @param {string} cls
 */
function faIcon(cls) {
  const i = document.createElement('i');
  i.className = cls;
  return i;
}

/**
 * Crea un <a> tipo botón (Bootstrap btn) con icono y label accesible.
 */
function btnLink(href, iconClass, title) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'btn btn-sm btn-outline-secondary';
  a.title = title;
  a.setAttribute('aria-label', title);
  a.appendChild(faIcon(iconClass));
  return a;
}

/**
 * Crea la fila de tabla para un rol.
 */
function buildRolRow(rol) {
  const tr = document.createElement('tr');

  const tdName = document.createElement('td');
  tdName.className = 'fw-semibold';
  const link = document.createElement('a');
  link.href = `#/roles/${rol.id}`;
  link.className = 'text-decoration-none';
  link.textContent = rol.name;
  tdName.appendChild(link);

  const tdCount = document.createElement('td');
  tdCount.className = 'text-center';
  const badge = document.createElement('span');
  badge.className = 'badge bg-secondary';
  badge.textContent = String(rol.permissions_count ?? '—');
  tdCount.appendChild(badge);

  const tdActions = document.createElement('td');
  tdActions.className = 'text-center';
  const btnGroup = document.createElement('div');
  btnGroup.className = 'd-flex gap-1 justify-content-center';
  btnGroup.appendChild(
    btnLink(`#/roles/${rol.id}`, 'fa-solid fa-key', 'Editar permisos'),
  );

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn-sm btn-outline-danger btn-eliminar';
  delBtn.dataset.id = String(rol.id);
  delBtn.dataset.nombre = rol.name;
  delBtn.title = 'Eliminar';
  delBtn.setAttribute('aria-label', 'Eliminar rol');
  delBtn.appendChild(faIcon('fa-solid fa-trash-alt'));
  btnGroup.appendChild(delBtn);

  tdActions.appendChild(btnGroup);

  tr.appendChild(tdName);
  tr.appendChild(tdCount);
  tr.appendChild(tdActions);
  return tr;
}

/**
 * Crea la card mobile para un rol.
 */
function buildRolCard(rol) {
  const card = document.createElement('div');
  card.className = 'card mb-2 shadow-sm';

  const body = document.createElement('div');
  body.className = 'card-body p-3';

  const row = document.createElement('div');
  row.className = 'd-flex justify-content-between align-items-center';

  const left = document.createElement('div');
  const title = document.createElement('h6');
  title.className = 'mb-0';
  const link = document.createElement('a');
  link.href = `#/roles/${rol.id}`;
  link.className = 'text-decoration-none';
  link.textContent = rol.name;
  title.appendChild(link);
  left.appendChild(title);

  const subtitle = document.createElement('small');
  subtitle.className = 'text-muted';
  subtitle.textContent = `${rol.permissions_count ?? 0} permisos`;
  left.appendChild(subtitle);

  const right = document.createElement('div');
  right.className = 'd-flex gap-1';
  right.appendChild(
    btnLink(`#/roles/${rol.id}`, 'fas fa-key', 'Editar permisos'),
  );

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn-sm btn-outline-danger btn-eliminar';
  delBtn.dataset.id = String(rol.id);
  delBtn.dataset.nombre = rol.name;
  delBtn.appendChild(faIcon('fas fa-trash-alt'));
  right.appendChild(delBtn);

  row.appendChild(left);
  row.appendChild(right);
  body.appendChild(row);
  card.appendChild(body);
  return card;
}

export default {
  templateUrl: 'app/configuracion/roles/pages/index/roles.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      if (!el) return;
      el.className = `toast align-items-center text-white border-0 bg-${tipo} position-fixed bottom-0 end-0 m-4`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      // eslint-disable-next-line no-undef
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

      const tbody = document.getElementById('tabla-body');
      tbody.replaceChildren(...datos.map(buildRolRow));

      const cards = document.getElementById('contenedor-cards');
      cards.replaceChildren(...datos.map(buildRolCard));

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
        if (err?.status === 403) {
          mostrarToast('No tienes acceso a este recurso.', 'warning');
        }
        mostrarEstado('error');
      }
    }

    function delegarClicks(contenedor) {
      if (!contenedor) return;
      contenedor.addEventListener('click', (e) => {
        const eliminar = e.target.closest('.btn-eliminar');
        if (eliminar) {
          idEliminar = eliminar.dataset.id;
          document.getElementById('modal-eliminar-nombre').textContent =
            eliminar.dataset.nombre;
          // eslint-disable-next-line no-undef
          new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
        }
      });
    }

    document.getElementById('btn-nuevo-rol').addEventListener('click', () => {
      router.navigate('/roles/0');
    });

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
          await http.delete('/roles/' + idEliminar);
          // eslint-disable-next-line no-undef
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
