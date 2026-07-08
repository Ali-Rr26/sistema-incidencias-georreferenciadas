/**
 * Login Component — lógica del formulario de inicio de sesión.
 *
 * R11 (frontend registration form): el mismo componente maneja los dos
 * modos (`login` y `register`) vía un toggle adyacente al título. El modo
 * por defecto es `login`, idéntico al comportamiento previo a R11. El
 * cambio de modo sólo afecta visibilidad + estado interno; la ruta `/login`
 * sigue siendo la misma, sin tocar la tabla de rutas del router.
 *
 * Reglas de UX (decisión de producto bloqueada en #2300):
 *   - Tras un 201, NO se redirige a otro lugar: se muestra el banner
 *     "Cuenta creada, iniciá sesión" y se vuelve al modo `login` para que
 *     el usuario tipee sus credenciales inmediatamente.
 *   - El método `auth.register()` no emite sesión: ningún token se guarda
 *     en sessionStorage (verificado por auth.service.register.test.js).
 *   - La validación cliente espeja las reglas del backend: ≥8 chars, ≥1
 *     mayúscula, ≥1 minúscula, ≥1 dígito, y `password === password_confirmation`.
 */
import { auth } from '../../auth.service.js';
import { router } from '../../../core/router.js';

const REGISTER_FORM_ID = 'register-form';

/**
 * Pure validator for the registration payload. Exported so unit tests
 * can exercise it directly; the component consumes the returned map to
 * render field-level errors. Returns an empty object when the payload is
 * valid. Mirrors backend RegisterRequest rules (R1–R4).
 *
 * @param {{ first_name?: string, last_name?: string, email?: string,
 *           password?: string, password_confirmation?: string }} payload
 * @returns {Record<string, string>}
 */
export function validateRegisterPayload(payload) {
  const errors = {};
  if (!payload.first_name || !payload.first_name.trim()) {
    errors.first_name = 'El nombre es obligatorio.';
  }
  if (!payload.last_name || !payload.last_name.trim()) {
    errors.last_name = 'El apellido es obligatorio.';
  }
  if (!payload.email || !payload.email.trim()) {
    errors.email = 'El correo es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    errors.email = 'Ingresá un correo válido.';
  }

  const password = payload.password || '';
  if (password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  } else if (!/[A-Z]/.test(password)) {
    errors.password =
      'La contraseña debe incluir al menos una letra mayúscula.';
  } else if (!/[a-z]/.test(password)) {
    errors.password =
      'La contraseña debe incluir al menos una letra minúscula.';
  } else if (!/[0-9]/.test(password)) {
    errors.password = 'La contraseña debe incluir al menos un dígito.';
  }

  if (
    !payload.password_confirmation ||
    payload.password !== payload.password_confirmation
  ) {
    errors.password_confirmation = 'Las contraseñas no coinciden.';
  }

  return errors;
}

export default {
  templateUrl: 'app/auth/pages/login/login.component.html',
  styleUrl: 'app/auth/pages/login/login.component.css',

  onInit(ctx) {
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

    // ─── R11: mode toggle + register form wiring ──────────────────────
    const container = document.querySelector('.gr-login');
    const registerForm = document.getElementById(REGISTER_FORM_ID);
    const registerBanner = document.getElementById('register-banner');

    /** Switch between 'login' and 'register' modes. */
    const setMode = (newMode) => {
      container.setAttribute('data-mode', newMode);
      form.classList.toggle('d-none', newMode !== 'login');
      if (registerForm) {
        registerForm.classList.toggle('d-none', newMode !== 'register');
      }
      document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
        const isActive = btn.dataset.modeBtn === newMode;
        btn.classList.toggle('gr-login__mode-btn--active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      // Reset transient state when switching modes.
      errorAlert.classList.add('d-none');
      this._clearFieldErrors();
      if (newMode === 'login') {
        registerBanner.classList.add('d-none');
      }
    };

    // Wire toggle buttons.
    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.modeBtn));
    });

    // If the URL carries ?registered=1, switch to login mode with the
    // banner visible — supports "you clicked an emailed magic link and
    // landed here" flows. Banner is hidden on every other mode switch.
    if (ctx?.query?.get('registered') === '1') {
      setMode('login');
      registerBanner.classList.remove('d-none');
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        this._handleRegisterSubmit(registerForm, registerBanner, setMode);
      });
    }

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
        const role = user?.role?.name;
        // citizen-style users land on /feed; everyone else on /dashboard.
        // Using router.navigate() (not window.location.hash) so the router
        // re-resolves and the role-based guards run with the fresh token.
        if (role === 'usuario') {
          router.navigate('/feed');
        } else {
          router.navigate('/dashboard');
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

  /**
   * Read all register fields, run client-side validation, render errors,
   * and on a valid payload POST /register. On 201 → show banner + switch
   * to login mode. On 422 → mirror the field errors into the form.
   */
  _handleRegisterSubmit(registerForm, registerBanner, setMode) {
    const payload = {
      first_name: registerForm.querySelector('#first_name').value.trim(),
      last_name: registerForm.querySelector('#last_name').value.trim(),
      email: registerForm.querySelector('#register-email').value.trim(),
      phone: registerForm.querySelector('#phone').value.trim(),
      password: registerForm.querySelector('#register-password').value,
      password_confirmation:
        registerForm.querySelector('#password_confirmation').value,
    };

    this._clearFieldErrors();

    const errors = validateRegisterPayload(payload);
    if (Object.keys(errors).length > 0) {
      this._renderFieldErrors(errors);
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Creando...';

    // Strip empty optional phone so backend receives null instead of ''.
    const wirePayload = { ...payload };
    if (!wirePayload.phone) delete wirePayload.phone;

    auth
      .register(wirePayload)
      .then(() => {
        // 201 path — banner + switch to login form so the user types
        // credentials immediately. No redirect, no token storage.
        registerBanner.classList.remove('d-none');
        registerForm.reset();
        setMode('login');
      })
      .catch((err) => {
        if (err?.status === 422 && err.errors) {
          this._renderFieldErrors(err.errors);
        } else {
          const errorAlert = document.getElementById('login-error');
          errorAlert.textContent =
            err?.message || 'No pudimos crear tu cuenta. Intentá de nuevo.';
          errorAlert.classList.remove('d-none');
        }
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  },

  _clearFieldErrors() {
    document.querySelectorAll('[data-error-for]').forEach((el) => {
      el.textContent = '';
      el.classList.add('d-none');
    });
  },

  _renderFieldErrors(errors) {
    Object.entries(errors).forEach(([field, messages]) => {
      const errorEl = document.querySelector(`[data-error-for="${field}"]`);
      if (!errorEl) return;
      const message = Array.isArray(messages) ? messages.join(' ') : messages;
      errorEl.textContent = message;
      errorEl.classList.remove('d-none');
    });
  },

  onDestroy() {
    // Sin cleanup necesario por ahora
  },
};