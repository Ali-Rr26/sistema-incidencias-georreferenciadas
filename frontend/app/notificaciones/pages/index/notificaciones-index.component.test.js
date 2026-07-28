/**
 * Unit tests for /notificaciones admin page.
 *
 * Covers WU-1 (row context — incident title link + timeAgo + pending
 * counter), WU-2 (inline rejection form), WU-3 (decision opacity — badge
 * label + reason display), WU-4 (keyboard nav + focus advance).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the service layer so the component reads a deterministic queue.
const mockService = {
  list: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  markRead: vi.fn(),
};

vi.mock('../../../shared/notification.service.js', () => ({
  notificationService: mockService,
}));

const mockToast = vi.fn();
vi.mock('../../../utils/ui.js', () => ({
  mostrarToast: mockToast,
}));

const mockNavigate = vi.fn();
vi.mock('../../../core/router.js', () => ({
  router: { navigate: mockNavigate },
}));

// Import after mocks so the component picks them up.
const { APPROVAL_TYPE } = await import(
  './notificaciones-index.component.js'
);

/**
 * Mount the component by injecting its HTML and calling onInit. Returns
 * the DOM nodes the tests need plus a destroy hook.
 */
async function mount() {
  const { default: component } = await import(
    './notificaciones-index.component.js'
  );
  // The component's template is registered via the `template` field on
  // its default export; for unit tests we simulate the rendered DOM by
  // placing the static part of the template inline.
  document.body.innerHTML = `
    <div class="gr-page">
      <div class="gr-page__header">
        <p class="gr-page__counter">
          <span class="gr-page__counter-value" id="notificaciones-pending-value">—</span>
          <span class="gr-page__counter-label">pendientes de aprobación</span>
        </p>
      </div>
      <div class="gr-card gr-filters">
        <select id="notificaciones-filtro" class="gr-select">
          <option value="${APPROVAL_TYPE}">Aprobación</option>
          <option value="">Todas</option>
        </select>
      </div>
      <div class="gr-card" id="notificaciones-lista" aria-live="polite">
        <p class="text-muted">Cargando notificaciones...</p>
      </div>
    </div>
  `;

  await component.onInit();

  return {
    list: document.getElementById('notificaciones-lista'),
    pendingValue: document.getElementById('notificaciones-pending-value'),
    filter: document.getElementById('notificaciones-filtro'),
    mockService,
  };
}

function makeApproval({
  id = 1,
  decision = null,
  decidedAt = null,
  rejectionReason = null,
  read = false,
  incidentTitle = 'Bache en Av. Bolívar',
} = {}) {
  return {
    id,
    type: APPROVAL_TYPE,
    message: `Incidente #${id} requiere aprobación.`,
    read,
    incident: { id: 100 + id, title: incidentTitle },
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    data: {
      incident_id: 100 + id,
      actor_user_id: 5,
      decision,
      rejection_reason: rejectionReason,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      organization_id: 1,
      decided_at: decidedAt,
    },
  };
}

describe('notificaciones-index — WU-1 row context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the incident title as a navigable link to /incidencias/{id}', async () => {
    mockService.list.mockResolvedValue({ data: [makeApproval()], meta: null });
    const { list } = await mount();
    const link = list.querySelector('.notification-row__title');
    expect(link).not.toBeNull();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/incidencias/101');
    expect(link.textContent).toBe('Bache en Av. Bolívar');
  });

  it('renders the timestamp via timeAgo (relative, not raw ISO)', async () => {
    mockService.list.mockResolvedValue({ data: [makeApproval()], meta: null });
    const { list } = await mount();
    const time = list.querySelector('.notification-row__time');
    expect(time).not.toBeNull();
    expect(time.tagName).toBe('TIME');
    // timeAgo('3 hours ago' shape) — exact copy varies by locale; the
    // important contract is "not a raw ISO string".
    expect(time.textContent).not.toMatch(/T\d{2}:\d{2}/);
    expect(time.textContent.length).toBeGreaterThan(0);
  });

  it('falls back to the generic message when incident.title is missing', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ incidentTitle: '' })],
      meta: null,
    });
    const { list } = await mount();
    const link = list.querySelector('.notification-row__title');
    expect(link.textContent).toBe('Incidente #1 requiere aprobación.');
  });

  it('updates the pending counter to match unresolved approval notifications', async () => {
    mockService.list.mockResolvedValue({
      data: [
        makeApproval({ id: 1 }),
        makeApproval({ id: 2 }),
        makeApproval({ id: 3, decision: 'approved', decidedAt: new Date().toISOString() }),
      ],
      meta: null,
    });
    const { pendingValue } = await mount();
    // 2 unresolved, 1 already decided → counter reads 2.
    expect(pendingValue.textContent).toBe('2');
    expect(pendingValue.dataset.empty).toBe('false');
  });

  it('marks the counter empty when no pending approvals remain', async () => {
    mockService.list.mockResolvedValue({
      data: [
        makeApproval({ id: 1, decision: 'approved', decidedAt: new Date().toISOString() }),
        makeApproval({ id: 2, decision: 'rejected', decidedAt: new Date().toISOString() }),
      ],
      meta: null,
    });
    const { pendingValue } = await mount();
    expect(pendingValue.textContent).toBe('0');
    expect(pendingValue.dataset.empty).toBe('true');
  });
});