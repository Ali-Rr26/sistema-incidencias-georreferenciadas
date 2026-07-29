/**
 * justificacion-rechazo-modal — unit tests
 *
 * Coverage:
 * - button disabled when reason < 10 chars
 * - button disabled when reason > 500 chars
 * - button enabled when reason is 10..500 chars
 * - onConfirm callback receives trimmed reason
 * - textarea autofocus on open
 * - cancel closes modal
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearAuthState, setAccessToken } from '../../../core/http.service.js';

// ---------------------------------------------------------------------------
// Bootstrap Modal mock
// ---------------------------------------------------------------------------
let shownModalEl = null;

class MockModal {
  constructor(el) {
    this._el = el;
    shownModalEl = el;
  }

  show() {
    shownModalEl = this._el;
    setTimeout(() => this._el.dispatchEvent(new Event('shown.bs.modal')), 0);
  }

  hide() {
    shownModalEl = null;
  }

  static getInstance() {
    return shownModalEl ? new MockModal(shownModalEl) : null;
  }
}

// ---------------------------------------------------------------------------
// Test setup helper
// ---------------------------------------------------------------------------
async function createModal() {
  globalThis.bootstrap = {
    Modal: MockModal,
  };

  const { default: JustificacionRechazoModal } =
    await import('./justificacion-rechazo-modal.component.js');
  const modal = new JustificacionRechazoModal();
  modal.id = 'justificacion-rechazo-modal';
  document.body.appendChild(modal);

  // Wait for connectedCallback to render and bind
  await vi.waitFor(() => {
    const textarea = modal.querySelector('#rechazo-motivo');
    if (!textarea) throw new Error('textarea not found');
  });

  return modal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('JustificacionRechazoModal', () => {
  beforeEach(async () => {
    clearAuthState();
    setAccessToken('test-token');
    shownModalEl = null;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // Button disabled state
  // -------------------------------------------------------------------------
  describe('Button disabled state', () => {
    it('button disabled when reason < 10 chars', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      textarea.value = 'corto';
      textarea.dispatchEvent(new Event('input'));

      expect(confirmarBtn.disabled).toBe(true);
    });

    it('button disabled when reason > 500 chars', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      textarea.value = 'a'.repeat(501);
      textarea.dispatchEvent(new Event('input'));

      expect(confirmarBtn.disabled).toBe(true);
    });

    it('button enabled when reason is 10..500 chars', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      textarea.value = 'a'.repeat(10);
      textarea.dispatchEvent(new Event('input'));

      expect(confirmarBtn.disabled).toBe(false);
    });

    it('button enabled at exactly 500 chars', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      textarea.value = 'a'.repeat(500);
      textarea.dispatchEvent(new Event('input'));

      expect(confirmarBtn.disabled).toBe(false);
    });

    it('button disabled at exactly 501 chars', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      textarea.value = 'a'.repeat(501);
      textarea.dispatchEvent(new Event('input'));

      expect(confirmarBtn.disabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // onConfirm callback
  // -------------------------------------------------------------------------
  describe('onConfirm callback', () => {
    it('onConfirm callback receives trimmed reason', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      const callback = vi.fn();
      modal.show(callback);

      textarea.value = '   reason with spaces   ';
      textarea.dispatchEvent(new Event('input'));

      confirmarBtn.click();

      expect(callback).toHaveBeenCalledWith('reason with spaces');
    });

    it('dispatches confirm CustomEvent with reason detail', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const confirmarBtn = modal.querySelector('.btn-confirmar-rechazo');

      const callback = vi.fn();
      modal.show(callback);

      textarea.value = 'motivo de prueba';
      textarea.dispatchEvent(new Event('input'));

      let receivedEvent = null;
      modal.addEventListener('confirm', (e) => {
        receivedEvent = e;
      });

      confirmarBtn.click();

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.detail.reason).toBe('motivo de prueba');
    });
  });

  // -------------------------------------------------------------------------
  // Autofocus
  // -------------------------------------------------------------------------
  describe('Autofocus', () => {
    it('textarea autofocus on open after modal is shown', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const focusSpy = vi.fn();
      textarea.focus = focusSpy;

      modal.show();

      // Wait for shown.bs.modal event
      await vi.waitFor(() => {
        if (!focusSpy.mock.calls.length) throw new Error('not focused yet');
      });

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cancel behavior
  // -------------------------------------------------------------------------
  describe('Cancel behavior', () => {
    it('cancel button triggers modal hide', async () => {
      const modal = await createModal();
      const cancelBtn = modal.querySelector(
        '.btn-secondary[data-bs-dismiss="modal"]',
      );

      modal.show();

      cancelBtn.click();

      // Modal should be hidden
      expect(shownModalEl).toBeNull();
    });

    it('dispatches cancel CustomEvent on modal hidden', async () => {
      const modal = await createModal();

      let cancelEvent = null;
      modal.addEventListener('cancel', (e) => {
        cancelEvent = e;
      });

      // Simulate hidden.bs.modal event
      const modalEl = modal.querySelector('.modal');
      modalEl.dispatchEvent(new Event('hidden.bs.modal'));

      expect(cancelEvent).not.toBeNull();
    });

    it('resets textarea after modal is hidden', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');

      modal.show();

      textarea.value = 'some reason';
      textarea.dispatchEvent(new Event('input'));

      // Simulate hidden.bs.modal event
      const modalEl = modal.querySelector('.modal');
      modalEl.dispatchEvent(new Event('hidden.bs.modal'));

      expect(textarea.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Char counter
  // -------------------------------------------------------------------------
  describe('Char counter', () => {
    it('counter updates on input', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const counter = modal.querySelector('.char-counter');

      textarea.value = 'abc';
      textarea.dispatchEvent(new Event('input'));

      expect(counter.textContent).toBe('3 / 500');
    });

    it('counter shows actual value length (not trimmed)', async () => {
      const modal = await createModal();
      const textarea = modal.querySelector('#rechazo-motivo');
      const counter = modal.querySelector('.char-counter');

      textarea.value = '   abc   ';
      textarea.dispatchEvent(new Event('input'));

      // Counter shows 9 (the actual value length: 3 + 3 + 3 = 9 chars)
      expect(counter.textContent).toBe('9 / 500');
    });
  });
});
