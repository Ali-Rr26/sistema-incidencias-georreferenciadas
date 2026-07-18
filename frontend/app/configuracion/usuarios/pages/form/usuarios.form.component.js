import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { auth } from '../../../../auth/auth.service.js';
import {
  initSelect,
  getSelect,
  destroyAll,
} from '../../../../shared/select-search.js';

/** Shared object URL for avatar preview — revoked on destroy to avoid memory leaks */
let _avatarObjectUrl = null;

export default {
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

    // ─── Poblar selects con catálogo ──────────────────────────────────

    function poblarCombos({ roles, organizations }) {
      const selRol = document.getElementById('user-rol');
      selRol.innerHTML = '<option value="">-- Seleccione Rol --</option>';
      roles.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        selRol.appendChild(opt);
      });

      const selOrg = document.getElementById('user-org');
      selOrg.innerHTML =
        '<option value="">-- Ninguna (Global / Sistema) --</option>';
      organizations.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        selOrg.appendChild(opt);
      });
    }

    // ─── Carga inicial ────────────────────────────────────────────────
    // Edit:   GET /users/:id  →  user data + catalog (single request)
    // Create: GET /users/form-data  →  catalog only

    if (esEdicion) {
      try {
        const resp = await http.get('/users/' + userId);
        const u = resp.data ?? resp;

        poblarCombos({
          roles: u.roles ?? [],
          organizations: u.organizations ?? [],
        });

        // Tom Select must be initialized AFTER options are in the DOM.
        initSelect('user-rol', { placeholder: 'Buscar rol...' });
        initSelect('user-org', { placeholder: 'Buscar organización...' });

        document.getElementById('user-id').value = u.id;
        document.getElementById('user-nombre').value = u.first_name ?? '';
        document.getElementById('user-apellido').value = u.last_name ?? '';
        document.getElementById('user-email').value = u.email;
        document.getElementById('user-telefono').value = u.phone ?? '';

        getSelect('user-rol')?.setValue(u.role?.id ? String(u.role.id) : '');
        getSelect('user-org')?.setValue(
          u.organization?.id ? String(u.organization.id) : '',
        );

        // Show existing avatar preview if profile_image_path is set
        if (u.profile_image_path) {
          const preview = document.getElementById('user-avatar-preview');
          if (preview) {
            preview.src = '/storage/' + u.profile_image_path;
            preview.style.display = 'block';
          }
        }
      } catch {
        mostrarToast('Error al cargar el usuario.', 'danger');
      }
    } else {
      try {
        const data = await http.get('/users/form-data');
        poblarCombos(data);
      } catch (err) {
        console.error('Error cargando roles y organizaciones:', err);
      }

      initSelect('user-rol', { placeholder: 'Buscar rol...' });
      initSelect('user-org', { placeholder: 'Buscar organización...' });
    }

    // ─── Avatar preview ──────────────────────────────────────────────

    const avatarInput = document.getElementById('user-avatar');
    const avatarPreview = document.getElementById('user-avatar-preview');

    if (avatarInput && avatarPreview) {
      avatarInput.addEventListener('change', function () {
        if (_avatarObjectUrl) {
          URL.revokeObjectURL(_avatarObjectUrl);
          _avatarObjectUrl = null;
        }

        const file = this.files && this.files[0];
        if (!file) {
          avatarPreview.style.display = 'none';
          avatarPreview.src = '';
          return;
        }

        _avatarObjectUrl = URL.createObjectURL(file);
        avatarPreview.src = _avatarObjectUrl;
        avatarPreview.style.display = 'block';
      });
    }

    // ─── Avatar upload button ─────────────────────────────────────────

    const uploadBtn = document.getElementById('btn-upload-avatar');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async function () {
        const file = avatarInput?.files?.[0];
        if (!file) {
          mostrarToast('Seleccioná una imagen primero.', 'warning');
          return;
        }

        uploadBtn.disabled = true;
        try {
          const formData = new FormData();
          formData.append('avatar', file);

          const updatedUser = await http.post(
            '/api/users/' + userId + '/avatar',
            formData,
          );
          const u = updatedUser.data ?? updatedUser;

          mostrarToast('Foto actualizada correctamente.', 'success');

          // Refresh auth state so header re-renders with new avatar
          await auth.me();
          auth._notifyAuthChange();

          // Update preview with new image
          if (avatarPreview && u.profile_image_path) {
            avatarPreview.src = '/storage/' + u.profile_image_path;
            avatarPreview.style.display = 'block';
          }

          // Clear file input and revoke preview URL
          if (_avatarObjectUrl) {
            URL.revokeObjectURL(_avatarObjectUrl);
            _avatarObjectUrl = null;
          }
          if (avatarInput) avatarInput.value = '';
        } catch (err) {
          mostrarToast(err.message ?? 'No se pudo subir la foto.', 'danger');
        } finally {
          uploadBtn.disabled = false;
        }
      });
    }

    // ─── Avatar delete button ────────────────────────────────────────

    const deleteBtn = document.getElementById('btn-delete-avatar');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async function () {
        if (!confirm('¿Eliminar la foto de perfil?')) return;

        deleteBtn.disabled = true;
        try {
          await http.delete('/api/users/' + userId + '/avatar');

          mostrarToast('Foto eliminada.', 'success');

          // Refresh auth state so header re-renders
          await auth.me();
          auth._notifyAuthChange();

          // Clear preview
          if (_avatarObjectUrl) {
            URL.revokeObjectURL(_avatarObjectUrl);
            _avatarObjectUrl = null;
          }
          if (avatarPreview) {
            avatarPreview.style.display = 'none';
            avatarPreview.src = '';
          }
          if (avatarInput) avatarInput.value = '';
        } catch (err) {
          mostrarToast(err.message ?? 'No se pudo eliminar la foto.', 'danger');
        } finally {
          deleteBtn.disabled = false;
        }
      });
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
    if (_avatarObjectUrl) {
      URL.revokeObjectURL(_avatarObjectUrl);
      _avatarObjectUrl = null;
    }
  },
};
