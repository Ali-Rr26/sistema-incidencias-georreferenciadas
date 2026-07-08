import { http } from '../../core/http.service.js';

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
    } catch (err) {
      console.error('[Perfil] Error loading profile:', err);
      mostrarToast('Error al cargar el perfil.', 'danger');
    }

    // ─── Submit ────────────────────────────────────────────────

    document
      .getElementById('form-perfil')
      .addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
          this.classList.add('was-validated');
          return;
        }

        const payload = {
          first_name: document.getElementById('perfil-nombre').value.trim(),
          last_name: document.getElementById('perfil-apellido').value.trim(),
          phone:
            document.getElementById('perfil-telefono').value.trim() || null,
        };

        console.log('[Perfil] Submitting payload:', payload);

        document.getElementById('perfil-btn-texto').classList.add('d-none');
        document
          .getElementById('perfil-btn-loading')
          .classList.remove('d-none');
        document.getElementById('btn-guardar-perfil').disabled = true;

        try {
          const res = await http.put('/auth/profile', payload);
          console.log('[Perfil] Update success:', res);
          mostrarToast('Perfil actualizado correctamente.', 'success');
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
    // No special cleanup needed
  },
};
