import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';
import { isForbidden } from '../../../../shared/forbidden.js';
import { renderAvatarCell } from '../../../../utils/avatar.js';

const POR_PAGINA = 15;

const ROLE_BADGES = {
  admin_sistema: '<span class="badge bg-danger">Admin Sistema</span>',
  operador_sistema:
    '<span class="badge bg-warning text-dark">Operador Sistema</span>',
  admin_organizacion: '<span class="badge bg-primary">Admin Org</span>',
  operador_organizacion:
    '<span class="badge bg-info text-dark">Operador Org</span>',
  usuario: '<span class="badge bg-secondary">Ciudadano</span>',
};

export default {
  templateUrl:
    'app/configuracion/usuarios/pages/index/usuarios.index.component.html',

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;
    let idEliminar = null;
    let roles = [];
    let organizaciones = [];

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

    function iniciales(user) {
      const n = (user.first_name?.[0] ?? '').toUpperCase();
      const a = (user.last_name?.[0] ?? '').toUpperCase();
      return n + a || 'U';
    }

    function renderTabla(datos, total) {
      if (!datos || datos.length === 0) {
        mostrarEstado('vacio');
        return;
      }

      document.getElementById('tabla-body').innerHTML = datos
        .map(
          (u) => `
                <tr>
                    ${renderAvatarCell(u)}
                    <td class="text-center"><input type="checkbox" class="form-check-input check-row" data-id="${u.id}" /></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-semibold">${u.first_name ?? ''} ${u.last_name ?? ''}</span>
                        </div>
                    </td>
                    <td class="small">${u.email}</td>
                    <td>${ROLE_BADGES[u.role?.name] ?? `<span class="badge bg-light text-dark border">${u.role?.name ?? '—'}</span>`}</td>
                    <td class="small text-muted">${u.organization?.name ?? '—'}</td>
                    <td class="small text-muted">${u.phone ?? '—'}</td>
                    <td class="text-center">
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${u.id}" title="Editar">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${u.id}" data-nombre="${u.first_name ?? ''} ${u.last_name ?? ''}" title="Eliminar">
                                <i class="fa-solid fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`,
        )
        .join('');

      document.getElementById('contenedor-cards').innerHTML = datos
        .map(
          (u) => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <span class="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center text-white"
                                    style="width:38px;height:38px;">${iniciales(u)}</span>
                                <div>
                                    <h6 class="mb-0">${u.first_name ?? ''} ${u.last_name ?? ''}</h6>
                                    <small class="text-muted">${u.email}</small><br>
                                    ${ROLE_BADGES[u.role?.name] ?? `<span class="badge bg-light text-dark border">${u.role?.name ?? '—'}</span>`}
                                    ${u.organization ? `<br><small class="text-muted">Org: ${u.organization.name}</small>` : ''}
                                </div>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${u.id}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${u.id}" data-nombre="${u.first_name ?? ''} ${u.last_name ?? ''}">
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
      const params = new URLSearchParams({
        page: paginaActual,
        per_page: POR_PAGINA,
        search: document.getElementById('filtro-buscar').value.trim(),
        role_id: document.getElementById('filtro-rol').value,
        organization_id: document.getElementById('filtro-org').value,
      });
      try {
        const resp = await http.get('/users?' + params.toString());
        const datos = resp.data ?? resp;
        const total = resp.meta?.total ?? resp.total ?? datos.length;
        totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
        renderTabla(datos, total);
      } catch (err) {
        // Defense in depth (R-24): a 403 means "you can see the route but
        // not the data" — usually a stale permission state, e.g. the
        // user lost the permission since the menu was loaded. Surface
        // it explicitly instead of masking it behind the generic
        // "no se pudo conectar con el servidor" panel.
        if (isForbidden(err)) {
          mostrarToast('No tienes acceso a este recurso.', 'warning');
        }
        mostrarEstado('error');
      }
    }

    async function cargarFiltros() {
      if (roles.length && organizaciones.length) return;

      try {
        const data = await http.get('/users/form-data');

        if (!roles.length) {
          roles = data.roles ?? [];
          const selRol = document.getElementById('filtro-rol');
          selRol.innerHTML = '<option value="">Todos los roles</option>';
          roles.forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            selRol.appendChild(opt);
          });
        }

        if (!organizaciones.length) {
          organizaciones = data.organizations ?? [];
          const selOrg = document.getElementById('filtro-org');
          selOrg.innerHTML = '<option value="">Todas las organizaciones</option>';
          organizaciones.forEach((o) => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            selOrg.appendChild(opt);
          });
        }
      } catch (err) {
        console.error('Error cargando filtros:', err);
      }
    }

    function delegarClicks(contenedor) {
      contenedor.addEventListener('click', async (e) => {
        const editar = e.target.closest('.btn-editar');
        const eliminar = e.target.closest('.btn-eliminar');
        if (editar) {
          router.navigate('/usuarios/crear?id=' + editar.dataset.id);
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
          await http.delete('/users/' + idEliminar);
          bootstrap.Modal.getInstance(
            document.getElementById('modal-eliminar'),
          ).hide();
          mostrarToast('Usuario eliminado.', 'success');
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
      document.getElementById('filtro-rol').value = '';
      document.getElementById('filtro-org').value = '';
      cargar(1);
    });
    document
      .getElementById('btn-reintentar')
      .addEventListener('click', () => cargar(paginaActual));

    cargarFiltros().catch(() => {});
    cargar(1);
  },

  onDestroy() {},
};
