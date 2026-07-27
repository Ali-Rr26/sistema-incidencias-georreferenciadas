import template from './notificaciones-index.component.html?raw';
import { notificationService } from '../../../shared/notification.service.js';
import { mostrarToast } from '../../../utils/ui.js';

const APPROVAL_TYPE = 'incidencia_atendida_para_aprobacion';
// Per-page cap for the admin approval queue. 200 is large enough for the
// realistic worst case (one admin × many pending approvals in a busy org)
// while still bounding response size. Per-CodeRabbit feedback on PR #227.
const QUEUE_PAGE_SIZE = 200;

/**
 * Build one notification <article> using DOM APIs (textContent /
 * setAttribute) so interpolated fields like `message`, `created_at`,
 * `id`, and `decision` cannot become stored XSS via the rendering layer.
 *
 * Previously this component interpolated the same values directly into an
 * `innerHTML` template literal, which is unsafe for any user-controlled
 * source — including the `message` field, which is derived from the
 * incident title authored by another user.
 */
function buildRow(item) {
  const article = document.createElement('article');
  article.className = `notification-row ${item.read ? 'is-read' : 'is-unread'}`;
  article.dataset.id = String(item.id);

  const header = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = item.message ?? 'Notificación';
  const small = document.createElement('small');
  small.textContent = item.created_at ?? '';
  header.append(strong, small);
  article.append(header);

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  const approval = item.type === APPROVAL_TYPE;
  const decision = item.data?.decision ?? null;

  if (!item.read) {
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
    badge.className = 'badge bg-secondary';
    badge.textContent = decision;
    actions.append(badge);
  }

  article.append(actions);
  return article;
}

function buildEmpty(message, modifier = 'muted') {
  const p = document.createElement('p');
  p.className = `text-${modifier}`;
  p.textContent = message;
  return p;
}

export default {
  template,
  async onInit() {
    const state = { notifications: [], filter: APPROVAL_TYPE };
    const list = document.getElementById('notificaciones-lista');
    const filter = document.getElementById('notificaciones-filtro');

    const render = () => {
      const rows = state.notifications.filter(
        (item) => !state.filter || item.type === state.filter,
      );
      list.replaceChildren(
        ...(rows.length
          ? rows.map(buildRow)
          : [buildEmpty('No hay notificaciones.')]),
      );
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
    list.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const item = state.notifications.find(
        (notification) => String(notification.id) === button.dataset.id,
      );
      if (!item) return;
      try {
        if (button.classList.contains('approve'))
          await notificationService.approve(item.id);
        if (button.classList.contains('reject')) {
          const reason = window.prompt('Motivo del rechazo');
          if (!reason) return;
          await notificationService.reject(item.id, reason);
        }
        if (button.classList.contains('mark-read'))
          await notificationService.markRead(item.id);
        item.read = true;
        // Guard item.data before mutating it: the API update succeeded but
        // the client-side cache may still hold a null data bag from older
        // notifications created before this PR. Initialising here keeps
        // the UI in sync without re-fetching.
        item.data = item.data ?? {};
        if (button.classList.contains('approve'))
          item.data.decision = 'approved';
        if (button.classList.contains('reject'))
          item.data.decision = 'rejected';
        render();
        mostrarToast('Notificación actualizada.', 'success');
      } catch {
        mostrarToast('No se pudo actualizar la notificación.', 'danger');
      }
    });
  },
};

export { APPROVAL_TYPE };
