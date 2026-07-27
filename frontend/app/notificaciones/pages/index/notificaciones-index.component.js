import template from './notificaciones-index.component.html?raw';
import { notificationService } from '../../../shared/notification.service.js';
import { mostrarToast } from '../../../utils/ui.js';

const APPROVAL_TYPE = 'incidencia_atendida_para_aprobacion';

export default {
  template,
  async onInit() {
    const state = { notifications: [], filter: APPROVAL_TYPE };
    const list = document.getElementById('notificaciones-lista');
    const filter = document.getElementById('notificaciones-filtro');

    const render = () => {
      const rows = state.notifications.filter((item) => !state.filter || item.type === state.filter);
      list.innerHTML = rows.length ? rows.map((item) => {
        const approval = item.type === APPROVAL_TYPE;
        const decision = item.data?.decision;
        return `<article class="notification-row ${item.read ? 'is-read' : 'is-unread'}" data-id="${item.id}">
          <div><strong>${item.message ?? 'Notificación'}</strong><small>${item.created_at ?? ''}</small></div>
          <div class="notification-actions">
            ${!item.read ? `<button class="gr-btn-outline mark-read" data-id="${item.id}">Marcar leída</button>` : ''}
            ${approval && !decision ? `<button class="gr-btn-primary approve" data-id="${item.id}">Aprobar</button><button class="gr-btn-outline reject" data-id="${item.id}">Rechazar</button>` : ''}
            ${decision ? `<span class="badge bg-secondary">${decision}</span>` : ''}
          </div>
        </article>`;
      }).join('') : '<p class="text-muted">No hay notificaciones.</p>';
    };

    try {
      const result = await notificationService.list({ perPage: 50 });
      state.notifications = result.data;
      render();
    } catch {
      list.innerHTML = '<p class="text-danger">No se pudieron cargar las notificaciones.</p>';
    }

    filter.addEventListener('change', () => { state.filter = filter.value; render(); });
    list.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const item = state.notifications.find((notification) => String(notification.id) === button.dataset.id);
      if (!item) return;
      try {
        if (button.classList.contains('approve')) await notificationService.approve(item.id);
        if (button.classList.contains('reject')) {
          const reason = window.prompt('Motivo del rechazo');
          if (!reason) return;
          await notificationService.reject(item.id, reason);
        }
        if (button.classList.contains('mark-read')) await notificationService.markRead(item.id);
        item.read = true;
        if (button.classList.contains('approve')) item.data.decision = 'approved';
        if (button.classList.contains('reject')) item.data.decision = 'rejected';
        render();
        mostrarToast('Notificación actualizada.', 'success');
      } catch {
        mostrarToast('No se pudo actualizar la notificación.', 'danger');
      }
    });
  },
};

export { APPROVAL_TYPE };
