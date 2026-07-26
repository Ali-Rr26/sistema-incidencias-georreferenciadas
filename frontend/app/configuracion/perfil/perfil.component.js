import template from './perfil.component.html?raw';
import style from './perfil.component.css?raw';
import { http } from '../../core/http.service.js';
import { auth } from '../../auth/auth.service.js';
import {
  AVATAR_MAX_KB,
  ACCEPTED_MIME_TYPES,
} from '../../utils/avatar.constants.js';
import { mountAvatarUploader } from '../../shared/avatar-uploader.js';
import { mostrarToast } from '../../utils/ui.js';

/** Module-scope so onDestroy can clean it up after the latest onInit. */
let _avatar = null;

/** Render the localized help text (extensions + max size). */
function renderAvatarHelp() {
  const avatarHelpText = document
    .querySelector('#perfil-avatar')
    ?.parentElement?.querySelector('.form-text');
  if (!avatarHelpText) return;
  const maxMb = (AVATAR_MAX_KB / 1024).toFixed(2).replace(/\.00$/, '0');
  const exts = ACCEPTED_MIME_TYPES.map((t) => t.split('/')[1].toUpperCase())
    .join(', ')
    .replace('JPEG', 'JPG');
  avatarHelpText.textContent = `${exts}. Máximo ${maxMb} MB. La imagen se recortará a 512×512 px.`;
}

export default {
  template,
  style,

  async onInit() {
    console.log('[Perfil] onInit called');

    // ─── Load current profile ────────────────────────────────────────

    let userData = {};
    try {
      console.log('[Perfil] Fetching /me');
      const resp = await http.get('/me');
      console.log('[Perfil] Response:', resp);
      userData = resp.data ?? resp;
      console.log('[Perfil] User data:', userData);
    } catch (err) {
      console.error('[Perfil] Error loading profile:', err);
      mostrarToast('Error al cargar el perfil.', 'danger');
    }

    const u = userData ?? {};
    document.getElementById('perfil-nombre').value = u.first_name ?? '';
    document.getElementById('perfil-apellido').value = u.last_name ?? '';
    const phoneEl = document.getElementById('perfil-telefono');
    if (phoneEl) {
      phoneEl.value = u.phone ?? '';
      phoneEl.addEventListener('input', function () {
        this.value = this.value.replace(/[^\d+-\s()]/g, '');
      });
    }
    const emailEl = document.getElementById('perfil-email');
    if (emailEl) {
      emailEl.value = u.email ?? '';
    }
    console.log('[Perfil] Fields populated');

    // Last updated timestamp (gated on D4 — only show if backend returns updated_at)
    const updatedAtEl = document.getElementById('perfil-updated-at');
    if (updatedAtEl) {
      if (u.updated_at) {
        updatedAtEl.textContent =
          'Última actualización: ' +
          new Date(u.updated_at).toLocaleString('es-EC');
        updatedAtEl.classList.remove('d-none');
      } else {
        updatedAtEl.classList.add('d-none');
      }
    }

    // ─── Avatar uploader (shared helper) ────────────────────────────

    if (_avatar) {
      _avatar.destroy();
    }
    _avatar = mountAvatarUploader({
      wrap: '#perfil-avatar-wrap-btn',
      preview: '#perfil-avatar-preview',
      input: '#perfil-avatar',
    });

    if (u.profile_image_path) {
      _avatar?.setPreviewFromUrl('/storage/' + u.profile_image_path);
    }

    renderAvatarHelp();

    // ─── Submit ─────────────────────────────────────────────────────

    document
      .getElementById('form-perfil')
      .addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
          this.classList.add('was-validated');
          return;
        }

        const avatarFile = _avatar?.getFile() ?? null;

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

          // Reset avatar input and update preview to newly uploaded image URL
          if (avatarFile) {
            const data = res.data ?? res;
            const newPath =
              data?.user?.profile_image_path ?? data?.profile_image_path;
            if (_avatar) {
              if (newPath) {
                _avatar.setPreviewFromUrl('/storage/' + newPath);
              } else {
                _avatar.clear();
              }
            }
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
    _avatar?.destroy();
    _avatar = null;
  },
};
