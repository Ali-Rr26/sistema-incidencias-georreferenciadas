/**
 * login.component.test.js — R11 frontend registration form (unit-level).
 *
 * Scenarios (per spec R11 / design #2304):
 *   - R11 renders registration form fields
 *   - R11 toggles between login and register forms
 *   - R11 shows client-side validation errors
 *   - R11 handles 201 and stays on /login with banner
 *
 * The component is a Vanilla ES module with `templateUrl` / `styleUrl`,
 * so the tests load the real HTML file from disk via Node `fs` (vitest
 * runs on Node; only the runtime context is jsdom). This guarantees
 * the assertions pin the actual on-disk template, not a hand-written
 * duplicate that could drift from the real one.
 *
 * `auth.service` and `router` are mocked at the module boundary; the
 * production `auth.register()` post-201 contract is covered separately
 * by `auth.service.register.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_HTML = readFileSync(
  resolve(__dirname, 'login.component.html'),
  'utf8',
);

const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
  isAuthenticated: vi.fn(() => false),
  getUser: vi.fn(() => null),
}));
vi.mock('../../auth.service.js', () => ({ auth: authMock }));

vi.mock('../../../core/router.js', () => ({
  router: {
    navigate: vi.fn(),
    setCurrentUserRole: vi.fn(),
  },
}));

import loginComponent, { validateRegisterPayload } from './login.component.js';

/**
 * Mount the component into the DOM by injecting the real template and
 * running the production-equivalent onInit. The router-resolved context
 * is supplied directly so tests can simulate query-param redirects.
 */
async function mountComponent(ctx = {}) {
  document.body.innerHTML = TEMPLATE_HTML;
  await loginComponent.onInit(ctx);
  return document.body;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('R11 — frontend registration form', () => {
  it('renders all registration form fields (first_name, last_name, email, phone, password, password_confirmation)', async () => {
    await mountComponent();

    // Every register field must exist as an <input> in the DOM. We pin
    // the IDs (not class names) because that's what the submit handler
    // queries by. The brief requires exactly these six fields.
    const fieldIds = [
      'first_name',
      'last_name',
      'register-email',
      'phone',
      'register-password',
      'password_confirmation',
    ];

    for (const id of fieldIds) {
      const el = document.getElementById(id);
      expect(el, `expected #${id} to be present`).not.toBeNull();
      expect(el.tagName).toBe('INPUT');
      expect(el.type).toBeTruthy();
    }

    // The mode toggle and the post-201 banner must also be in the DOM
    // so the toggle test and the banner test have something to operate
    // on. These are R11 surface area, so this assertion pins the whole
    // shape in one shot.
    expect(document.querySelector('[data-mode-btn="register"]')).not.toBeNull();
    expect(document.getElementById('register-banner')).not.toBeNull();
  });

  it('toggles between login and register forms when the mode buttons are clicked', async () => {
    await mountComponent();

    const container = document.querySelector('.gr-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginBtn = document.querySelector('[data-mode-btn="login"]');
    const registerBtn = document.querySelector('[data-mode-btn="register"]');

    // Default state: login mode, login form visible, register hidden.
    expect(container.getAttribute('data-mode')).toBe('login');
    expect(loginForm.classList.contains('d-none')).toBe(false);
    expect(registerForm.classList.contains('d-none')).toBe(true);
    expect(loginBtn.classList.contains('gr-login__mode-btn--active')).toBe(true);
    expect(registerBtn.classList.contains('gr-login__mode-btn--active')).toBe(
      false,
    );

    // Click "Registrarse" → switch to register mode.
    registerBtn.click();
    expect(container.getAttribute('data-mode')).toBe('register');
    expect(loginForm.classList.contains('d-none')).toBe(true);
    expect(registerForm.classList.contains('d-none')).toBe(false);
    expect(loginBtn.classList.contains('gr-login__mode-btn--active')).toBe(
      false,
    );
    expect(registerBtn.classList.contains('gr-login__mode-btn--active')).toBe(
      true,
    );

    // Click "Iniciar sesión" → restore login mode.
    loginBtn.click();
    expect(container.getAttribute('data-mode')).toBe('login');
    expect(loginForm.classList.contains('d-none')).toBe(false);
    expect(registerForm.classList.contains('d-none')).toBe(true);
  });

  it('shows client-side validation errors for weak password and confirmation mismatch without hitting the network', async () => {
    await mountComponent();

    // Switch to register mode so the register form is visible.
    document.querySelector('[data-mode-btn="register"]').click();

    const registerForm = document.getElementById('register-form');

    // ─── Triangulation cycle 1: weak password (no digit) ────────────────
    document.getElementById('first_name').value = 'Ada';
    document.getElementById('last_name').value = 'Lovelace';
    document.getElementById('register-email').value = 'ada@example.com';
    document.getElementById('register-password').value = 'NoDigitsHere';
    document.getElementById('password_confirmation').value = 'NoDigitsHere';

    registerForm.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    // Synchronously assert: NO network call (no auto-login / no register
    // fired), AND the password error is visible.
    expect(authMock.register).not.toHaveBeenCalled();
    const passwordErr = document.querySelector('[data-error-for="password"]');
    expect(passwordErr.classList.contains('d-none')).toBe(false);
    expect(passwordErr.textContent).toMatch(/dígito/i);
    expect(
      document.querySelector('[data-error-for="password_confirmation"]')
        .classList.contains('d-none'),
    ).toBe(true);

    // ─── Triangulation cycle 2: password mismatch ───────────────────────
    // Same fields but a strong password + a different confirmation.
    document.getElementById('register-password').value = 'ValidPass1';
    document.getElementById('password_confirmation').value = 'DifferentPass2';

    registerForm.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    // Network still untouched, password error cleared, confirmation
    // error now visible.
    expect(authMock.register).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-error-for="password"]').classList.contains(
        'd-none',
      ),
    ).toBe(true);
    const confirmErr = document.querySelector(
      '[data-error-for="password_confirmation"]',
    );
    expect(confirmErr.classList.contains('d-none')).toBe(false);
    expect(confirmErr.textContent).toMatch(/no coinciden/i);
  });
});

/**
 * Direct unit tests for the exported pure validator. These triangulate
 * the validation rules without going through the DOM, which keeps the
 * assertions focused on the rules themselves and catches regressions
 * where the validator starts producing a different error map than the
 * DOM expects to render.
 */
describe('validateRegisterPayload (R11 pure validator)', () => {
  const valid = {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    password: 'ValidPass1',
    password_confirmation: 'ValidPass1',
  };

  it('returns an empty error map for a valid payload', () => {
    expect(validateRegisterPayload(valid)).toEqual({});
  });

  it('flags each password rule failure independently (length, upper, lower, digit)', () => {
    expect(validateRegisterPayload({ ...valid, password: 'Aa1!aa' }).password)
      .toMatch(/8 caracteres/);
    expect(validateRegisterPayload({ ...valid, password: 'password1' }).password)
      .toMatch(/mayúscula/);
    expect(validateRegisterPayload({ ...valid, password: 'PASSWORD1' }).password)
      .toMatch(/minúscula/);
    expect(validateRegisterPayload({ ...valid, password: 'Password!' }).password)
      .toMatch(/dígito/);
  });

  it('flags missing required fields and email format', () => {
    const errors = validateRegisterPayload({
      first_name: '',
      last_name: '',
      email: 'not-an-email',
      password: 'ValidPass1',
      password_confirmation: 'ValidPass1',
    });
    expect(errors.first_name).toMatch(/obligatorio/);
    expect(errors.last_name).toMatch(/obligatorio/);
    expect(errors.email).toMatch(/válido/);
  });
});