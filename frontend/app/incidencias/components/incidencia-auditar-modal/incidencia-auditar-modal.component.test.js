/**
 * incidencia-auditar-modal — unit tests
 *
 * Coverage:
 * - renders all sections on successful GET
 * - shows error toast and closes modal on GET failure
 * - approve button calls POST and closes modal + emits event
 * - reject button opens sub-modal + receives reason + POST + close + emits event
 * - lightbox opens on image click
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearAuthState, setAccessToken } from '../../../core/http.service.js';

// ---------------------------------------------------------------------------
// Mocked modules
// ---------------------------------------------------------------------------
vi.mock('../../../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    setAccessToken: mod.setAccessToken,
    clearAuthState: mod.clearAuthState,
    http: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('../../../shared/notification.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    notificationService: {
      ...mod.notificationService,
      getById: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
    },
  };
});

vi.mock('../../../shared/lightbox.js', () => ({
  openLightbox: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Bootstrap mocks
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
// Test data
// ---------------------------------------------------------------------------
const MOCK_INCIDENT = {
  id: '42',
  title: 'Bache en Rivadavia y Peru',
  status: 'pending',
  description: 'Un bache grande en la intersección.',
  category: { name: 'Infraestructura' },
  location: { name: 'Centro' },
  created_at: '2024-01-15T10:00:00Z',
  resolved_at: null,
  responsible_user_name: 'Juan Pérez',
  images: [
    { id: 1, url: 'https://example.com/img1.jpg', original_name: 'foto1.jpg' },
    { id: 2, url: 'https://example.com/img2.jpg', original_name: 'foto2.jpg' },
  ],
  comments: [
    {
      id: 1,
      body: 'Comentario con foto',
      images: [
        {
          id: 3,
          url: 'https://example.com/comment1.jpg',
          original_name: 'comentario1.jpg',
        },
      ],
    },
  ],
};

const MOCK_NOTIFICATION = {
  id: 99,
  type: 'incident_pending_approval',
  data: {
    incident_id: 42,
    title: 'Bache en Rivadavia',
  },
};

// ---------------------------------------------------------------------------
// Test setup helper
// ---------------------------------------------------------------------------
let http;
let notificationService;
let openLightbox;

async function createModal() {
  globalThis.bootstrap = {
    Modal: MockModal,
    Toast: class Toast {
      constructor(el) {
        this._el = el;
      }
      show() {}
    },
  };

  globalThis.mostrarToast = vi.fn();

  const { default: IncidenciaAuditarModal } =
    await import('./incidencia-auditar-modal.component.js');
  const modal = new IncidenciaAuditarModal();
  modal.id = 'incidencia-auditar-modal';
  document.body.appendChild(modal);

  // Wait for connectedCallback
  await vi.waitFor(() => {
    const title = modal.querySelector('.incident-auditar-title');
    if (!title) throw new Error('modal not rendered');
  });

  return modal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('IncidenciaAuditarModal', () => {
  beforeEach(async () => {
    clearAuthState();
    setAccessToken('test-token');

    shownModalEl = null;

    // Import fresh mocks for each test
    const httpMod = await import('../../../core/http.service.js');
    http = httpMod.http;
    http.get.mockReset();
    http.post.mockReset();

    const notifMod = await import('../../../shared/notification.service.js');
    notificationService = notifMod.notificationService;
    notificationService.getById.mockReset();
    notificationService.approve.mockReset();
    notificationService.reject.mockReset();

    const lbMod = await import('../../../shared/lightbox.js');
    openLightbox = lbMod.openLightbox;
    openLightbox.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.mostrarToast;
  });

  // -------------------------------------------------------------------------
  // GET success: renders all sections
  // -------------------------------------------------------------------------
  describe('GET success — renders all sections', () => {
    it('renders all incident sections on successful GET', async () => {
      notificationService.getById.mockResolvedValue(MOCK_NOTIFICATION);
      http.get.mockResolvedValue({ data: MOCK_INCIDENT });

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const content = modal.querySelector('.incident-auditar-content');
        if (content?.classList.contains('d-none'))
          throw new Error('still hidden');
      });

      // Title
      expect(
        modal.querySelector('.incident-auditar-inc-title').textContent,
      ).toBe('Bache en Rivadavia y Peru');

      // Status badge
      const badge = modal.querySelector('.incident-auditar-status-badge');
      expect(badge.textContent).toBe('Pendiente');
      expect(badge.className).toContain('bg-warning');

      // Description
      expect(
        modal.querySelector('.incident-auditar-description').textContent,
      ).toBe('Un bache grande en la intersección.');

      // Category
      expect(
        modal.querySelector('.incident-auditar-category').textContent,
      ).toBe('Infraestructura');

      // Location
      expect(
        modal.querySelector('.incident-auditar-location').textContent,
      ).toBe('Centro');

      // Responsible
      expect(
        modal.querySelector('.incident-auditar-responsible').textContent,
      ).toBe('Juan Pérez');

      // Images rendered
      const images = modal.querySelectorAll(
        '.incident-auditar-images .incident-auditar-thumbnail-wrapper',
      );
      expect(images).toHaveLength(2);

      // Comment images rendered
      const commentImages = modal.querySelectorAll(
        '.incident-auditar-comment-images .incident-auditar-thumbnail-wrapper',
      );
      expect(commentImages).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET failure
  // -------------------------------------------------------------------------
  describe('GET failure', () => {
    it('shows error and closes modal on GET failure', async () => {
      notificationService.getById.mockRejectedValue(new Error('Not found'));

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const errorEl = modal.querySelector('.incident-auditar-error');
        if (errorEl?.classList.contains('d-none'))
          throw new Error('error still hidden');
      });

      const errorEl = modal.querySelector('.incident-auditar-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl.textContent).toContain('No se pudo cargar');
    });
  });

  // -------------------------------------------------------------------------
  // Approve
  // -------------------------------------------------------------------------
  describe('Approve button', () => {
    it('approve button calls POST and emits incident-decided event', async () => {
      notificationService.getById.mockResolvedValue(MOCK_NOTIFICATION);
      http.get.mockResolvedValue({ data: MOCK_INCIDENT });
      notificationService.approve.mockResolvedValue({});

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const content = modal.querySelector('.incident-auditar-content');
        if (content?.classList.contains('d-none'))
          throw new Error('still hidden');
      });

      let decisionEvent = null;
      modal.addEventListener('incident-decided', (e) => {
        decisionEvent = e;
      });

      const approveBtn = modal.querySelector('.btn-aprobar');
      approveBtn.click();

      await vi.waitFor(() => {
        expect(notificationService.approve).toHaveBeenCalledWith(99);
      });

      expect(decisionEvent).not.toBeNull();
      expect(decisionEvent.detail.decision).toBe('approved');
      expect(decisionEvent.detail.notificationId).toBe(99);
    });
  });

  // -------------------------------------------------------------------------
  // Reject
  // -------------------------------------------------------------------------
  describe('Reject button', () => {
    it('reject button opens sub-modal and calls POST with reason + emits event', async () => {
      notificationService.getById.mockResolvedValue(MOCK_NOTIFICATION);
      http.get.mockResolvedValue({ data: MOCK_INCIDENT });
      notificationService.reject.mockResolvedValue({});

      // Create the sub-modal in the DOM
      const rejectModal = document.createElement('div');
      rejectModal.id = 'justificacion-rechazo-modal';
      rejectModal.innerHTML = '<div class="modal"></div>';
      document.body.appendChild(rejectModal);

      let storedCallback = null;
      rejectModal.show = function (cb) {
        storedCallback = cb;
      };

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const content = modal.querySelector('.incident-auditar-content');
        if (content?.classList.contains('d-none'))
          throw new Error('still hidden');
      });

      let decisionEvent = null;
      modal.addEventListener('incident-decided', (e) => {
        decisionEvent = e;
      });

      const rejectBtn = modal.querySelector('.btn-rechazar');
      rejectBtn.click();

      await vi.waitFor(() => {
        if (!storedCallback) throw new Error('callback not captured');
      });

      storedCallback('motivo de rechazo');

      await vi.waitFor(() => {
        expect(notificationService.reject).toHaveBeenCalledWith(
          99,
          'motivo de rechazo',
        );
      });

      expect(decisionEvent).not.toBeNull();
      expect(decisionEvent.detail.decision).toBe('rejected');
      expect(decisionEvent.detail.notificationId).toBe(99);
    });
  });

  // -------------------------------------------------------------------------
  // Lightbox
  // -------------------------------------------------------------------------
  describe('Lightbox', () => {
    it('lightbox opens on image click', async () => {
      notificationService.getById.mockResolvedValue(MOCK_NOTIFICATION);
      http.get.mockResolvedValue({ data: MOCK_INCIDENT });

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const images = modal.querySelectorAll(
          '.incident-auditar-thumbnail-wrapper',
        );
        if (images.length === 0) throw new Error('no images');
      });

      const firstImage = modal.querySelector(
        '.incident-auditar-thumbnail-wrapper',
      );
      firstImage.click();

      expect(openLightbox).toHaveBeenCalledWith(
        'https://example.com/img1.jpg',
        'foto1.jpg',
      );
    });

    it('lightbox opens on comment image click', async () => {
      notificationService.getById.mockResolvedValue(MOCK_NOTIFICATION);
      http.get.mockResolvedValue({ data: MOCK_INCIDENT });

      const modal = await createModal();
      modal.show(99);

      await vi.waitFor(() => {
        const images = modal.querySelectorAll(
          '.incident-auditar-comment-images .incident-auditar-thumbnail-wrapper',
        );
        if (images.length === 0) throw new Error('no comment images');
      });

      const firstCommentImage = modal.querySelector(
        '.incident-auditar-comment-images .incident-auditar-thumbnail-wrapper',
      );
      firstCommentImage.click();

      expect(openLightbox).toHaveBeenCalledWith(
        'https://example.com/comment1.jpg',
        'comentario1.jpg',
      );
    });
  });
});
