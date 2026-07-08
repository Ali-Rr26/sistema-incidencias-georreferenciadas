import { http } from '../core/http.service.js';

/**
 * Servicio de notificaciones del usuario autenticado.
 *
 * Endpoints:
 *  - GET    /api/notifications               → lista paginada
 *  - GET    /api/notifications/unread-count  → solo conteo de no leídas
 *  - PATCH  /api/notifications/{id}/read     → marcar una como leída
 *  - PATCH  /api/notifications/read-all      → marcar todas como leídas
 *
 * Cachea el `unread_count` en memoria (se invalida con `clearCache()`).
 */

let _unreadCache = null;
let _inflightUnread = null;

export const notificationService = {
  /**
   * Devuelve la lista paginada de notificaciones del usuario autenticado.
   */
  async list({ page = 1, perPage = 20, unreadOnly = false } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (unreadOnly) params.set('unread_only', '1');

    const resp = await http.get('/notifications?' + params.toString());
    return {
      data: resp.data ?? [],
      meta: resp.meta ?? null,
      unreadCount: resp.unread_count ?? 0,
    };
  },

  /**
   * Devuelve solo el conteo de no leídas (badge del header).
   */
  async unreadCount({ force = false } = {}) {
    if (!force && _unreadCache !== null) return _unreadCache;
    if (_inflightUnread) return _inflightUnread;

    _inflightUnread = http
      .get('/notifications/unread-count')
      .then((resp) => {
        _unreadCache = resp.unread_count ?? 0;
        return _unreadCache;
      })
      .finally(() => {
        _inflightUnread = null;
      });

    return _inflightUnread;
  },

  /**
   * Marca una notificación como leída (solo si sos el dueño).
   */
  async markRead(id) {
    const resp = await http.patch(`/notifications/${id}/read`);
    // Invalidar caché de unread count
    _unreadCache = null;
    return resp.data ?? resp ?? null;
  },

  /**
   * Marca todas las notificaciones del usuario como leídas.
   */
  async markAllRead() {
    const resp = await http.patch('/notifications/read-all');
    _unreadCache = 0;
    return resp;
  },

  /**
   * Invalida la caché (logout, rol changed, etc.).
   */
  clearCache() {
    _unreadCache = null;
    _inflightUnread = null;
  },
};
