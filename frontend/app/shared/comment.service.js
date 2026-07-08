import { http } from '../core/http.service.js';

/**
 * Servicio de comentarios públicos de una incidencia.
 *
 * Endpoints (shallow nested resource — see backend/routes/api.php):
 *  - GET    /api/incidents/{incident}/comments  → lista paginada
 *  - POST   /api/incidents/{incident}/comments  → crear comentario
 *
 * Shared by the operator detail view (incidencias.detail) and the
 * citizen detail view (feed-detail) so both stay in sync with the same
 * request/response shape.
 */
export const commentService = {
  /**
   * Devuelve la lista paginada de comentarios de una incidencia.
   */
  async list(incidentId, { page = 1, perPage = 20 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    const resp = await http.get(
      `/incidents/${incidentId}/comments?${params.toString()}`,
    );
    return {
      data: resp.data ?? [],
      meta: resp.meta ?? null,
    };
  },

  /**
   * Publica un nuevo comentario en la incidencia.
   */
  async create(incidentId, message) {
    const resp = await http.post(`/incidents/${incidentId}/comments`, {
      message,
    });
    return resp.data ?? resp;
  },
};
