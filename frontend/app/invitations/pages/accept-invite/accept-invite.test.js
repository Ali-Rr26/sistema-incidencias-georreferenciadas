/**
 * accept-invite.test.js — WU-4: invitation acceptance page.
 *
 * Spec scenarios (R-INV-11 / R-INV-14):
 *   - R-INV-11: Form visible at /accept-invite?token=...
 *   - R-INV-11: Without token → error state + form disabled
 *   - R-INV-11: Submit with invalid payload → no network call + field errors
 *   - R-INV-14: Submit with valid payload → calls acceptInvitation
 *   - R-INV-14: 200 from acceptInvitation → redirects to /login?accepted=1
 *   - R-INV-14: 410 from acceptInvitation → shows "invitación expirada" message
 *   - R-INV-14: 404 from acceptInvitation → shows "invitación inválida" message
 *   - R-INV-14: 422 from acceptInvitation → shows field errors
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

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mocks to their default (async no-op) behaviour.
  authSvcMock.acceptInvitation.mockImplementation(async () => ({
    message: 'Cuenta activada',
  }));
  invitationSvcMock.validateAcceptPayload.mockReturnValue({});
});

describe('accept-invite — WU-4', () => {
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

      // validateAcceptPayload is called synchronously after submit.
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

      // Wait for async auth.acceptInvitation to be called.
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

    it('redirects to /login?accepted=1 on 200 (success)', async () => {
      // Use fake timers so setTimeout(1500) fires instantly.
      vi.useFakeTimers();

      // auth.acceptInvitation resolves successfully.
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

      // Wait for auth.acceptInvitation to be called.
      await vi.waitFor(() => {
        expect(authSvcMock.acceptInvitation).toHaveBeenCalledTimes(1);
      });

      // Advance timers so the component's setTimeout(1500) fires immediately.
      vi.runAllTimers();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith('/login?accepted=1');

      vi.useRealTimers();
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

      // Let the async error path settle.
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
});
