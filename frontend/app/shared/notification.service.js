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
 * No cachea el unread count — siempre pide fresco al backend.
 * La latencia típica (~5ms en LAN) es irrelevante para un badge y
 * elimina la complejidad de invalidar caché manualmente.
 */

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
   * Siempre pide fresco al backend — no usa caché.
   */
  async unreadCount() {
    const resp = await http.get('/notifications/unread-count');
    return resp.unread_count ?? 0;
  },

  /**
   * Marca una notificación como leída (solo si sos el dueño).
   */
  async markRead(id) {
    const resp = await http.patch(`/notifications/${id}/read`);
    return resp.data ?? resp ?? null;
  },

  /**
   * Marca todas las notificaciones del usuario como leídas.
   */
  async markAllRead() {
    return await http.patch('/notifications/read-all');
  },

  /**
   * Devuelve las notificaciones pendientes de aprobación (tipo incident_pending_approval).
   * Solo para roles admin (admin_sistema, admin_organizacion).
   */
  async getPendingApprovals({ page = 1, perPage = 20, organizationId = null } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (organizationId) params.set('organization_id', String(organizationId));

    const resp = await http.get('/notifications/pending-approvals?' + params.toString());
    return {
      data: resp.data ?? [],
      meta: resp.meta ?? null,
    };
  },

  /**
   * Aprueba una incidencia pendiente (marca la notificación como aprobada).
   */
  async approve(id) {
    const resp = await http.post(`/notifications/${id}/approve`);
    return resp.data ?? resp ?? null;
  },

  /**
   * Rechaza una incidencia pendiente con motivo.
   */
  async reject(id, reason) {
    const resp = await http.post(`/notifications/${id}/reject`, { reason });
    return resp.data ?? resp ?? null;
  },
};
