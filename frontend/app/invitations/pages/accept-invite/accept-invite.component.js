/**
 * accept-invite.component.js — WU-4: invitation acceptance page.
 *
 * Spec: R-INV-11 (form visibility + token handling) and R-INV-14
 * (submit + error handling).
 *
 * URL contract: /accept-invite?token=<plaintext>
 *   - No token → error state, form disabled
 *   - Valid token → form enabled
 *   - Submit valid → authService.acceptInvitation() → redirect /login?accepted=1
 *   - 410 → "Esta invitación ya fue usada o expiró. Pedile al administrador…"
 *   - 404 → "Invitación inválida"
 *   - 422 → field-level errors from backend
 *
 * The component is a plain module (no class), matching the login.component
 * pattern: `template`, `style`, `onInit(ctx)`, `onDestroy()`.
 */
import template from './accept-invite.component.html?raw';
import style from './accept-invite.component.css?raw';
import { auth } from '../../../auth/auth.service.js';
import { validateAcceptPayload } from '../../invitation.service.js';
import { router } from '../../../core/router.js';
import { InvitationGoneError } from '../../invitation.service.js';
import { InvitationNotFoundError } from '../../invitation.service.js';

/**
 * Read the invitation token from window.location.search.
 * Returns null when the token parameter is missing.
 */
function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || null;
}

export default {
  template,
  style,

  onInit() {
    // Hide preloader if any.
    const preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.style.display = 'none';
    }

    const token = getTokenFromUrl();
    const form = document.getElementById('accept-invite-form');
    const errorAlert = document.getElementById('accept-invite-error');
    const successAlert = document.getElementById('accept-invite-success');
    const submitBtn = document.getElementById('btn-activar');

    if (!token) {
      // Missing token — show error, keep form hidden.
      errorAlert.textContent =
        'Esta URL no contiene un token de invitación. ' +
        'Pedile al administrador que te envíe el link correcto.';
      errorAlert.classList.remove('d-none');
      if (form) {
        form.classList.add('d-none');
      }
      return;
    }

    // Token present — wire the form submit.
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Reset banners.
      errorAlert.classList.add('d-none');
      successAlert.classList.add('d-none');

      const password = document.getElementById('invite-password').value;
      const passwordConfirmation = document.getElementById(
        'invite-password-confirm',
      ).value;
      const acceptTerms = document.getElementById('invite-terms').checked;
      const termsVersion =
        document.getElementById('invite-terms-version').value || 'v0';

      // Client-side validation.
      const errors = validateAcceptPayload({
        password,
        passwordConfirmation,
        acceptTerms,
      });

      if (Object.keys(errors).length > 0) {
        this._renderFieldErrors(errors);
        return;
      }

      // Loading state.
      submitBtn.disabled = true;
      document.getElementById('btn-activar-texto').classList.add('d-none');
      document.getElementById('btn-activar-loading').classList.remove('d-none');

        try {
        await auth.acceptInvitation(
          token,
          password,
          passwordConfirmation,
          acceptTerms,
          termsVersion,
        );

        // Success — show banner and redirect.
        successAlert.classList.remove('d-none');
        form.classList.add('d-none');
        setTimeout(() => {
          router.navigate('/login?accepted=1');
        }, 1500);
      } catch (err) {
        if (err instanceof InvitationGoneError) {
          errorAlert.textContent =
            'Esta invitación ya fue usada o expiró. ' +
            'Pedile al administrador que te envíe una nueva.';
          errorAlert.classList.remove('d-none');
        } else if (err instanceof InvitationNotFoundError) {
          errorAlert.textContent =
            'Invitación inválida. ' +
            'Pedile al administrador que te envíe el link correcto.';
          errorAlert.classList.remove('d-none');
        } else if (err?.status === 422 && err.errors) {
          this._renderFieldErrors(err.errors);
        } else {
          errorAlert.textContent =
            'No pudimos activar tu cuenta. Intentá de nuevo.';
          errorAlert.classList.remove('d-none');
        }
      } finally {
        submitBtn.disabled = false;
        document.getElementById('btn-activar-texto').classList.remove('d-none');
        document
          .getElementById('btn-activar-loading')
          .classList.add('d-none');
      }
    });
  },

  /**
   * Render field-level validation errors from the client validator
   * or from the backend 422 response.
   */
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
    // No persistent subscriptions in this component.
  },
};
