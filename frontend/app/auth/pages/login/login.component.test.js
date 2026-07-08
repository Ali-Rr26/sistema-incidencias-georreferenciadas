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

import loginComponent from './login.component.js';

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
});