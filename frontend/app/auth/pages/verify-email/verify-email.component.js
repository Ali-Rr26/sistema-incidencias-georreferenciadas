/**
 * Verify-email landing page — story sc-117.
 *
 * Esta pantalla hace dos cosas, según desde dónde se llegue:
 *
 *   1. **Landing con enlace**: si la URL trae `?id=...&hash=...&expires=...&signature=...`,
 *      se llama a `GET /api/email/verify/{id}/{hash}` con los query params intactos
 *      (la firma ya se validó al armar el enlace en backend). En 200, mostramos
 *      éxito y dejamos un botón para ir al login; en 4xx, mostramos el error
 *      recibido del backend.
 *
 *   2. **Landing sin token** (post-201 del registro o 403 desde el login): el
 *      usuario aún no verificó. Mostramos el banner inicial + el botón
 *      "Reenviar" que pega contra `POST /api/email/resend`. El botón tiene un
 *      cooldown de 60s para no spammear al backend.
 *
 * i18n: spec es primary, mensajes hard-codeados siguiendo el patrón del
 * resto de las pantallas de auth (forgot-password / reset-password).
 */
import template from './verify-email.component.html?raw';
import style from '../login/login.component.css?raw';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';

const RESEND_COOLDOWN_SECONDS = 60;

export default {
  template,
  style,

  async onInit({ query } = {}) {
    const btn = document.getElementById('btn-reenviar');
    const btnText = document.getElementById('btn-texto');
    const btnLoading = document.getElementById('btn-loading');
    const btnCountdown = document.getElementById('btn-countdown');

    const hideAllStates = () => {
      document.getElementById('estado-cargando')?.classList.add('d-none');
      document.getElementById('estado-exito')?.classList.add('d-none');
      document.getElementById('estado-error')?.classList.add('d-none');
      document.getElementById('estado-reenvio')?.classList.add('d-none');
      document.getElementById('estado-inicial')?.classList.add('d-none');
    };

    const showLoading = () => {
      hideAllStates();
      document.getElementById('estado-cargando')?.classList.remove('d-none');
    };

    const showSuccess = (msg) => {
      hideAllStates();
      const txt = document.getElementById('exito-texto');
      if (txt && msg) txt.textContent = msg;
      document.getElementById('estado-exito')?.classList.remove('d-none');
    };

    const showError = (msg) => {
      hideAllStates();
      const txt = document.getElementById('error-texto');
      if (txt && msg) txt.textContent = msg;
      document.getElementById('estado-error')?.classList.remove('d-none');
    };

    /**
     * Apply a 60s countdown to the resend button. Counts down 60→0 then
     * re-enables. The button is still clickable while in cooldown but
     * disabled — countdown updates the label like "Reenviar (45s)".
     */
    const startResendCooldown = () => {
      if (!btn) return;
      btn.disabled = true;
      btnText?.classList.add('d-none');
      btnLoading?.classList.add('d-none');
      btnCountdown?.classList.remove('d-none');

      let remaining = RESEND_COOLDOWN_SECONDS;
      const tick = () => {
        if (remaining <= 0) {
          if (btnCountdown) btnCountdown.textContent = '';
          btnCountdown?.classList.add('d-none');
          btnText?.classList.remove('d-none');
          btn.disabled = false;
          return;
        }
        if (btnCountdown) {
          btnCountdown.textContent = `Reenviar (${remaining}s)`;
        }
        remaining -= 1;
        setTimeout(tick, 1000);
      };
      tick();
    };

    // Resend handler — POST /api/email/resend expects auth (jwt middleware).
    // En el flujo post-registro el usuario no está autenticado, así que
    // mostramos el mensaje informativo y NO pegamos al endpoint (caería 401).
    // Sólo enviamos si el usuario llegó autenticado desde el dashboard.
    const handleResend = async () => {
      hideAllStates();
      btnLoading?.classList.remove('d-none');
      btnText?.classList.add('d-none');
      btnCountdown?.classList.add('d-none');
      btn.disabled = true;

      try {
        await http.post('/email/resend');
        const txt = document.getElementById('reenvio-texto');
        if (txt) {
          txt.textContent = 'Te hemos enviado un nuevo correo de verificación.';
        }
        hideAllStates();
        document.getElementById('estado-reenvio')?.classList.remove('d-none');
        startResendCooldown();
      } catch (err) {
        // 401 — usuario no autenticado (caso post-registro): mantenemos
        // el banner inicial y dejamos que el usuario abra el correo
        // que ya recibió, sin resend.
        if (err?.status === 401) {
          hideAllStates();
          document.getElementById('estado-inicial')?.classList.remove('d-none');
        } else if (err?.status === 429) {
          showError('Has realizado demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.');
        } else {
          showError(err?.message || 'No pudimos reenviar el correo. Intentalo de nuevo.');
        }
      } finally {
        btnLoading?.classList.add('d-none');
        if (!btn.disabled) {
          btnText?.classList.remove('d-none');
        }
      }
    };

    if (btn) {
      btn.addEventListener('click', handleResend);
    }

    // ─── Path 1 — landing con token firmado ─────────────────────────────
    const id = query?.get('id');
    const hash = query?.get('hash');
    const expires = query?.get('expires');
    const signature = query?.get('signature');

    if (id && hash && expires && signature) {
      showLoading();

      try {
        // Construimos la URL firmada al backend pasando los params tal
        // cual vinieron (la firma los preserva — están firmados con
        // APP_KEY en backend al armar el URL firmada).
        const path = `/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`;
        const sep = path.includes('?') ? '&' : '?';
        const verifyUrl = `${path}${sep}expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;

        const data = await http.get(verifyUrl);
        showSuccess(data?.message || 'Tu correo fue verificado correctamente.');
        // Tras el éxito, en 3 segundos redirigimos al login para que
        // el usuario tipee sus credenciales.
        setTimeout(() => router.navigate('/login'), 3000);
      } catch (err) {
        if (err?.status === 403 && err?.code === 'verification_expired') {
          showError('El enlace de verificación expiró. Solicitá uno nuevo.');
        } else {
          showError(err?.message || 'No pudimos verificar tu correo. El enlace puede haber expirado o ya fue utilizado.');
        }
      }

      return;
    }

    // ─── Path 2 — landing sin token (post-registro o tras 403) ─────────
    // Por defecto dejamos el banner inicial visible; el usuario decide
    // si quiere reenviar el correo (si está logueado) o abrir el que
    // ya le llegó al mail (caso post-201).
    document.getElementById('estado-inicial')?.classList.remove('d-none');
  },

  onDestroy() {},
};
