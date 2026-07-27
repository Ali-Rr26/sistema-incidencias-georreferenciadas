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

  it('calls the verify API with the query params intact when landing with a signed token', async () => {
    httpMock.get.mockResolvedValueOnce({
      message: 'Tu correo fue verificado correctamente.',
      verified: true,
    });

    const query = new URLSearchParams(
      'id=42&hash=abc123&expires=1700000000&signature=deadbeef',
    );
    await mountComponent({ query });

    expect(httpMock.get).toHaveBeenCalledTimes(1);
    // Verifica que la URL armada preserva `id`, `hash`, `expires`, `signature`.
    const calledPath = httpMock.get.mock.calls[0][0];
    expect(calledPath).toContain('/email/verify/42/abc123');
    expect(calledPath).toContain('expires=1700000000');
    expect(calledPath).toContain('signature=deadbeef');

    // Tras 3s, el componente redirige al login (async, lo suficiente).
    // No verificamos el setTimeout real para mantener el test veloz.
  });

  it('shows an error state when the verify API returns 403 with an expired code', async () => {
    const err = Object.assign(new Error('El enlace de verificación expiró.'), {
      status: 403,
      code: 'verification_expired',
    });
    httpMock.get.mockRejectedValueOnce(err);

    const query = new URLSearchParams(
      'id=42&hash=abc123&expires=1000&signature=deadbeef',
    );
    await mountComponent({ query });

    const errorEl = document.getElementById('estado-error');
    expect(errorEl.classList.contains('d-none')).toBe(false);
    expect(errorEl.textContent).toMatch(/expir/i);
  });

  it('shows the initial banner when the URL has no token params (post-201 register flow)', async () => {
    await mountComponent({ query: new URLSearchParams() });

    const inicial = document.getElementById('estado-inicial');
    expect(inicial.classList.contains('d-none')).toBe(false);

    expect(httpMock.get).not.toHaveBeenCalled();
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
    httpMock.post.mockResolvedValueOnce({ message: 'Tu correo fue verificado correctamente.', verified: true });

    await mountComponent({ query: new URLSearchParams('email=user@example.com') });

    document.getElementById('otp-input').value = '123456';
    document.getElementById('form-otp').dispatchEvent(new Event('submit', { cancelable: true }));

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
