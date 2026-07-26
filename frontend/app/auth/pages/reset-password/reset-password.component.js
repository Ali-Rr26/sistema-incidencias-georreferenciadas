import template from './reset-password.component.html?raw';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';

export default {
  template,

  async onInit({ query } = {}) {
    const token = query?.get('token');
    const email = query?.get('email');

    if (!token || !email) {
      document.getElementById('estado-error').classList.remove('d-none');
      document.getElementById('error-texto').textContent =
        'Enlace inválido. Solicita un nuevo restablecimiento de contraseña.';
      document.getElementById('reset-form').querySelector('button[type="submit"]').disabled = true;
      return;
    }

    // Eye toggle for password fields
    document.querySelectorAll('.gr-input-eye').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        if (input?.type === 'password') {
          input.type = 'text';
          btn.querySelector('i').className = 'fa-regular fa-eye-slash';
          btn.setAttribute('aria-label', 'Ocultar contraseña');
        } else if (input) {
          input.type = 'password';
          btn.querySelector('i').className = 'fa-regular fa-eye';
          btn.setAttribute('aria-label', 'Mostrar contraseña');
        }
      });
    });

    document.getElementById('reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) {
        e.target.classList.add('was-validated');
        return;
      }

      const password = document.getElementById('password').value;
      const passwordConfirmation = document.getElementById('password-confirm').value;

      if (password !== passwordConfirmation) {
        document.getElementById('error-texto').textContent = 'Las contraseñas no coinciden.';
        document.getElementById('estado-error').classList.remove('d-none');
        return;
      }

      document.getElementById('btn-texto').classList.add('d-none');
      document.getElementById('btn-loading').classList.remove('d-none');
      document.getElementById('btn-restablecer').disabled = true;
      document.getElementById('estado-error').classList.add('d-none');
      document.getElementById('estado-exito').classList.add('d-none');

      try {
        await http.post('/reset-password', {
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        });
        document.getElementById('estado-exito').classList.remove('d-none');
        document.getElementById('reset-form').querySelector('button[type="submit"]').disabled = true;
        // Redirect to login after a delay
        setTimeout(() => router.navigate('/login'), 3000);
      } catch (err) {
        const msg = err.status === 429
          ? 'Demasiados intentos. Intenta de nuevo en unos minutos.'
          : (err.response?.message ?? 'No se pudo restablecer la contraseña. El enlace puede haber expirado.');
        document.getElementById('error-texto').textContent = msg;
        document.getElementById('estado-error').classList.remove('d-none');
      } finally {
        document.getElementById('btn-texto').classList.remove('d-none');
        document.getElementById('btn-loading').classList.add('d-none');
        document.getElementById('btn-restablecer').disabled = false;
      }
    });
  },

  onDestroy() {},
};
