import template from './notificaciones-index.component.html?raw';
import style from './notificaciones-index.component.css?raw';
import { notificationService } from '../../../shared/notification.service.js';
import { mostrarToast } from '../../../utils/ui.js';
import { router } from '../../../core/router.js';
import { timeAgo } from '../../../utils/format.js';

const APPROVAL_TYPE = 'incidencia_atendida_para_aprobacion';
// Per-page cap for the notification queue. 200 is large enough for the
// realistic worst case (one admin × many pending approvals in a busy org)
// while still bounding response size. Per-CodeRabbit feedback on PR #227.
const QUEUE_PAGE_SIZE = 200;
// Default filter is 'all' (no type filter applied). The header counter
// surfaces how many of those are pending approval so admins land on the
// page knowing the workload without being limited to that subset.
const DEFAULT_FILTER = '';

/**
 * Build one notification <article> using DOM APIs (textContent /
 * setAttribute) so interpolated fields like `message`, `created_at`,
 * `id`, and `decision` cannot become stored XSS via the rendering layer.
 *
 * Previously this component interpolated the same values directly into an
 * `innerHTML` template literal, which is unsafe for any user-controlled
 * source — including the `message` field, which is derived from the
 * incident title authored by another user.
 *
 * The row now surfaces the linked incident title as a navigable link and
 * the notification timestamp via `timeAgo()`, so admins can decide
 * without opening the bell panel or the incident detail page.
 */
function buildRow(item) {
  const article = document.createElement('article');
  article.className = `notification-row ${item.read ? 'is-read' : 'is-unread'}`;
  article.dataset.id = String(item.id);
  // Stable selector for keyboard nav and focus management.
  article.dataset.notificationId = String(item.id);
  // Three-state machine: 'normal' (default), 'rejecting' (inline form
  // open), or 'decided' (terminal — badge replaces buttons).
  article.dataset.state = item.data?.decision ? 'decided' : 'normal';

  const header = document.createElement('div');
  header.className = 'notification-row__body';

  const titleText =
    (item.incident?.title && String(item.incident.title).trim()) ||
    item.message ||
    'Notificación';

  const title = document.createElement('a');
  title.className = 'notification-row__title';
  title.textContent = titleText;
  if (item.incident?.id) {
    // Build the path ONCE and reuse it. `title.href` resolves to the
    // absolute URL (e.g. "http://localhost:3000/incidencias/101"), which
    // would silently break the router — navigate('/...') concatenates
    // onto `window.location.hash` and the resulting hash never matches
    // `/incidencias/:id`, falling through to /not-found. The fix: keep
    // the raw path in a local and pass it directly to the router.
    const incidentPath = `/incidencias/${item.incident.id}`;
    title.href = incidentPath;
    title.dataset.navigate = '';
    title.addEventListener('click', (event) => {
      event.preventDefault();
      router.navigate(incidentPath);
    });
  }
  header.appendChild(title);

  // Type-specific meta line: who acted and what state changed. Keeps
  // each row's context answerable without opening the incident detail.
  const meta = buildMetaLine(item);
  if (meta) header.appendChild(meta);

  const time = document.createElement('time');
  time.className = 'notification-row__time';
  time.dateTime = item.created_at ?? '';
  time.textContent = timeAgo(item.created_at);
  header.appendChild(time);

  article.appendChild(header);

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  const approval = item.type === APPROVAL_TYPE;
  const decision = item.data?.decision ?? null;

  if (!item.read && !decision) {
    const markRead = document.createElement('button');
    markRead.className = 'gr-btn-outline mark-read';
    markRead.dataset.id = String(item.id);
    markRead.type = 'button';
    markRead.textContent = 'Marcar leída';
    actions.append(markRead);
  }

  if (approval && !decision) {
    const approve = document.createElement('button');
    approve.className = 'gr-btn-primary approve';
    approve.dataset.id = String(item.id);
    approve.type = 'button';
    approve.textContent = 'Aprobar';
    const reject = document.createElement('button');
    reject.className = 'gr-btn-outline reject';
    reject.dataset.id = String(item.id);
    reject.type = 'button';
    reject.textContent = 'Rechazar';
    actions.append(approve, reject);
  }

  if (decision) {
    const badge = document.createElement('span');
    badge.className = `gr-status notification-row__decision ${decisionBadgeClass(decision)}`;
    badge.textContent = decisionBadgeLabel(decision);
    actions.append(badge);
  }

  article.append(actions);

  // Post-decision context: reason (if rejection) and decided_at. The
  // .notification-row__body already holds the title + timeAgo of the
  // notification; this adds a third line specific to the decision itself
  // so next-shift admins can see *why* and *when* without an audit log.
  if (decision) {
    const decisionMeta = document.createElement('div');
    decisionMeta.className = 'notification-row__decision-meta';

    if (decision === 'rejected' && item.data?.rejection_reason) {
      const reason = document.createElement('p');
      reason.className = 'notification-row__reason';
      reason.textContent = `Motivo: ${item.data.rejection_reason}`;
      decisionMeta.appendChild(reason);
    }

    if (item.data?.decided_at) {
      const decided = document.createElement('time');
      decided.className = 'notification-row__decided-at';
      decided.dateTime = item.data.decided_at;
      decided.textContent = `Decidida ${timeAgo(item.data.decided_at)}`;
      decisionMeta.appendChild(decided);
    }

    if (decisionMeta.childElementCount > 0) {
      article.appendChild(decisionMeta);
    }
  }

  // Inline rejection form — present in the DOM but hidden. When the
  // admin clicks "Rechazar", the row transitions to state='rejecting',
  // this form becomes visible, and focus moves to the textarea.
  // Replaces the previous window.prompt() which had no validation, no
  // accessibility hooks, no display back to the user, and silently
  // no-op'd on empty Enter.
  if (approval && !decision) {
    const form = buildRejectForm(item);
    article.appendChild(form);
  }

  return article;
}

/**
 * Build the inline rejection form for one notification row.
 *
 * The form is appended to the row but starts hidden (data-state="normal"
 * on the article keeps it that way via CSS). The click handler on the
 * parent list is responsible for transitioning the row into the
 * 'rejecting' state.
 */
function buildRejectForm(item) {
  const form = document.createElement('div');
  form.className = 'notification-row__reject-form d-none';
  form.dataset.role = 'reject-form';
  form.dataset.id = String(item.id);

  const label = document.createElement('label');
  label.className = 'notification-row__reject-label';
  label.setAttribute('for', `reject-reason-${item.id}`);
  label.textContent = 'Motivo del rechazo (mínimo 3 caracteres)';

  const textarea = document.createElement('textarea');
  textarea.className = 'gr-textarea notification-row__reject-textarea';
  textarea.id = `reject-reason-${item.id}`;
  textarea.rows = 3;
  textarea.placeholder = 'Describe brevemente por qué se rechaza…';
  textarea.maxLength = 1000;
  textarea.dataset.role = 'reject-textarea';

  const toolbar = document.createElement('div');
  toolbar.className = 'notification-row__reject-toolbar';

  const cancel = document.createElement('button');
  cancel.className = 'gr-btn-outline reject-cancel';
  cancel.type = 'button';
  cancel.dataset.id = String(item.id);
  cancel.textContent = 'Cancelar';

  const confirm = document.createElement('button');
  confirm.className = 'gr-btn-primary reject-confirm';
  confirm.type = 'button';
  confirm.dataset.id = String(item.id);
  confirm.dataset.role = 'reject-confirm';
  confirm.textContent = 'Confirmar rechazo';
  confirm.disabled = true;

  toolbar.append(cancel, confirm);
  form.append(label, textarea, toolbar);

  // Live-validate: confirm enabled only when reason has ≥3 chars.
  textarea.addEventListener('input', () => {
    confirm.disabled = textarea.value.trim().length < 3;
  });

  // Esc cancels from anywhere in the form.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel.click();
    }
  });

  return form;
}

/**
 * Build the type-specific meta line that sits between the title and
 * the timestamp. Returns null when there's nothing useful to show, so
 * the row layout doesn't reserve empty space.
 *
 * Mapping:
 *   - claim → "Reclamada por {actor}" (whoever claimed it)
 *   - assignment → "Liberada por {actor}" (whoever released it)
 *   - status_change → "Estado: {resolved|pending|...}"
 *   - comment → "Comentario de {actor}"
 *   - incidencia_atendida_para_aprobacion → "Resuelta por {actor}"
 *   - legacy → null (no useful context)
 */
function buildMetaLine(item) {
  const actorName = item.actor?.name ?? 'Sistema';
  const type = item.type;
  const data = item.data ?? {};

  let label = null;
  if (type === 'claim') {
    label = `Reclamada por ${actorName}`;
  } else if (type === 'assignment') {
    label = `Liberada por ${actorName}`;
  } else if (type === 'status_change') {
    const status = data.status ?? '';
    if (status) {
      label = `Estado: ${humanizeStatus(status)}`;
    }
  } else if (type === 'comment') {
    label = `Comentario de ${actorName}`;
  } else if (type === 'incidencia_atendida_para_aprobacion') {
    label = `Resuelta por ${actorName}`;
  }

  if (!label) return null;

  const span = document.createElement('span');
  span.className = `notification-row__meta notification-row__meta--${typeClass(type)}`;
  span.textContent = label;
  return span;
}

function typeClass(type) {
  if (type === 'claim') return 'claim';
  if (type === 'assignment') return 'assignment';
  if (type === 'status_change') return 'status';
  if (type === 'comment') return 'comment';
  if (type === 'incidencia_atendida_para_aprobacion') return 'approval';
  return 'legacy';
}

function humanizeStatus(status) {
  // Mirrors the project's STATUS_LABEL from utils/format.js without
  // pulling the full module — keep the meta line tight and copy-local.
  const map = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    resolved: 'Resuelta',
    closed: 'Cerrada',
    rejected: 'Rechazada',
  };
  return map[status] ?? status;
}

function decisionBadgeClass(decision) {
  if (decision === 'approved') return 'gr-status--approved';
  if (decision === 'rejected') return 'gr-status--rejected';
  return 'gr-status--legacy';
}

function decisionBadgeLabel(decision) {
  if (decision === 'approved') return 'Aprobada';
  if (decision === 'rejected') return 'Rechazada';
  return decision;
}

function buildEmpty(message, modifier = 'muted') {
  const p = document.createElement('p');
  p.className = `text-${modifier}`;
  p.textContent = message;
  return p;
}

export default {
  template,
  style,
  async onInit() {
    const state = { notifications: [], filter: DEFAULT_FILTER };
    const list = document.getElementById('notificaciones-lista');
    const filter = document.getElementById('notificaciones-filtro');
    const pendingValue = document.getElementById(
      'notificaciones-pending-value',
    );

    const renderPending = () => {
      const pending = state.notifications.filter(
        (n) => n.type === APPROVAL_TYPE && !n.data?.decision,
      ).length;
      if (pendingValue) {
        pendingValue.textContent = String(pending);
        pendingValue.dataset.empty = pending === 0 ? 'true' : 'false';
      }
    };

    const render = () => {
      const rows = state.notifications.filter(
        (item) => !state.filter || item.type === state.filter,
      );
      list.replaceChildren(
        ...(rows.length
          ? rows.map(buildRow)
          : [buildEmpty('No hay notificaciones.')]),
      );
      renderPending();
    };

    try {
      const result = await notificationService.list({
        perPage: QUEUE_PAGE_SIZE,
      });
      state.notifications = result.data;
      render();
    } catch {
      list.replaceChildren(
        buildEmpty('No se pudieron cargar las notificaciones.', 'danger'),
      );
    }
    filter.addEventListener('change', () => {
      state.filter = filter.value;
      render();
    });

    /**
     * Keyboard nav — j/k or arrow down/up move focus between rows'
     * primary action. Triage queue UX: admins holding down the keyboard
     * can fly through 200 decisions without touching the mouse.
     *
     * Only fires when the active element is inside the row (so we don't
     * hijack global keys when the admin is typing the rejection reason
     * inside the inline form).
     */
    list.addEventListener('keydown', (event) => {
      // Don't hijack typing inside the form's textarea.
      if (event.target instanceof HTMLTextAreaElement) return;

      const key = event.key;
      const isDown = key === 'j' || key === 'ArrowDown';
      const isUp = key === 'k' || key === 'ArrowUp';
      if (!isDown && !isUp) return;

      event.preventDefault();
      const articles = Array.from(list.querySelectorAll('.notification-row'));
      if (articles.length === 0) return;

      const currentArticle = event.target.closest('.notification-row');
      const currentIndex = currentArticle
        ? articles.indexOf(currentArticle)
        : -1;
      const nextIndex = isDown
        ? Math.min(currentIndex + 1, articles.length - 1)
        : Math.max(currentIndex - 1, 0);
      const target = articles[nextIndex];

      const focusable = target.querySelector('button.approve, button.reject');
      if (focusable) focusable.focus();
    });

    list.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const item = state.notifications.find(
        (notification) => String(notification.id) === button.dataset.id,
      );
      if (!item) return;
      const article = button.closest('.notification-row');
      if (!article) return;

      try {
        // Approve: atomic, server validates type/decision/expires_at,
        // client updates local state and re-renders surgically.
        if (button.classList.contains('approve')) {
          await notificationService.approve(item.id);
          item.read = true;
          item.data = item.data ?? {};
          item.data.decision = 'approved';
          item.data.decided_at = new Date().toISOString();
          render();
          mostrarToast('Notificación aprobada.', 'success');
          focusNextDecisionButton(article);
          return;
        }

        // Reject: button toggles the row into 'rejecting' state and
        // hands focus to the textarea. Confirm fires from a second
        // click on the inline Confirm button.
        if (button.classList.contains('reject')) {
          enterRejecting(article, item);
          return;
        }

        if (button.classList.contains('reject-cancel')) {
          exitRejecting(article);
          return;
        }

        if (button.classList.contains('reject-confirm')) {
          const form = article.querySelector('.notification-row__reject-form');
          const textarea = form?.querySelector('textarea');
          const reason = textarea?.value?.trim() ?? '';
          if (reason.length < 3) {
            mostrarToast(
              'El motivo debe tener al menos 3 caracteres.',
              'danger',
            );
            textarea?.focus();
            return;
          }
          await notificationService.reject(item.id, reason);
          item.read = true;
          item.data = item.data ?? {};
          item.data.decision = 'rejected';
          item.data.rejection_reason = reason;
          // server stamps decided_at — capture the timestamp we'd compute
          // locally so the post-decision render can show 'hace N' without
          // waiting for a re-fetch. Slight skew vs server clock is fine.
          item.data.decided_at = new Date().toISOString();
          render();
          mostrarToast('Notificación rechazada.', 'success');
          focusNextDecisionButton(article);
          return;
        }

        if (button.classList.contains('mark-read')) {
          await notificationService.markRead(item.id);
          item.read = true;
          render();
          mostrarToast('Notificación marcada como leída.', 'success');
          return;
        }
      } catch {
        mostrarToast('No se pudo actualizar la notificación.', 'danger');
      }
    });

    /**
     * After a decision (approve or reject-confirm) move keyboard focus
     * to the next undecided row's primary action button — or to the
     * first such row if there is no current-row successor.
     *
     * Replaces the previous behaviour where render() rebuilt the list
     * and focus fell to <body>, forcing the admin to Tab from the top.
     * Triage 200 items now needs zero mouse movement.
     */
    function focusNextDecisionButton(article) {
      const articles = Array.from(list.querySelectorAll('.notification-row'));
      if (articles.length === 0) return;

      const previousIndex = articles.indexOf(article);
      const nextArticle =
        articles
          .slice(previousIndex + 1)
          .find((row) => row.dataset.state !== 'decided') ??
        articles.find((row) => row.dataset.state !== 'decided');

      const focusable = nextArticle?.querySelector(
        'button.approve, button.reject',
      );
      if (focusable) focusable.focus();
    }

    /**
     * Transition a row into 'rejecting' state: hide the action buttons
     * and show the inline form, then hand focus to the textarea.
     * Single source of truth for the state transition — both the
     * keyboard nav (future WU) and the click handler use this.
     */
    function enterRejecting(article, _item) {
      article.dataset.state = 'rejecting';
      const form = article.querySelector('.notification-row__reject-form');
      const actions = article.querySelector('.notification-actions');
      if (form) form.classList.remove('d-none');
      if (actions) actions.classList.add('d-none');
      const textarea = form?.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        textarea.focus();
      }
    }

    function exitRejecting(article) {
      article.dataset.state = 'normal';
      const form = article.querySelector('.notification-row__reject-form');
      const actions = article.querySelector('.notification-actions');
      if (form) form.classList.add('d-none');
      if (actions) actions.classList.remove('d-none');
      // Return focus to the "Rechazar" button so keyboard nav keeps working.
      const reject = article.querySelector('.reject');
      if (reject) reject.focus();
    }
  },
};

export { APPROVAL_TYPE };
