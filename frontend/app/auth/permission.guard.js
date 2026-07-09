/**
 * Permission Guard — sources route authorization from menuService
 * so the sidebar and the router share exactly ONE source of truth.
 *
 * On a miss the guard calls `router.navigate('/not-found')` so the
 * route's existence is not leaked (a citizen who types a guessed
 * admin URL sees a generic 404, never a permissions error that would
 * tell them the URL was real).
 *
 * Usage:
 *   import { permissionGuard } from './auth/permission.guard.js';
 *   router.addRoute('/usuarios', usuariosComponent, [permissionGuard], 'admin');
 *
 * Replaces the older `roleGuard(['admin_sistema'])` pattern used on
 * /roles — role names are not hardcoded here; allowed routes are
 * derived from the user's menu tree.
 */
import { router } from '../core/router.js';
import { menuService } from '../shared/menu.service.js';

/**
 * @param {{ params?: Record<string,string>, query?: URLSearchParams, role?: string }} _ctx
 * @returns {Promise<boolean>}
 */
export const permissionGuard = {
  async canActivate(_ctx) {
    const requestedPath = window.location.hash.slice(1) || '/';
    const tree = await menuService.getMyMenu();
    const allowed = flattenRoutes(tree);

    if (!allowed.has(requestedPath)) {
      router.navigate('/not-found');
      return false;
    }
    return true;
  },
};

/**
 * Walks the menu tree (recursive children) and returns a Set of every
 * non-null route string. Section headers have `route === null` — they
 * group children but are not destinations themselves, so we skip them.
 *
 * Mirrors how the sidebar renders leaves (`/usuarios` is reachable
 * only when its menu node has a non-null route and lives somewhere
 * in the tree, however deep).
 *
 * @param {Array<{route: ?string, children?: Array}>|null|undefined} nodes
 * @returns {Set<string>}
 */
function flattenRoutes(nodes) {
  const set = new Set();
  const walk = (list) => {
    if (!Array.isArray(list)) return;
    for (const n of list) {
      if (typeof n.route === 'string' && n.route.length > 0) {
        set.add(n.route);
      }
      if (Array.isArray(n.children)) {
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return set;
}
