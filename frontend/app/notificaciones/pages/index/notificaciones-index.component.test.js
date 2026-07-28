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
const { APPROVAL_TYPE } = await import('./notificaciones-index.component.js');

/**
 * Mount the component by injecting its HTML and calling onInit. Returns
 * the DOM nodes the tests need plus a destroy hook.
 */
async function mount() {
  const { default: component } =
    await import('./notificaciones-index.component.js');
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
          <option value="">Todas</option>
          <option value="${APPROVAL_TYPE}">Aprobación</option>
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

async function flush() {
  // Allow chained microtasks (await chain inside the click handler) to
  // settle. A single setTimeout(0) is not enough — vi.fn() resolves go
  // through a microtask queue that needs several ticks.
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 0));
  }
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
        makeApproval({
          id: 3,
          decision: 'approved',
          decidedAt: new Date().toISOString(),
        }),
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
        makeApproval({
          id: 1,
          decision: 'approved',
          decidedAt: new Date().toISOString(),
        }),
        makeApproval({
          id: 2,
          decision: 'rejected',
          decidedAt: new Date().toISOString(),
        }),
      ],
      meta: null,
    });
    const { pendingValue } = await mount();
    expect(pendingValue.textContent).toBe('0');
    expect(pendingValue.dataset.empty).toBe('true');
  });

  it('component exposes `style` so the router injects the scoped CSS (regression guard)', async () => {
    mockService.list.mockResolvedValue({ data: [], meta: null });
    const { default: component } =
      await import('./notificaciones-index.component.js');
    // Without `style`, the router would skip injecting the component CSS
    // entirely — see router.js:_mountPage. The page would render with
    // zero component-scoped styles, looking like "sin estilo".
    expect(typeof component.style).toBe('string');
    expect(component.style.length).toBeGreaterThan(0);
    expect(component.style).toMatch(/\.notification-row/);
    expect(component.style).toMatch(/\.gr-status/);
  });

  it('default filter loads ALL notification types, not just approvals (regression guard)', async () => {
    mockService.list.mockResolvedValue({
      data: [
        makeApproval({ id: 1 }),
        {
          ...makeApproval({ id: 2, incidentTitle: 'Reclamo de vecino' }),
          type: 'claim',
        },
        {
          ...makeApproval({ id: 3, incidentTitle: 'Cambio de estado' }),
          type: 'status_change',
        },
      ],
      meta: null,
    });
    const { list, pendingValue } = await mount();
    // All three rows render regardless of type — the default filter is
    // "all". The header counter still tracks only the approval subset.
    expect(list.querySelectorAll('.notification-row')).toHaveLength(3);
    expect(pendingValue.textContent).toBe('1');
  });

  it('clicking the title link calls router.navigate with the PATH, not the absolute URL (regression guard)', async () => {
    mockService.list.mockResolvedValue({ data: [makeApproval()], meta: null });
    const { list } = await mount();
    const link = list.querySelector('.notification-row__title');
    // element.href is what the browser would resolve — absolute URL.
    expect(link.href).toMatch(/^https?:\/\//);
    // Our click handler must navigate with the raw path. Catching this
    // bug: a previous build passed title.href (the absolute URL) to
    // router.navigate, which concatenated onto window.location.hash and
    // never matched /incidencias/:id — fell through to /not-found.
    link.click();
    expect(mockNavigate).toHaveBeenCalledWith('/incidencias/101');
  });
});

describe('notificaciones-index — meta line per notification type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders "Reclamada por {actor}" for claim notifications', async () => {
    mockService.list.mockResolvedValue({
      data: [
        {
          ...makeApproval({ id: 1, incidentTitle: 'Bache en Av. Bolívar' }),
          type: 'claim',
          actor: { id: 5, name: 'Carlos', role: 'operador_organizacion' },
        },
      ],
      meta: null,
    });
    const { list } = await mount();
    const meta = list.querySelector('.notification-row__meta');
    expect(meta).not.toBeNull();
    expect(meta.textContent).toBe('Reclamada por Carlos');
  });

  it('renders "Liberada por {actor}" for assignment notifications', async () => {
    mockService.list.mockResolvedValue({
      data: [
        {
          ...makeApproval({ id: 1, incidentTitle: 'Bache en Av. Bolívar' }),
          type: 'assignment',
          actor: { id: 5, name: 'María', role: 'operador_organizacion' },
        },
      ],
      meta: null,
    });
    const { list } = await mount();
    const meta = list.querySelector('.notification-row__meta');
    expect(meta.textContent).toBe('Liberada por María');
  });

  it('renders "Estado: {human}" for status_change notifications (no actor needed)', async () => {
    mockService.list.mockResolvedValue({
      data: [
        {
          ...makeApproval({ id: 1, incidentTitle: 'Bache en Av. Bolívar' }),
          type: 'status_change',
          actor: null,
          data: { status: 'resolved' },
        },
      ],
      meta: null,
    });
    const { list } = await mount();
    const meta = list.querySelector('.notification-row__meta');
    expect(meta.textContent).toBe('Estado: Resuelta');
  });

  it('renders "Resuelta por {actor}" for incidencia_atendida_para_aprobacion', async () => {
    mockService.list.mockResolvedValue({
      data: [
        {
          ...makeApproval({ id: 1, incidentTitle: 'Bache en Av. Bolívar' }),
          type: 'incidencia_atendida_para_aprobacion',
          actor: { id: 5, name: 'Pedro', role: 'operador_organizacion' },
        },
      ],
      meta: null,
    });
    const { list } = await mount();
    const meta = list.querySelector('.notification-row__meta');
    expect(meta.textContent).toBe('Resuelta por Pedro');
  });

  it('falls back to "Sistema" when the actor lookup returns null (deleted user, legacy row)', async () => {
    mockService.list.mockResolvedValue({
      data: [
        {
          ...makeApproval({ id: 1, incidentTitle: 'Bache en Av. Bolívar' }),
          type: 'claim',
          actor: null,
        },
      ],
      meta: null,
    });
    const { list } = await mount();
    const meta = list.querySelector('.notification-row__meta');
    expect(meta.textContent).toBe('Reclamada por Sistema');
  });
});

describe('notificaciones-index — WU-2 inline rejection form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a hidden inline rejection form on every approval row', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 }), makeApproval({ id: 2 })],
      meta: null,
    });
    const { list } = await mount();
    const forms = list.querySelectorAll('[data-role="reject-form"]');
    expect(forms).toHaveLength(2);
    forms.forEach((form) =>
      expect(form.classList.contains('d-none')).toBe(true),
    );
  });

  it('clicking "Rechazar" transitions the row to state="rejecting" and focuses the textarea', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    const rejectBtn = article.querySelector('.reject');

    rejectBtn.click();

    expect(article.dataset.state).toBe('rejecting');
    const form = article.querySelector('[data-role="reject-form"]');
    expect(form.classList.contains('d-none')).toBe(false);
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
  });

  it('clicking "Cancelar" returns the row to state="normal" and focuses the Rechazar button', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    article.querySelector('.reject-cancel').click();

    expect(article.dataset.state).toBe('normal');
    const form = article.querySelector('[data-role="reject-form"]');
    expect(form.classList.contains('d-none')).toBe(true);
    expect(document.activeElement?.classList.contains('reject')).toBe(true);
  });

  it('Confirm button stays disabled until the reason has any non-whitespace character (required, not min-3)', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');
    const confirm = article.querySelector('.reject-confirm');

    // Empty: disabled.
    expect(confirm.disabled).toBe(true);
    // Whitespace-only: still disabled (we trim before validating).
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    expect(confirm.disabled).toBe(true);
    // A single non-whitespace char is enough (the previous min-3 contract
    // was overkill — the backend only enforces `required`, so the
    // client-side gate must match it).
    textarea.value = 'x';
    textarea.dispatchEvent(new Event('input'));
    expect(confirm.disabled).toBe(false);
  });

  it('clearing the textarea back to empty re-disables the Confirm button', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');
    const confirm = article.querySelector('.reject-confirm');

    textarea.value = 'algo';
    textarea.dispatchEvent(new Event('input'));
    expect(confirm.disabled).toBe(false);
    textarea.value = '';
    textarea.dispatchEvent(new Event('input'));
    expect(confirm.disabled).toBe(true);
  });

  it('surfaces the server-side 422 errors.reason[0] in the inline form when the API rejects', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const serverError = new Error('Validation failed');
    serverError.status = 422;
    serverError.data = { errors: { reason: ['El motivo es obligatorio.'] } };
    mockService.reject.mockRejectedValue(serverError);
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');
    textarea.value = 'x';
    textarea.dispatchEvent(new Event('input'));
    article.querySelector('.reject-confirm').click();

    await vi.waitUntil(
      () =>
        article.querySelector('.notification-row__reject-error')?.textContent
          ?.length > 0,
    );

    const errorSlot = article.querySelector('.notification-row__reject-error');
    expect(errorSlot).not.toBeNull();
    expect(errorSlot.textContent).toContain('El motivo es obligatorio.');
  });

  it('clicking Confirm calls notificationService.reject with the typed reason', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    mockService.reject.mockResolvedValue({});
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');
    textarea.value = 'falta evidencia fotográfica';
    textarea.dispatchEvent(new Event('input'));
    article.querySelector('.reject-confirm').click();

    // Click handler is async; the service call happens in a microtask.
    await flush();
    expect(mockService.reject).toHaveBeenCalledWith(
      1,
      'falta evidencia fotográfica',
    );
  });

  it('Escape inside the form cancels (matches keydown contract)', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const form = article.querySelector('[data-role="reject-form"]');
    form.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(article.dataset.state).toBe('normal');
  });
});

describe('notificaciones-index — WU-3 decision opacity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a localized "Aprobada" badge after approval', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    mockService.approve.mockResolvedValue({});
    const { list } = await mount();
    list.querySelector('.approve').click();
    await flush();

    const article = list.querySelector('.notification-row');
    expect(article.dataset.state).toBe('decided');
    const badge = article.querySelector('.notification-row__decision');
    expect(badge.textContent).toBe('Aprobada');
    expect(badge.classList.contains('gr-status--approved')).toBe(true);
  });

  it('renders a localized "Rechazada" badge with the rejection reason after rejection', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    mockService.reject.mockResolvedValue({});
    const { list } = await mount();
    let article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');
    textarea.value = 'falta evidencia';
    textarea.dispatchEvent(new Event('input'));
    article.querySelector('.reject-confirm').click();
    await flush();

    // render() rebuilt the article — query the fresh DOM node.
    article = list.querySelector('.notification-row');
    expect(article.dataset.state).toBe('decided');
    const badge = article.querySelector('.notification-row__decision');
    expect(badge.textContent).toBe('Rechazada');
    expect(badge.classList.contains('gr-status--rejected')).toBe(true);

    // The reason must surface under the badge so next-shift admins see it.
    const reasonEl = article.querySelector('.notification-row__reason');
    expect(reasonEl).not.toBeNull();
    expect(reasonEl.textContent).toContain('falta evidencia');
  });

  it('renders the decided-at timestamp as timeAgo after a decision', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    mockService.approve.mockResolvedValue({});
    const { list } = await mount();
    list.querySelector('.approve').click();
    await new Promise((r) => setTimeout(r, 0));

    const decidedAt = list.querySelector('.notification-row__decided-at');
    expect(decidedAt).not.toBeNull();
    expect(decidedAt.tagName).toBe('TIME');
    expect(decidedAt.textContent.length).toBeGreaterThan(0);
  });
});

describe('notificaciones-index — WU-4 keyboard nav + focus advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it("ArrowDown moves focus from one row's approve to the next row's approve", async () => {
    mockService.list.mockResolvedValue({
      data: [
        makeApproval({ id: 1 }),
        makeApproval({ id: 2 }),
        makeApproval({ id: 3 }),
      ],
      meta: null,
    });
    const { list } = await mount();
    const approves = list.querySelectorAll('button.approve');
    approves[0].focus();

    approves[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );

    expect(document.activeElement).toBe(approves[1]);
  });

  it("ArrowUp moves focus from one row to the previous row's approve", async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 }), makeApproval({ id: 2 })],
      meta: null,
    });
    const { list } = await mount();
    const approves = list.querySelectorAll('button.approve');
    approves[1].focus();

    approves[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );

    expect(document.activeElement).toBe(approves[0]);
  });

  it('j and k mirror ArrowDown and ArrowUp (vim-style nav)', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 }), makeApproval({ id: 2 })],
      meta: null,
    });
    const { list } = await mount();
    const approves = list.querySelectorAll('button.approve');
    approves[0].focus();

    approves[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', bubbles: true }),
    );
    expect(document.activeElement).toBe(approves[1]);

    approves[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true }),
    );
    expect(document.activeElement).toBe(approves[0]);
  });

  it('keyboard nav does not hijack typing inside the rejection form textarea', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 })],
      meta: null,
    });
    const { list } = await mount();
    const article = list.querySelector('.notification-row');
    article.querySelector('.reject').click();
    const textarea = article.querySelector('textarea');

    // j/k typed in the textarea must NOT navigate away.
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', bubbles: true }),
    );
    expect(document.activeElement).toBe(textarea);
  });

  it('after approving a row, focus advances to the next undecided row', async () => {
    mockService.list.mockResolvedValue({
      data: [makeApproval({ id: 1 }), makeApproval({ id: 2 })],
      meta: null,
    });
    mockService.approve.mockResolvedValue({});
    const { list } = await mount();
    const approves = list.querySelectorAll('button.approve');
    approves[0].focus();
    approves[0].click();
    await flush();

    const newArticles = list.querySelectorAll('.notification-row');
    const nextApprove = newArticles[1].querySelector('button.approve');
    expect(document.activeElement).toBe(nextApprove);
  });

  it('after approving the LAST undecided row, focus wraps to the first undecided row', async () => {
    mockService.list.mockResolvedValue({
      data: [
        makeApproval({ id: 1 }),
        makeApproval({
          id: 2,
          decision: 'approved',
          decidedAt: new Date().toISOString(),
        }),
        makeApproval({ id: 3 }),
      ],
      meta: null,
    });
    mockService.approve.mockResolvedValue({});
    const { list } = await mount();
    // The first undecided row is id=1.
    const articles = list.querySelectorAll('.notification-row');
    articles[0].querySelector('button.approve').click();
    await flush();

    // After approving id=1, the next undecided is id=3 (index 2).
    const newArticles = list.querySelectorAll('.notification-row');
    const nextApprove = newArticles[2].querySelector('button.approve');
    expect(document.activeElement).toBe(nextApprove);
  });
});
