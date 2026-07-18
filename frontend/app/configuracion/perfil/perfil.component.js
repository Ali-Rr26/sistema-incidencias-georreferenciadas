import { http } from '../../core/http.service.js';
import { auth } from '../../auth/auth.service.js';

/** Shared object URL for avatar preview — revoked on destroy/submit to avoid memory leaks */
let _avatarObjectUrl = null;

function mostrarToast(mensaje, tipo) {
  const el = document.getElementById('toast-msg');
  el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
  document.getElementById('toast-msg-texto').textContent = mensaje;
  new bootstrap.Toast(el, { delay: 3000 }).show();
}

export default {
  templateUrl: 'app/configuracion/perfil/perfil.component.html',

  async onInit() {
    console.log('[Perfil] onInit called');

    // ─── Cargar perfil ────────────────────────────────────────

    try {
      console.log('[Perfil] Fetching /me');
      const resp = await http.get('/me');
      console.log('[Perfil] Response:', resp);
      const u = resp.data ?? resp;
      console.log('[Perfil] User data:', u);
      document.getElementById('perfil-nombre').value = u.first_name ?? '';
      document.getElementById('perfil-apellido').value = u.last_name ?? '';
      document.getElementById('perfil-telefono').value = u.phone ?? '';
      console.log('[Perfil] Fields populated');

      // Show existing avatar preview if profile_image_path is set
      if (u.profile_image_path) {
        const preview = document.getElementById('perfil-avatar-preview');
        if (preview) {
          preview.src = '/storage/' + u.profile_image_path;
          preview.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('[Perfil] Error loading profile:', err);
      mostrarToast('Error al cargar el perfil.', 'danger');
    }

    // ─── Avatar preview ────────────────────────────────────────

    const avatarInput = document.getElementById('perfil-avatar');
    const avatarPreview = document.getElementById('perfil-avatar-preview');

    if (avatarInput && avatarPreview) {
      avatarInput.addEventListener('change', function () {
        // Revoke previous blob URL to avoid memory leaks
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
    } else {
      // Defensive: when avatar elements are absent (legacy DOM), treat as no file
      console.warn('[Perfil] Avatar input/preview elements not found in DOM');
    }

    // ─── Submit ───────────────────────────────────────────────

    document
      .getElementById('form-perfil')
      .addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
          this.classList.add('was-validated');
          return;
        }

        const avatarFile =
          document.getElementById('perfil-avatar')?.files?.[0] ?? null;

        // Build payload — FormData when avatar is present, plain object otherwise
        let body;
        if (avatarFile) {
          body = new FormData();
          body.append('avatar', avatarFile);
          body.append(
            'first_name',
            document.getElementById('perfil-nombre').value.trim(),
          );
          body.append(
            'last_name',
            document.getElementById('perfil-apellido').value.trim(),
          );
          body.append(
            'phone',
            document.getElementById('perfil-telefono').value.trim() || null,
          );
        } else {
          body = {
            first_name: document.getElementById('perfil-nombre').value.trim(),
            last_name: document.getElementById('perfil-apellido').value.trim(),
            phone:
              document.getElementById('perfil-telefono').value.trim() || null,
          };
        }

        console.log('[Perfil] Submitting payload:', body);

        document.getElementById('perfil-btn-texto').classList.add('d-none');
        document
          .getElementById('perfil-btn-loading')
          .classList.remove('d-none');
        document.getElementById('btn-guardar-perfil').disabled = true;

        try {
          const res = await http.put('/auth/profile', body);
          console.log('[Perfil] Update success:', res);
          mostrarToast('Perfil actualizado correctamente.', 'success');

          // Refresh auth state so app-shell header re-renders with new avatar
          await auth.me();
          auth._notifyAuthChange();

          // Reset avatar preview after successful upload
          if (avatarFile && _avatarObjectUrl) {
            URL.revokeObjectURL(_avatarObjectUrl);
            _avatarObjectUrl = null;
            const preview = document.getElementById('perfil-avatar-preview');
            if (preview) {
              preview.style.display = 'none';
              preview.src = '';
            }
            avatarInput.value = '';
          }
        } catch (err) {
          console.error('[Perfil] Update error:', err);
          mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
        } finally {
          document
            .getElementById('perfil-btn-texto')
            .classList.remove('d-none');
          document.getElementById('perfil-btn-loading').classList.add('d-none');
          document.getElementById('btn-guardar-perfil').disabled = false;
        }
      });
  },

  onDestroy() {
    if (_avatarObjectUrl) {
      URL.revokeObjectURL(_avatarObjectUrl);
      _avatarObjectUrl = null;
    }
  },
};
