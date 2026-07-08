/**
 * Login Component — lógica del formulario de inicio de sesión.
 */
import { auth } from '../../auth.service.js';
import { router } from '../../../core/router.js';
import { classifyRole } from '../../../app-shell/app-shell.component.js';

export default {
  templateUrl: 'app/auth/pages/login/login.component.html',
  styleUrl: 'app/auth/pages/login/login.component.css',

  onInit() {
    // Ocultar preloader (vanilla, nada de jQuery)
    const preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.style.display = 'none';
    }

    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorAlert = document.getElementById('login-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Resetear error
      errorAlert.classList.add('d-none');

      // Validación básica
      if (!emailInput.value.trim() || !passwordInput.value.trim()) {
        errorAlert.textContent = 'Completá todos los campos.';
        errorAlert.classList.remove('d-none');
        return;
      }

      // Estado loading
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Ingresando...';

      try {
        await auth.login(emailInput.value, passwordInput.value);
        // SECURITY: Always fetch /me after login to get the authoritative
        // role. The login response's `user` field lacks `role` and is for
        // UI display only.
        const user = await auth.me();
        // Set the router's role bucket synchronously BEFORE changing the
        // hash. The boot-time `syncCurrentUserRole()` in app.js runs
        // fire-and-forget on `auth.onAuthChange`, so without this call the
        // bucket is still 'guest' (or whatever the boot read) when
        // resolve() runs the role-mismatch guard. If the guard then
        // navigates to the SAME hash (e.g. /feed → /feed because the
        // bucket says 'citizen' but the target is /feed for citizen),
        // the browser does NOT fire `hashchange` and resolve() returns
        // without mounting anything → blank page.
        router.setCurrentUserRole(classifyRole(user));
        const role = user?.role?.name;
        // citizen-style users land on /feed; everyone else on /dashboard
        if (role === 'usuario') {
          window.location.hash = '#/feed';
        } else {
          window.location.hash = '#/dashboard';
        }
      } catch (err) {
        errorAlert.textContent =
          err.message || 'Error al iniciar sesión. Verificá tus credenciales.';
        errorAlert.classList.remove('d-none');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar Sesión';
      }
    });
  },

  onDestroy() {
    // Sin cleanup necesario por ahora
  },
};
