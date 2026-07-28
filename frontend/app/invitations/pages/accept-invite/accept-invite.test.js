/**
 * accept-invite.test.js — WU-4 + sc-130: invitation acceptance page.
 *
 * Spec scenarios:
 *   R-INV-11: Form visible at /accept-invite?token=...
 *   R-INV-11: Without token → error state + form disabled
 *   R-INV-11: Submit with invalid payload → no network call + field errors
 *   R-INV-14: Submit with valid payload → calls acceptInvitation
 *   R-INV-14: 200 → success banner with explicit 'Ir a iniciar sesión' CTA
 *   R-INV-14: 410 → shows "invitación expirada" message
 *   R-INV-14: 404 → shows "invitación inválida" message
 *   R-INV-14: 422 → shows field errors
 *   sc-130: preview loading skeleton → card swap on 200
 *   sc-130: preview 410 → status banner + form disabled
 *   sc-130: preview 404 → status banner + form disabled
 *   sc-130: preview network fallback → form remains usable, no crash
 *   sc-130: live password rules update on input
 *   sc-130: strength meter renders correct segments for known inputs
 *   sc-130: countdown ticker (fake timers + advance)
 *   sc-130: show-password toggle swaps input.type + icon + aria
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_HTML = readFileSync(
  resolve(__dirname, 'accept-invite.component.html'),
  'utf8',
);

// ─── Mocks ──────────────────────────────────────────────────────────────

const invitationSvcMock = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  validateAcceptPayload: vi.fn(),
  previewInvitation: vi.fn(),
  livePasswordRules: vi.fn(),
  scorePassword: vi.fn(),
  InvitationGoneError: class InvitationGoneError extends Error {
    constructor() {
      super('Esta invitación ya fue usada o expiró');
      this.name = 'InvitationGoneError';
    }
  },
  InvitationNotFoundError: class InvitationNotFoundError extends Error {
    constructor() {
      super('Invitación inválida');
      this.name = 'InvitationNotFoundError';
    }
  },
}));

// auth.acceptInvitation must be async so the component's `await` resolves.
const authSvcMock = vi.hoisted(() => ({
  acceptInvitation: vi.fn(async () => {
    return { message: 'Cuenta activada' };
  }),
}));

const routerNavigateMock = vi.hoisted(() => vi.fn());

vi.mock('../../invitation.service.js', () => ({
  invitationService: invitationSvcMock,
  validateAcceptPayload: invitationSvcMock.validateAcceptPayload,
  previewInvitation: invitationSvcMock.previewInvitation,
  livePasswordRules: invitationSvcMock.livePasswordRules,
  scorePassword: invitationSvcMock.scorePassword,
  InvitationGoneError: invitationSvcMock.InvitationGoneError,
  InvitationNotFoundError: invitationSvcMock.InvitationNotFoundError,
  acceptInvitation: invitationSvcMock.acceptInvitation,
}));

vi.mock('../../../auth/auth.service.js', () => ({
  auth: authSvcMock,
}));

vi.mock('../../../core/router.js', () => ({
  router: { navigate: routerNavigateMock },
}));

vi.mock('../../../utils/ui.js', () => ({
  mostrarToast: vi.fn(),
}));

import { router } from '../../../core/router.js';
import acceptInviteComponent from './accept-invite.component.js';

/**
 * Mount the component into the DOM, supplying an optional URL search
 * params string (everything after the ?).
 */
async function mountComponent(search = '') {
  if (search) {
    const url = new URL('http://localhost' + search);
    Object.defineProperty(window, 'location', {
      value: url,
      writable: true,
      configurable: true,
    });
  } else {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    });
  }
  document.body.innerHTML = TEMPLATE_HTML;
  await acceptInviteComponent.onInit();
  return document.body;
}

/**
 * Helper: a fake preview payload for the "happy" preview case.
 */
function fakePreview(overrides = {}) {
  return {
    status: 'pending',
    organization: { name: 'GAD Santa Elena', initials: 'GS' },
    invitedBy: { name: 'Ana Pérez', role: 'admin_sistema' },
    role: 'operador',
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    termsVersion: 'v0',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mocks to their default behaviour.
  authSvcMock.acceptInvitation.mockImplementation(async () => ({
    message: 'Cuenta activada',
  }));
  invitationSvcMock.validateAcceptPayload.mockReturnValue({});
  // Default: preview resolves successfully (no failure mode).
  invitationSvcMock.previewInvitation.mockImplementation(async () =>
    fakePreview(),
  );
  // Default: all rules fail (so the checklist shows pending), score 0.
  invitationSvcMock.livePasswordRules.mockReturnValue({
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasDigit: false,
    matches: false,
  });
  invitationSvcMock.scorePassword.mockReturnValue(0);
});

describe('accept-invite — WU-4 + sc-130', () => {
  describe('R-INV-11: form visibility and token handling', () => {
    it('renders the form when a valid token is present in URL', async () => {
      await mountComponent('/accept-invite?token=abc123');

      const form = document.getElementById('accept-invite-form');
      expect(form).not.toBeNull();
      expect(form.classList.contains('d-none')).toBe(false);
    });

    it('shows the missing-token error and disables the form when no token is in URL', async () => {
      await mountComponent('/accept-invite');

      const form = document.getElementById('accept-invite-form');
      expect(form.classList.contains('d-none')).toBe(true);

      const errorAlert = document.getElementById('accept-invite-error');
      expect(errorAlert.classList.contains('d-none')).toBe(false);
      expect(errorAlert.textContent).toMatch(/token/i);
    });
  });

  describe('R-INV-11: client-side validation before submit', () => {
    it('calls validateAcceptPayload with the current field values on submit', async () => {
      await mountComponent('/accept-invite?token=abc123');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      expect(invitationSvcMock.validateAcceptPayload).toHaveBeenCalledWith({
        password: 'ValidPass1',
        passwordConfirmation: 'ValidPass1',
        acceptTerms: true,
      });
    });

    it('does NOT call acceptInvitation when validateAcceptPayload returns errors', async () => {
      invitationSvcMock.validateAcceptPayload.mockReturnValue({
        password: 'La contraseña debe tener al menos 8 caracteres.',
      });

      await mountComponent('/accept-invite?token=abc123');

      document.getElementById('invite-password').value = 'Short1';
      document.getElementById('invite-password-confirm').value = 'Short1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      expect(authSvcMock.acceptInvitation).not.toHaveBeenCalled();
    });

    it('renders field-level error messages when validateAcceptPayload returns errors', async () => {
      invitationSvcMock.validateAcceptPayload.mockReturnValue({
        password: 'La contraseña debe tener al menos 8 caracteres.',
      });

      await mountComponent('/accept-invite?token=abc123');

      document.getElementById('invite-password').value = 'Short1';
      document.getElementById('invite-password-confirm').value = 'Short1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      const errorEl = document.querySelector('[data-error-for="password"]');
      expect(errorEl.classList.contains('d-none')).toBe(false);
      expect(errorEl.textContent).toMatch(/8 caracteres/i);
    });
  });

  describe('R-INV-14: network submission and response handling', () => {
    it('calls auth.acceptInvitation with the token and payload on valid submit', async () => {
      await mountComponent('/accept-invite?token=myToken456');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });
      const [token, password, confirm, acceptTerms] =
        authSvcMock.acceptInvitation.mock.calls[0];
      expect(token).toBe('myToken456');
      expect(password).toBe('ValidPass1');
      expect(confirm).toBe('ValidPass1');
      expect(acceptTerms).toBe(true);
    });

    it('shows an explicit "Ir a iniciar sesión" CTA on 200 (success)', async () => {
      // No setTimeout redirect anymore — the success banner carries
      // a button the user clicks to continue.
      authSvcMock.acceptInvitation.mockImplementation(async () => ({
        message: 'Cuenta activada',
      }));

      await mountComponent('/accept-invite?token=validtoken');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        const cta = document.getElementById('accept-invite-success-cta');
        expect(cta).not.toBeNull();
      });

      const cta = document.getElementById('accept-invite-success-cta');
      expect(cta.textContent).toMatch(/Ir a iniciar sesión/);
      expect(cta.getAttribute('href')).toBe('/#/login?accepted=1');

      // The CTA must NOT auto-trigger router.navigate on mount —
      // the user clicks it when ready.
      expect(router.navigate).not.toHaveBeenCalled();

      // Clicking the CTA pushes the route.
      cta.click();
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith('/login?accepted=1');
    });

    it('shows the expired/consumed error banner on 410', async () => {
      authSvcMock.acceptInvitation.mockImplementation(async () => {
        throw new invitationSvcMock.InvitationGoneError();
      });

      await mountComponent('/accept-invite?token=expiredtoken');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });

      await new Promise((r) => setTimeout(r, 10));

      const errorAlert = document.getElementById('accept-invite-error');
      expect(errorAlert.classList.contains('d-none')).toBe(false);
      expect(errorAlert.textContent).toMatch(/ya fue usada o expiró/i);
    });

    it('shows the invalid invitation error banner on 404', async () => {
      authSvcMock.acceptInvitation.mockImplementation(async () => {
        throw new invitationSvcMock.InvitationNotFoundError();
      });

      await mountComponent('/accept-invite?token=invaldtoken');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });

      await new Promise((r) => setTimeout(r, 10));

      const errorAlert = document.getElementById('accept-invite-error');
      expect(errorAlert.classList.contains('d-none')).toBe(false);
      expect(errorAlert.textContent).toMatch(/inválida/i);
    });

    it('renders backend field errors on 422', async () => {
      const backendErr = new Error('Unprocessable');
      backendErr.status = 422;
      backendErr.errors = { password: ['La contraseña es demasiado débil.'] };
      authSvcMock.acceptInvitation.mockImplementation(async () => {
        throw backendErr;
      });

      await mountComponent('/accept-invite?token=anytoken');

      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });

      await new Promise((r) => setTimeout(r, 10));

      const errorEl = document.querySelector('[data-error-for="password"]');
      expect(errorEl.classList.contains('d-none')).toBe(false);
      expect(errorEl.textContent).toMatch(/débil/i);
    });
  });

  // ─── sc-130: preview loading skeleton → loaded card ─────────────────
  describe('sc-130: preview loading skeleton swaps to context card on 200', () => {
    it('renders the skeleton on mount, then swaps to a context card on 200', async () => {
      invitationSvcMock.previewInvitation.mockImplementation(async () =>
        fakePreview(),
      );

      await mountComponent('/accept-invite?token=previewtoken');

      const heroContext = document.getElementById('invite-hero-context');
      expect(heroContext).not.toBeNull();

      // Wait for the preview promise to resolve and the swap to happen.
      await vi.waitFor(() => {
        const card = heroContext.querySelector('.gr-accept-invite__hero-card');
        expect(card).not.toBeNull();
      });

      const card = heroContext.querySelector('.gr-accept-invite__hero-card');
      expect(card.textContent).toMatch(/GAD Santa Elena/);
      expect(card.textContent).toMatch(/Ana Pérez/);

      // The countdown element exists and has the data-expires-at attr.
      const countdown = document.getElementById('invite-hero-countdown');
      expect(countdown).not.toBeNull();
      expect(countdown.getAttribute('data-expires-at')).toBeTruthy();
    });

    it('renders a status banner and disables the form on preview 410', async () => {
      invitationSvcMock.previewInvitation.mockImplementation(async () => {
        throw new invitationSvcMock.InvitationGoneError();
      });

      await mountComponent('/accept-invite?token=gone');

      await vi.waitFor(() => {
        const banner = document.querySelector('.gr-accept-invite__hero-banner');
        expect(banner).not.toBeNull();
      });

      const banner = document.querySelector('.gr-accept-invite__hero-banner');
      expect(banner.textContent).toMatch(/ya no es válida/);
      expect(banner.textContent).toMatch(/administrador/i);

      // Submitting now must be a no-op.
      const submitBtn = document.getElementById('btn-activar');
      expect(submitBtn.disabled).toBe(true);
    });

    it('renders a status banner and disables the form on preview 404', async () => {
      invitationSvcMock.previewInvitation.mockImplementation(async () => {
        throw new invitationSvcMock.InvitationNotFoundError();
      });

      await mountComponent('/accept-invite?token=missing');

      await vi.waitFor(() => {
        const banner = document.querySelector('.gr-accept-invite__hero-banner');
        expect(banner).not.toBeNull();
      });

      const banner = document.querySelector('.gr-accept-invite__hero-banner');
      expect(banner.textContent).toMatch(/no encontrada/);

      expect(document.getElementById('btn-activar').disabled).toBe(true);
    });

    it('falls back gracefully on preview network error (form remains usable)', async () => {
      invitationSvcMock.previewInvitation.mockImplementation(async () => {
        // Service contract: returns null on network/unexpected errors
        // (after console.warn). We mirror that here.
        return null;
      });

      await mountComponent('/accept-invite?token=offline');

      // Give the IIFE a tick to settle.
      await new Promise((r) => setTimeout(r, 10));

      // Hero context is cleared (no card, no banner).
      const heroContext = document.getElementById('invite-hero-context');
      expect(heroContext.innerHTML).toBe('');

      // Form is still usable: submit should reach auth.acceptInvitation.
      document.getElementById('invite-password').value = 'ValidPass1';
      document.getElementById('invite-password-confirm').value = 'ValidPass1';
      document.getElementById('invite-terms').checked = true;

      document
        .getElementById('accept-invite-form')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );

      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── sc-130: live password rules ─────────────────────────────────────
  describe('sc-130: live password rules update on input', () => {
    function readRuleStates() {
      return Array.from(
        document.querySelectorAll('.gr-accept-invite__rule'),
      ).map((row) => ({
        rule: row.getAttribute('data-rule'),
        ok: row.classList.contains('gr-accept-invite__rule--ok'),
      }));
    }

    it('flips each rule to ok as livePasswordRules returns true for it', async () => {
      // Progressive truthy returns as the user types.
      invitationSvcMock.livePasswordRules.mockImplementation(
        ({ password }) => ({
          minLength: password.length >= 8,
          hasUpper: /[A-Z]/.test(password),
          hasLower: /[a-z]/.test(password),
          hasDigit: /[0-9]/.test(password),
          matches: false,
        }),
      );

      await mountComponent('/accept-invite?token=t');

      const input = document.getElementById('invite-password');
      input.value = 'A';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const states = readRuleStates();
        expect(states.find((s) => s.rule === 'minLength').ok).toBe(false);
      });

      input.value = 'ValidPass1';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const states = readRuleStates();
        expect(states.find((s) => s.rule === 'minLength').ok).toBe(true);
        expect(states.find((s) => s.rule === 'hasUpper').ok).toBe(true);
        expect(states.find((s) => s.rule === 'hasLower').ok).toBe(true);
        expect(states.find((s) => s.rule === 'hasDigit').ok).toBe(true);
      });

      expect(invitationSvcMock.livePasswordRules).toHaveBeenCalled();
    });

    it('only flips the matches rule when the confirmation field has a value', async () => {
      invitationSvcMock.livePasswordRules.mockImplementation(
        ({ password, passwordConfirmation }) => ({
          minLength: true,
          hasUpper: true,
          hasLower: true,
          hasDigit: true,
          matches:
            typeof passwordConfirmation === 'string' &&
            passwordConfirmation.length > 0 &&
            passwordConfirmation === password,
        }),
      );

      await mountComponent('/accept-invite?token=t');

      const pw = document.getElementById('invite-password');
      const confirm = document.getElementById('invite-password-confirm');
      pw.value = 'ValidPass1';
      confirm.value = '';
      confirm.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const states = readRuleStates();
        expect(states.find((s) => s.rule === 'matches').ok).toBe(false);
      });

      confirm.value = 'ValidPass1';
      confirm.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const states = readRuleStates();
        expect(states.find((s) => s.rule === 'matches').ok).toBe(true);
      });
    });
  });

  // ─── sc-130: strength meter ─────────────────────────────────────────
  describe('sc-130: strength meter', () => {
    it('renders 0 segments when scorePassword returns 0', async () => {
      invitationSvcMock.scorePassword.mockReturnValue(0);

      await mountComponent('/accept-invite?token=t');

      const onSegments = document.querySelectorAll(
        '.gr-accept-invite__meter-segment--on',
      );
      expect(onSegments.length).toBe(0);

      const meter = document.getElementById('invite-password-meter');
      expect(meter.getAttribute('aria-valuenow')).toBe('0');

      const label = document.getElementById('invite-password-meter-label');
      expect(label.textContent).toBe('—');
    });

    it('lights up the matching number of segments when scorePassword returns 3', async () => {
      invitationSvcMock.scorePassword.mockReturnValue(3);

      await mountComponent('/accept-invite?token=t');

      // The component calls updateRulesUi once on mount, which sets the
      // segments based on the mock.
      const onSegments = document.querySelectorAll(
        '.gr-accept-invite__meter-segment--on',
      );
      expect(onSegments.length).toBe(3);

      const meter = document.getElementById('invite-password-meter');
      expect(meter.getAttribute('aria-valuenow')).toBe('3');
      expect(meter.classList.contains('gr-accept-invite__meter--tier-3')).toBe(
        true,
      );

      const label = document.getElementById('invite-password-meter-label');
      expect(label.textContent).toBe('Buena');
    });

    it('updates meter when password input changes', async () => {
      invitationSvcMock.scorePassword.mockImplementation((p) =>
        p.length >= 8 ? 2 : 0,
      );

      await mountComponent('/accept-invite?token=t');

      const input = document.getElementById('invite-password');
      input.value = 'Short';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const on = document.querySelectorAll(
          '.gr-accept-invite__meter-segment--on',
        );
        expect(on.length).toBe(0);
      });

      input.value = 'ValidPass1';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => {
        const on = document.querySelectorAll(
          '.gr-accept-invite__meter-segment--on',
        );
        expect(on.length).toBe(2);
      });
    });
  });

  // ─── sc-130: show-password toggle ────────────────────────────────────
  describe('sc-130: show-password toggle', () => {
    it('flips input.type between password and text on click, swapping the icon', async () => {
      await mountComponent('/accept-invite?token=t');

      const eyeBtn = document.querySelector(
        '.gr-input-eye[data-eye-for="invite-password"]',
      );
      const input = document.getElementById('invite-password');
      expect(input.type).toBe('password');
      expect(eyeBtn.getAttribute('aria-pressed')).toBe('false');

      eyeBtn.click();

      expect(input.type).toBe('text');
      expect(eyeBtn.getAttribute('aria-pressed')).toBe('true');
      expect(eyeBtn.getAttribute('aria-label')).toMatch(/Ocultar/);
      expect(eyeBtn.querySelector('i').className).toMatch(/eye-slash/);

      eyeBtn.click();

      expect(input.type).toBe('password');
      expect(eyeBtn.getAttribute('aria-pressed')).toBe('false');
      expect(eyeBtn.getAttribute('aria-label')).toMatch(/Mostrar/);
      expect(eyeBtn.querySelector('i').className).toMatch(/(^|\s)fa-eye($|\s)/);
    });

    it('wires the confirm-field eye button independently', async () => {
      await mountComponent('/accept-invite?token=t');

      const pwEye = document.querySelector(
        '.gr-input-eye[data-eye-for="invite-password"]',
      );
      const confirmEye = document.querySelector(
        '.gr-input-eye[data-eye-for="invite-password-confirm"]',
      );
      const pw = document.getElementById('invite-password');
      const confirm = document.getElementById('invite-password-confirm');

      confirmEye.click();

      // Confirm becomes text, password stays password.
      expect(confirm.type).toBe('text');
      expect(pw.type).toBe('password');
      // Confirm eye is pressed, password eye isn't.
      expect(confirmEye.getAttribute('aria-pressed')).toBe('true');
      expect(pwEye.getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ─── sc-130: countdown ticker ────────────────────────────────────────
  describe('sc-130: countdown ticker', () => {
    it('renders Expira en N días for an expiry 2 days out and switches the text via setTimeout(60_000)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-27T12:00:00Z'));

      const twoDaysOut = new Date('2026-07-29T12:00:00Z').toISOString();
      invitationSvcMock.previewInvitation.mockImplementation(async () =>
        fakePreview({ expiresAt: twoDaysOut }),
      );

      await mountComponent('/accept-invite?token=countdown');

      const countdown = document.getElementById('invite-hero-countdown');
      expect(countdown).not.toBeNull();
      expect(countdown.textContent).toMatch(/Expira en 2 días/);

      // Advance 1 day: the next minute-granular tick fires and the
      // label updates.
      vi.advanceTimersByTime(24 * 3600 * 1000);
      expect(countdown.textContent).toMatch(/Expira en 1 día/);

      // Advance 23 hours → below 1 hour → switches to requestAnimationFrame.
      vi.advanceTimersByTime(23 * 3600 * 1000);
      // The label granularity just changed. Trigger a frame manually.
      vi.advanceTimersByTime(60 * 1000);
      expect(countdown.textContent).toMatch(/Expira en \d+ minutos?/);

      vi.useRealTimers();
    });

    it('renders "Expirada" once the deadline passes', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-27T12:00:00Z'));

      const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
      invitationSvcMock.previewInvitation.mockImplementation(async () =>
        fakePreview({ expiresAt: tenSecondsAgo }),
      );

      await mountComponent('/accept-invite?token=expired-countdown');

      const countdown = document.getElementById('invite-hero-countdown');
      // After the preview resolves and the first tick runs, the
      // countdown should switch to expired state.
      await vi.waitFor(() => {
        expect(countdown.textContent).toMatch(/Expirada/);
      });
      expect(
        countdown.classList.contains(
          'gr-accept-invite__hero-card-countdown--expired',
        ),
      ).toBe(true);

      vi.useRealTimers();
    });
  });
});
