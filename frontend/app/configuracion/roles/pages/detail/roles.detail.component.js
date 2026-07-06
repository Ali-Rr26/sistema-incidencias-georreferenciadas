import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';

/**
 * Construye un checkbox accesible con label y descripción opcional.
 */
function buildCheckbox(perm, checked) {
  const wrap = document.createElement('div');
  wrap.className = 'form-check';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'form-check-input perm-check';
  input.id = `perm-${perm.id}`;
  input.dataset.id = String(perm.id);
  input.value = String(perm.id);
  input.checked = checked;
  wrap.appendChild(input);

  const label = document.createElement('label');
  label.className = 'form-check-label';
  label.htmlFor = input.id;

  const strong = document.createElement('strong');
  strong.textContent = `${perm.action}`;
  label.appendChild(strong);

  if (perm.name) {
    const sep = document.createTextNode(' · ');
    label.appendChild(sep);
    const span = document.createElement('span');
    span.className = 'text-muted';
    span.textContent = perm.name;
    label.appendChild(span);
  }

  wrap.appendChild(label);

  if (perm.description) {
    const desc = document.createElement('div');
    desc.className = 'text-muted small ms-4';
    desc.textContent = perm.description;
    wrap.appendChild(desc);
  }

  return wrap;
}

/**
 * Construye un acordeón colapsable por resource.
 */
function buildResourceGroup(group, assignedIds) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-2 border rounded';

  const headerBtn = document.createElement('button');
  headerBtn.type = 'button';
  headerBtn.className =
    'btn btn-light w-100 d-flex justify-content-between align-items-center';
  headerBtn.setAttribute('data-bs-toggle', 'collapse');
  headerBtn.setAttribute('data-bs-target', `#grp-${group.resource}`);
  headerBtn.setAttribute('aria-expanded', 'true');

  const left = document.createElement('span');
  left.className = 'fw-semibold text-capitalize';
  left.textContent = group.resource;
  headerBtn.appendChild(left);

  const count = group.permissions.filter((p) => assignedIds.has(p.id)).length;
  const right = document.createElement('span');
  right.className = 'badge bg-secondary';
  right.textContent = `${count} / ${group.permissions.length}`;
  headerBtn.appendChild(right);

  wrap.appendChild(headerBtn);

  const collapse = document.createElement('div');
  collapse.className = 'collapse show';
  collapse.id = `grp-${group.resource}`;

  const body = document.createElement('div');
  body.className = 'p-3 border-top';

  group.permissions.forEach((perm) => {
    body.appendChild(buildCheckbox(perm, assignedIds.has(perm.id)));
  });

  collapse.appendChild(body);
  wrap.appendChild(collapse);

  return wrap;
}

export default defineComponent({
  templateUrl:
    'app/configuracion/roles/pages/detail/roles.detail.component.html',

  async onInit() {
    const params = window.__router.routeParams ?? {};
    const id = params.id;
    if (!id) {
      window.location.hash = '#/roles';
      return;
    }

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      if (!el) return;
      el.className = `toast align-items-center text-white border-0 bg-${tipo} position-fixed bottom-0 end-0 m-4`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      // eslint-disable-next-line no-undef
      new bootstrap.Toast(el, { delay: 3000 }).show();
    }

    function mostrarError(msg) {
      document.getElementById('estado-cargando').classList.add('d-none');
      document.getElementById('error-texto').textContent = msg;
      document.getElementById('estado-error').classList.remove('d-none');
    }

    async function cargarPermisos() {
      const resp = await http.get('/permissions');
      return resp.data ?? [];
    }

    async function cargarRol() {
      try {
        const [rol, grupos] = await Promise.all([
          http.get(`/roles/${id}`),
          cargarPermisos(),
        ]);

        const data = rol.data ?? rol;
        const permisosAsignados = new Set(
          (data.permissions ?? []).map((p) => p.id),
        );

        document.getElementById('rol-nombre').value = data.name ?? '';

        const gruposEl = document.getElementById('permisos-grupos');
        gruposEl.replaceChildren(
          ...grupos.map((g) => buildResourceGroup(g, permisosAsignados)),
        );

        function updateContador() {
          const total = document.querySelectorAll('.perm-check:checked').length;
          document.getElementById('contador-seleccionados').textContent = total;
        }
        gruposEl.addEventListener('change', (e) => {
          if (e.target.classList.contains('perm-check')) updateContador();
        });
        updateContador();

        document.getElementById('estado-cargando').classList.add('d-none');
        document.getElementById('contenido').classList.remove('d-none');
      } catch (err) {
        mostrarError(
          err.status === 404
            ? 'Rol no encontrado.'
            : 'No se pudo cargar el rol.',
        );
      }
    }

    document
      .getElementById('btn-guardar-nombre')
      .addEventListener('click', async () => {
        const nombre = document.getElementById('rol-nombre').value.trim();
        if (!nombre) {
          mostrarToast('El nombre es obligatorio.', 'danger');
          return;
        }
        try {
          await http.put(`/roles/${id}`, { name: nombre });
          mostrarToast('Nombre guardado.', 'success');
        } catch {
          mostrarToast('No se pudo guardar el nombre.', 'danger');
        }
      });

    document
      .getElementById('btn-guardar-permisos')
      .addEventListener('click', async () => {
        const checks = document.querySelectorAll('.perm-check:checked');
        const permissionIds = Array.from(checks).map((c) =>
          Number(c.dataset.id),
        );
        try {
          await http.put(`/roles/${id}/permissions`, {
            permissions: permissionIds,
          });
          mostrarToast('Permisos guardados.', 'success');
        } catch {
          mostrarToast('No se pudieron guardar los permisos.', 'danger');
        }
      });

    cargarRol();
  },

  onDestroy() {},
});
