import { http } from '../../core/http.service.js';
import { auth } from '../../auth/auth.service.js';
import {
  AVATAR_MAX_KB,
  ACCEPTED_MIME_TYPES,
} from '../../utils/avatar.constants.js';

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
  // Scoped CSS — the custom router in core/router.js injects this <style>
  // when styleUrl is set. Without it, .perfil-grid / .perfil-card /
  // .perfil-avatar-wrap / .perfil-input etc. never load and the page
  // renders with the pre-redesign look (HTML keeps the new classes but no
  // styles apply). All other scoped-CSS components in the codebase
  // (mapa, feed, login, dashboard, …) declare this; perfil was the only
  // omission.
  styleUrl: 'app/configuracion/perfil/perfil.component.css',

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

    // ─── Click on avatar wrap wires to hidden file input ──────────────

    const avatarWrapBtn = document.getElementById('perfil-avatar-wrap-btn');
    if (avatarWrapBtn && avatarInput) {
      avatarWrapBtn.addEventListener('click', () => avatarInput.click());
    } else {
      console.warn(
        '[Perfil] Avatar wrap button or avatar input not found in DOM',
      );
    }

    // ─── Avatar constants (sourced from backend) ─────────────────
    if (avatarInput) {
      avatarInput.accept = ACCEPTED_MIME_TYPES.join(',');
    }
    const avatarHelpText = document
      .querySelector('#perfil-avatar')
      ?.parentElement?.querySelector('.form-text');
    if (avatarHelpText) {
      const maxMb = (AVATAR_MAX_KB / 1024).toFixed(2).replace(/\.00$/, '0');
      const exts = ACCEPTED_MIME_TYPES.map((t) => t.split('/')[1].toUpperCase())
        .join(', ')
        .replace('JPEG', 'JPG');
      avatarHelpText.textContent = `${exts}. Máximo ${maxMb} MB. La imagen se recortará a 512×512 px.`;
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

          // Reset avatar input and update preview to newly uploaded image URL
          if (avatarFile && _avatarObjectUrl) {
            URL.revokeObjectURL(_avatarObjectUrl);
            _avatarObjectUrl = null;
            const preview = document.getElementById('perfil-avatar-preview');
            const data = res.data ?? res;
            const newPath =
              data?.user?.profile_image_path ?? data?.profile_image_path;
            if (preview && newPath) {
              preview.src = '/storage/' + newPath;
              preview.style.display = 'block';
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
