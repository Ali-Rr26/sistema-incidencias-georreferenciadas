import { defineComponent } from '../../utils/component.js';
import { http } from '../../core/http.service.js';

function mostrarToast(mensaje, tipo) {
  const el = document.getElementById('toast-msg');
  el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
  document.getElementById('toast-msg-texto').textContent = mensaje;
  new bootstrap.Toast(el, { delay: 3000 }).show();
}

export default defineComponent({
  templateUrl: 'app/configuracion/perfil/perfil.component.html',

  async onInit() {
    // ─── Cargar perfil ────────────────────────────────────────

    try {
      const resp = await http.get('/auth/me');
      const u = resp.data ?? resp;
      document.getElementById('perfil-nombre').value = u.first_name ?? '';
      document.getElementById('perfil-apellido').value = u.last_name ?? '';
      document.getElementById('perfil-telefono').value = u.phone ?? '';
    } catch {
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

        const password = document.getElementById('perfil-password').value;
        if (password) {
          payload.password = password;
        }

        document.getElementById('perfil-btn-texto').classList.add('d-none');
        document
          .getElementById('perfil-btn-loading')
          .classList.remove('d-none');
        document.getElementById('btn-guardar-perfil').disabled = true;

        try {
          await http.put('/auth/profile', payload);
          mostrarToast('Perfil actualizado correctamente.', 'success');
        } catch (err) {
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
});
