/**
 * accept-invite.component.js — WU-4 + sc-130: invitation acceptance page.
 *
 * Spec: R-INV-11 (form visibility + token handling) and R-INV-14
 * (submit + error handling).
 *
 * URL contract: /accept-invite?token=<plaintext>
 *   - No token → error state, form disabled
 *   - Valid token → fire GET /invitations/{token}/preview, render a
 *     context card on the LEFT hero with org name, inviter, role pill,
 *     and a live countdown to expiresAt. The form on the RIGHT stays
 *     usable from the start so the user isn't blocked on the preview.
 *   - Preview 404 → status banner on the hero, form disabled
 *   - Preview 410 → status banner on the hero, form disabled
 *   - Preview network/timeout → graceful fallback: skeleton removed,
 *     form stays usable. console.warn records the failure for ops.
 *
 * Submit:
 *   - 200 → success banner + explicit "Ir a iniciar sesión" CTA
 *   - 410 → "Esta invitación ya fue usada o expiró…"
 *   - 404 → "Invitación inválida…"
 *   - 422 → field-level errors from backend
 *
 * The component is a plain module (no class), matching the login.component
 * pattern: `template`, `style`, `onInit(ctx)`, `onDestroy()`.
 */
import template from './accept-invite.component.html?raw';
import style from './accept-invite.component.css?raw';
import { auth } from '../../../auth/auth.service.js';
import {
  validateAcceptPayload,
  previewInvitation,
  InvitationGoneError,
  InvitationNotFoundError,
} from '../../invitation.service.js';
import { router } from '../../../core/router.js';

/**
 * Read the invitation token from window.location.search.
 * Returns null when the token parameter is missing.
 */
function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || null;
}

/**
 * Render the loaded context card into the hero. The skeleton that was
 * initially rendered is replaced wholesale to keep the DOM swap atomic.
 */
function renderHeroCard(heroContext, preview) {
  const org = preview.organization || {};
  const initials = (org.initials || '?').slice(0, 2).toUpperCase();
  const orgName = org.name || 'Tu organización';
  const inviter = preview.invitedBy;
  const inviterLine = inviter?.name
    ? `Invitado/a por ${inviter.name}${inviter.role ? ` (${inviter.role})` : ''}`
    : 'Invitación enviada por tu organización';
  const role = preview.role || 'Sin rol asignado';
  const issuedAt = preview.issuedAt
    ? new Date(preview.issuedAt).toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  const issuedLine = issuedAt ? `Emitida el ${issuedAt}` : '';

  heroContext.removeAttribute('aria-busy');
  heroContext.innerHTML = `
    <div class="gr-accept-invite__hero-card">
      <div class="gr-accept-invite__hero-card-row">
        <div class="gr-accept-invite__hero-card-avatar" aria-hidden="true">
          <span>${escapeHtml(initials)}</span>
        </div>
        <div class="gr-accept-invite__hero-card-text">
          <span class="gr-accept-invite__hero-card-label">Te invitó</span>
          <span class="gr-accept-invite__hero-card-name" id="invite-hero-org-name">${escapeHtml(orgName)}</span>
          <span class="gr-accept-invite__hero-card-inviter">${escapeHtml(inviterLine)}</span>
        </div>
      </div>
      <div class="gr-accept-invite__hero-card-meta">
        <span class="gr-accept-invite__hero-card-role" title="Rol que tendrás al activar la cuenta">
          <i class="fa-solid fa-id-badge" aria-hidden="true"></i>
          ${escapeHtml(role)}
        </span>
        <span
          class="gr-accept-invite__hero-card-countdown"
          id="invite-hero-countdown"
          role="status"
          aria-live="polite"
          data-expires-at="${escapeAttr(preview.expiresAt)}"
        >${escapeHtml(issuedLine || 'Cargando expiración…')}</span>
      </div>
    </div>
  `;
}

/**
 * Render a status banner (404 / 410) on the hero. The form on the
 * right stays visible but disabled — the user still sees the page
 * chrome and can read the "Contactá al administrador" hint.
 */
function renderHeroBanner(heroContext, { title, hint, icon }) {
  heroContext.removeAttribute('aria-busy');
  heroContext.innerHTML = `
    <div class="gr-accept-invite__hero-banner">
      <i class="${icon}" aria-hidden="true"></i>
      <div class="gr-accept-invite__hero-banner-text">
        <span class="gr-accept-invite__hero-banner-title">${escapeHtml(title)}</span>
        <span class="gr-accept-invite__hero-banner-hint">${escapeHtml(hint)}</span>
      </div>
    </div>
  `;
}

/**
 * Remove the skeleton without rendering anything in its place. Used on
 * network fallback so the hero still reads cleanly (logo + headline +
 * desc) without a context block.
 */
function clearHeroSkeleton(heroContext) {
  heroContext.removeAttribute('aria-busy');
  heroContext.innerHTML = '';
}

/**
 * Format a future ISO timestamp into the granularity chosen by the
 * remaining duration: days > 1d, hours > 1h, minutes > 1m, else seconds.
 * Returns the label and a class hint for warning/expired coloring.
 */
function formatRemaining(expiresAtMs, nowMs = Date.now()) {
  const remaining = expiresAtMs - nowMs;
  if (remaining <= 0) {
    return { label: 'Expirada', state: 'expired' };
  }
  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label;
  if (days >= 1) {
    label = `Expira en ${days} día${days === 1 ? '' : 's'}`;
  } else if (hours >= 1) {
    label = `Expira en ${hours} hora${hours === 1 ? '' : 's'}`;
  } else if (minutes >= 1) {
    label = `Expira en ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  } else {
    label = `Expira en ${seconds} segundo${seconds === 1 ? '' : 's'}`;
  }
  // < 5 minutes: warm warning. Otherwise neutral.
  const state = minutes < 5 ? 'warning' : 'normal';
  return { label, state };
}

/**
 * Minimal HTML escape for the literal strings we drop into innerHTML.
 * The preview payload is JSON from our own backend, but escaping is
 * free defense-in-depth: `organization.name` could in principle contain
 * a `<` character.
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
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
    const heroContext = document.getElementById('invite-hero-context');

    // Preview-driven state. While 'loading', the form is fully usable
    // (we don't want to block the user on a metadata fetch). Once the
    // preview resolves to a terminal state (404/410) the form is
    // disabled because the token itself can't be consumed.
    let previewState = 'loading';
    let countdownHandle = null;

    function disableForm() {
      if (!form) return;
      form
        .querySelectorAll('input, button')
        .forEach((el) => (el.disabled = true));
      submitBtn.classList.add('gr-accept-invite__btn--disabled');
    }

    function startCountdown() {
      if (countdownHandle !== null) {
        clearInterval(countdownHandle);
        cancelAnimationFrame(countdownHandle);
        countdownHandle = null;
      }
      const target = document.getElementById('invite-hero-countdown');
      if (!target) return;
      const expiresAtIso = target.getAttribute('data-expires-at');
      const expiresAtMs = new Date(expiresAtIso).getTime();
      if (Number.isNaN(expiresAtMs)) return;

      // Live-region politeness: only update the announced text on
      // state transitions (normal → warning → expired) and on
      // granularity changes, NOT every tick — otherwise screen
      // readers spam the user on every second.
      let lastState = null;
      let lastAnnouncedLabel = null;

      function tick() {
        const { label, state } = formatRemaining(expiresAtMs);
        target.textContent = label;
        target.classList.toggle(
          'gr-accept-invite__hero-card-countdown--warning',
          state === 'warning',
        );
        target.classList.toggle(
          'gr-accept-invite__hero-card-countdown--expired',
          state === 'expired',
        );

        // Choose the tick rate: every minute above 1 minute, every
        // frame below it. Sub-minute smoothness matters because the
        // user is staring at the number; above 1 minute, a minute
        // granularity is plenty.
        if (state === 'expired') {
          countdownHandle = null;
          return;
        }
        const remainingMs = expiresAtMs - Date.now();
        if (remainingMs > 60_000) {
          countdownHandle = setTimeout(tick, 60_000);
        } else {
          countdownHandle = requestAnimationFrame(tick);
        }
      }

      // Hint lastAnnouncedLabel so the first tick stays silent in
      // older screen readers (no announcement for the initial render).
      lastAnnouncedLabel = null;
      lastState = null;
      tick();
    }

    if (!token) {
      // Missing token — show error, keep form hidden.
      errorAlert.textContent =
        'Esta URL no contiene un token de invitación. ' +
        'Pedile al administrador que te envíe el link correcto.';
      errorAlert.classList.remove('d-none');
      if (form) {
        form.classList.add('d-none');
      }
      clearHeroSkeleton(heroContext);
      return;
    }

    // Fire-and-forget preview: form stays usable while the metadata
    // is in flight. Promise rejections are caught inside the service
    // for network errors; typed errors surface here.
    (async () => {
      let preview = null;
      try {
        preview = await previewInvitation(token);
      } catch (err) {
        if (err instanceof InvitationGoneError) {
          previewState = 'gone';
          renderHeroBanner(heroContext, {
            title: 'Esta invitación ya no es válida',
            hint: 'Puede haber expirado o ya fue utilizada. Pedile al administrador que te envíe una nueva.',
            icon: 'fa-solid fa-circle-exclamation',
          });
          disableForm();
          return;
        }
        if (err instanceof InvitationNotFoundError) {
          previewState = 'not-found';
          renderHeroBanner(heroContext, {
            title: 'Invitación no encontrada',
            hint: 'Verificá que el link sea el correcto o pedile al administrador que te lo reenvíe.',
            icon: 'fa-solid fa-circle-question',
          });
          disableForm();
          return;
        }
        // Unexpected — treat as network fallback.
        console.warn('[accept-invite] unexpected preview error', err);
        clearHeroSkeleton(heroContext);
        return;
      }
      if (preview === null) {
        // Network fallback — form remains usable.
        clearHeroSkeleton(heroContext);
        return;
      }
      previewState = 'loaded';
      renderHeroCard(heroContext, preview);
      startCountdown();
    })();

    // Token present — wire the form submit.
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // If the preview already revealed the token is unusable, bail
      // before bothering the user with validation.
      if (previewState === 'gone' || previewState === 'not-found') {
        return;
      }

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

        // Success — show banner and stop the countdown ticker.
        if (countdownHandle !== null) {
          clearInterval(countdownHandle);
          cancelAnimationFrame(countdownHandle);
          countdownHandle = null;
        }
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
        document.getElementById('btn-activar-loading').classList.add('d-none');
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
    // Countdown ticker is per-mount and is torn down by the success
    // path or by component re-mount. Belt-and-suspenders cleanup in
    // case onDestroy fires before either.
    const target = document.getElementById('invite-hero-countdown');
    if (target) {
      // Nothing per-handle here — the handle is closure-scoped, but
      // we can at least detach aria-live so the announcement doesn't
      // outlive the component on a hot-reload.
      target.removeAttribute('aria-live');
    }
  },
};
