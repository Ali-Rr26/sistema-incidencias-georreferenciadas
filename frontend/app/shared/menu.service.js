import { http } from '../core/http.service.js';

/**
 * Servicio del menú dinámico del usuario autenticado.
 *
 * El backend expone GET /api/menus/my (App\Domains\Menus\Http\MenuController),
 * que filtra el árbol de menús según los permisos del rol del usuario y
 * devuelve la forma:
 *
 *   [
 *     { id, parent_id, name, route, icon, children: [
 *         { id, parent_id, name, route, icon, children: [...] },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 *
 * Los nodos con `route === null` son headers de sección (no son navegables,
 * solo agrupan hijos). El frontend los renderiza como títulos de sección y
 * los ignora como destinos de link.
 *
 * Caché en memoria: la respuesta se cachea después del primer fetch exitoso
 * dentro de la misma sesión. Si el rol/permisos del usuario cambian, hay
 * que llamar a `clearCache()` antes de la próxima lectura.
 */

let _cache = null;
let _inflight = null;

export const menuService = {
  /**
   * Devuelve el árbol de menús del usuario autenticado.
   * Reutiliza caché si está disponible.
   */
  async getMyMenu() {
    if (_cache) return _cache;
    if (_inflight) return _inflight;

    _inflight = http
      .get('/menus/my')
      .then((resp) => {
        if (Array.isArray(resp?.data)) {
          _cache = resp.data;
        } else if (Array.isArray(resp)) {
          _cache = resp;
        } else {
          _cache = [];
        }
        return _cache;
      })
      .finally(() => {
        _inflight = null;
      });

    return _inflight;
  },

  /**
   * Limpia la caché. Llamar después de logout o cambios de permisos.
   */
  clearCache() {
    _cache = null;
    _inflight = null;
  },
};