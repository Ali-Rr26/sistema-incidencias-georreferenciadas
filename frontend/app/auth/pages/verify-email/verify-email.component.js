/**
 * Verify-email landing page — story sc-117.
 *
 * Soporta dos vías de verificación:
 *   1. **Ingreso de código OTP de 6 dígitos**: el usuario ingresa el código
 *      recibido en su correo y presiona "Verificar código" (POST /api/email/verify-otp).
 *   2. **Landing con enlace firmado**: si la URL contiene params firmados,
 *      se llama a GET /api/email/verify/{id}/{hash}.
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
    const emailInput = document.getElementById('otp-email');
    const otpInput = document.getElementById('otp-input');
    const formOtp = document.getElementById('form-otp');
    const btnVerificar = document.getElementById('btn-verificar');
    const btnVerificarTexto = document.getElementById('btn-verificar-texto');
    const btnVerificarLoading = document.getElementById('btn-verificar-loading');

    const btnResend = document.getElementById('btn-reenviar');
    const btnText = document.getElementById('btn-texto');
    const btnLoading = document.getElementById('btn-loading');
    const btnCountdown = document.getElementById('btn-countdown');

    const initialEmail = query?.get('email') || '';
    if (emailInput && initialEmail) {
      emailInput.value = initialEmail;
    }

    const hideAllStates = () => {
      document.getElementById('estado-cargando')?.classList.add('d-none');
      document.getElementById('estado-exito')?.classList.add('d-none');
      document.getElementById('estado-error')?.classList.add('d-none');
      document.getElementById('estado-reenvio')?.classList.add('d-none');
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

    const startResendCooldown = () => {
      if (!btnResend) return;
      btnResend.disabled = true;
      btnText?.classList.add('d-none');
      btnLoading?.classList.add('d-none');
      btnCountdown?.classList.remove('d-none');

      let remaining = RESEND_COOLDOWN_SECONDS;
      const tick = () => {
        if (remaining <= 0) {
          if (btnCountdown) btnCountdown.textContent = '';
          btnCountdown?.classList.add('d-none');
          btnText?.classList.remove('d-none');
          btnResend.disabled = false;
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

    const handleResend = async () => {
      const email = emailInput?.value?.trim() || initialEmail;
      hideAllStates();
      btnLoading?.classList.remove('d-none');
      btnText?.classList.add('d-none');
      btnCountdown?.classList.add('d-none');
      btnResend.disabled = true;

      try {
        await http.post('/email/resend', { email });
        const txt = document.getElementById('reenvio-texto');
        if (txt) {
          txt.textContent = 'Te hemos enviado un nuevo código de verificación.';
        }
        document.getElementById('estado-reenvio')?.classList.remove('d-none');
        startResendCooldown();
      } catch (err) {
        if (err?.status === 429) {
          showError('Has realizado demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.');
        } else {
          showError(err?.message || 'No pudimos reenviar el correo. Intentalo de nuevo.');
        }
      } finally {
        btnLoading?.classList.add('d-none');
        if (!btnResend.disabled) {
          btnText?.classList.remove('d-none');
        }
      }
    };

    if (btnResend) {
      btnResend.addEventListener('click', handleResend);
    }

    if (formOtp) {
      formOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput?.value?.trim();
        const otp = otpInput?.value?.trim();

        if (!email || !otp) {
          showError('Ingresá tu correo y el código OTP de 6 dígitos.');
          return;
        }

        hideAllStates();
        btnVerificar.disabled = true;
        btnVerificarTexto?.classList.add('d-none');
        btnVerificarLoading?.classList.remove('d-none');

        try {
          const data = await http.post('/email/verify-otp', { email, otp });
          showSuccess(data?.message || 'Tu correo fue verificado correctamente.');
          setTimeout(() => router.navigate('/login'), 2500);
        } catch (err) {
          showError(err?.message || 'El código OTP es inválido o ha expirado.');
        } finally {
          btnVerificar.disabled = false;
          btnVerificarTexto?.classList.remove('d-none');
          btnVerificarLoading?.classList.add('d-none');
        }
      });
    }

    // ─── Path alternativo — landing con token firmado ─────────────────────
    const id = query?.get('id');
    const hash = query?.get('hash');
    const expires = query?.get('expires');
    const signature = query?.get('signature');

    if (id && hash && expires && signature) {
      showLoading();

      try {
        const path = `/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`;
        const sep = path.includes('?') ? '&' : '?';
        const verifyUrl = `${path}${sep}expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;

        const data = await http.get(verifyUrl);
        showSuccess(data?.message || 'Tu correo fue verificado correctamente.');
        setTimeout(() => router.navigate('/login'), 2500);
      } catch (err) {
        if (err?.status === 403 && err?.code === 'verification_expired') {
          showError('El enlace de verificación expiró. Solicitá un nuevo código.');
        } else {
          showError(err?.message || 'No pudimos verificar tu correo. El enlace puede haber expirado o ya fue utilizado.');
        }
      }
    }
  },

  onDestroy() {},
};
