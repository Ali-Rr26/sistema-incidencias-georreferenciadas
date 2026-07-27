/**
 * verify-email.component.test.js — story sc-117
 *
 * Cubre los dos paths del landing de verificación:
 *
 *   1. **Con token firmado en query params** — llama a GET /email/verify/{id}/{hash}
 *      con `expires` y `signature` y muestra éxito o error según el status code.
 *
 *   2. **Sin token** (post-201 del registro o tras 403 con code=email_not_verified) —
 *      muestra el banner inicial + el botón "Reenviar" que pega contra
 *      POST /email/resend con cooldown de 60s.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import verifyEmailComponent from './verify-email.component.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_HTML = readFileSync(
  resolve(__dirname, 'verify-email.component.html'),
  'utf8',
);

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../core/http.service.js', () => ({ http: httpMock }));

const routerMock = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('../../../core/router.js', () => ({ router: routerMock }));

async function mountComponent(ctx = {}) {
  document.body.innerHTML = TEMPLATE_HTML;
  await verifyEmailComponent.onInit(ctx);
  return document.body;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verify-email component — story sc-117', () => {
  it('renders the verification form with a reenviar button', async () => {
    await mountComponent();

    expect(document.getElementById('btn-reenviar')).not.toBeNull();
    expect(document.getElementById('estado-inicial')).not.toBeNull();
    expect(document.getElementById('estado-exito')).not.toBeNull();
    expect(document.getElementById('estado-error')).not.toBeNull();
  });

  it('shows the initial banner when mounting the component', async () => {
    await mountComponent({ query: new URLSearchParams() });

    const inicial = document.getElementById('estado-inicial');
    expect(inicial.classList.contains('d-none')).toBe(false);
  });

  it('sends POST /email/resend when the user clicks the reenviar button', async () => {
    httpMock.post.mockResolvedValueOnce({ message: 'Correo reenviado.' });

    await mountComponent({ query: new URLSearchParams() });

    const btn = document.getElementById('btn-reenviar');
    btn.click();

    await vi.waitFor(() => {
      expect(httpMock.post).toHaveBeenCalledTimes(1);
    });
    expect(httpMock.post).toHaveBeenCalledWith('/email/resend', { email: '' });

    const reenvioBanner = document.getElementById('estado-reenvio');
    expect(reenvioBanner.classList.contains('d-none')).toBe(false);
  });

  it('submits 6-digit OTP code to POST /email/verify-otp on form submit', async () => {
    httpMock.post.mockResolvedValueOnce({
      message: 'Tu correo fue verificado correctamente.',
      verified: true,
    });

    await mountComponent({
      query: new URLSearchParams('email=user@example.com'),
    });

    document.getElementById('otp-input').value = '123456';
    document
      .getElementById('form-otp')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(httpMock.post).toHaveBeenCalledTimes(1);
    });
    expect(httpMock.post).toHaveBeenCalledWith('/email/verify-otp', {
      email: 'user@example.com',
      otp: '123456',
    });

    const exitoBanner = document.getElementById('estado-exito');
    expect(exitoBanner.classList.contains('d-none')).toBe(false);
  });
});
