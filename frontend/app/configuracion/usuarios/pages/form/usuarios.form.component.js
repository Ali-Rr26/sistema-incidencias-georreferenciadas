import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import {
  initSelect,
  getSelect,
  destroyAll,
} from '../../../../shared/select-search.js';

export default defineComponent({
  templateUrl:
    'app/configuracion/usuarios/pages/form/usuarios.form.component.html',

  async onInit() {
    const esEdicion = router.queryParams.has('id');
    const userId = router.queryParams.get('id');

    const titulo = document.getElementById('form-titulo');
    const cardTitulo = document.getElementById('card-titulo');
    const breadcrumb = document.getElementById('breadcrumb-actual');

    if (esEdicion) {
      titulo.textContent = 'Editar Usuario';
      cardTitulo.textContent = 'Editar Usuario';
      breadcrumb.textContent = 'Editar';
    }

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      new bootstrap.Toast(el, { delay: 3000 }).show();
    }

    // ─── Cargar roles y organizaciones ──────────────────────────────

    async function cargarCombos() {
      try {
        const [rResp, oResp] = await Promise.all([
          http.get('/roles?per_page=100'),
          http.get('/organizations?per_page=200'),
        ]);

        const roles = rResp.data ?? rResp;
        const selRol = document.getElementById('user-rol');
        selRol.innerHTML = '<option value="">-- Seleccione Rol --</option>';
        roles.forEach((r) => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = r.name;
          selRol.appendChild(opt);
        });

        const orgs = oResp.data ?? oResp;
        const selOrg = document.getElementById('user-org');
        selOrg.innerHTML =
          '<option value="">-- Ninguna (Global / Sistema) --</option>';
        orgs.forEach((o) => {
          const opt = document.createElement('option');
          opt.value = o.id;
          opt.textContent = o.name;
          selOrg.appendChild(opt);
        });
      } catch (err) {
        console.error('Error cargando roles y organizaciones:', err);
      }
    }

    await cargarCombos();

    // ─── Tom Select ───────────────────────────────────────────────────
    initSelect('user-rol', { placeholder: 'Buscar rol...' });
    initSelect('user-org', { placeholder: 'Buscar organización...' });

    // ─── Si edición, cargar datos ────────────────────────────────────

    if (esEdicion) {
      try {
        const resp = await http.get('/users/' + userId);
        const u = resp.data ?? resp;
        document.getElementById('user-id').value = u.id;
        document.getElementById('user-nombre').value = u.first_name ?? '';
        document.getElementById('user-apellido').value = u.last_name ?? '';
        document.getElementById('user-email').value = u.email;
        document.getElementById('user-telefono').value = u.phone ?? '';

        getSelect('user-rol')?.setValue(u.role?.id ? String(u.role.id) : '');
        getSelect('user-org')?.setValue(
          u.organization?.id ? String(u.organization.id) : '',
        );
      } catch {
        mostrarToast('Error al cargar el usuario.', 'danger');
      }
    }

    // ─── Submit ──────────────────────────────────────────────────────

    document
      .getElementById('form-user')
      .addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
          this.classList.add('was-validated');
          return;
        }

        const id = document.getElementById('user-id').value;
        const orgVal = document.getElementById('user-org').value;

        const payload = {
          first_name: document.getElementById('user-nombre').value.trim(),
          last_name: document.getElementById('user-apellido').value.trim(),
          email: document.getElementById('user-email').value.trim(),
          role_id: parseInt(document.getElementById('user-rol').value),
          organization_id: orgVal ? parseInt(orgVal) : null,
          phone: document.getElementById('user-telefono').value.trim() || null,
        };

        if (!id) {
          // Generar una contraseña temporal de invitación
          payload.password =
            'Invite_' + Math.random().toString(36).substring(2, 10) + '!';
        }

        document.getElementById('user-btn-texto').classList.add('d-none');
        document.getElementById('user-btn-loading').classList.remove('d-none');
        document.getElementById('btn-guardar-user').disabled = true;

        try {
          if (id) {
            await http.put('/users/' + id, payload);
          } else {
            await http.post('/users', payload);
          }
          mostrarToast(
            id ? 'Usuario actualizado.' : 'Usuario creado.',
            'success',
          );
          router.navigate('/usuarios');
        } catch (err) {
          mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
        } finally {
          document.getElementById('user-btn-texto').classList.remove('d-none');
          document.getElementById('user-btn-loading').classList.add('d-none');
          document.getElementById('btn-guardar-user').disabled = false;
        }
      });
  },

  onDestroy() {
    destroyAll();
  },
});
