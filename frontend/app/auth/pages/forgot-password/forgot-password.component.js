import template from './forgot-password.component.html?raw';
import style from '../login/login.component.css?raw';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';

export default {
  template,
  style,

  async onInit() {
    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) {
        e.target.classList.add('was-validated');
        return;
      }

      const email = document.getElementById('email').value.trim();
      document.getElementById('btn-texto').classList.add('d-none');
      document.getElementById('btn-loading').classList.remove('d-none');
      document.getElementById('btn-enviar').disabled = true;
      document.getElementById('estado-error').classList.add('d-none');
      document.getElementById('estado-exito').classList.add('d-none');

      try {
        await http.post('/forgot-password', { email });
        document.getElementById('exito-texto').textContent =
          'Te hemos enviado un enlace de restablecimiento por correo electrónico.';
        document.getElementById('estado-exito').classList.remove('d-none');
        document.getElementById('email').value = '';
      } catch (err) {
        const msg = err.status === 429
          ? 'Demasiados intentos. Intenta de nuevo en unos minutos.'
          : (err.response?.message ?? 'No pudimos enviar el enlace. Verifica tu correo.');
        document.getElementById('error-texto').textContent = msg;
        document.getElementById('estado-error').classList.remove('d-none');
      } finally {
        document.getElementById('btn-texto').classList.remove('d-none');
        document.getElementById('btn-loading').classList.add('d-none');
        document.getElementById('btn-enviar').disabled = false;
      }
    });
  },

  onDestroy() {},
};
