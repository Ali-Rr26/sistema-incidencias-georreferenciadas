/**
 * Role Guard — factory que crea guards de rol (canActivate).
 *
 * Uso:
 *   import { roleGuard } from './auth/role.guard.js';
 *   router.addRoute('/dashboard', dashboard, [roleGuard(['admin_sistema', 'admin_organizacion'])], true);
 *
 * Redirige a #/login si no hay sesión, o a #/feed si el rol no está permitido.
 * El rol se obtiene del UserResource como { id, name } — accede a name.
 *
 * ── DEPRECATION NOTICE (consolidar-layout-unico PR #2/3) ──────────────
 *
 * The role-tag-based API (`router.setCurrentUserRole()` + the 5th `role`
 * arg of `addRoute`) is the new canonical way to enforce role gating.
 * This per-route guard factory is kept in PR #2 for backward compatibility
 * because several call sites still pass `roleGuard(...)` to `addRoute`.
 *
 * PR #3 (final consolidation) will migrate every route off this API and
 * remove `roleGuard` entirely. Until then, both APIs coexist:
 *   - roleGuard([...]) still works for the existing 14 routes.
 *   - addRoute(pattern, comp, guards, shell, role) is the new preferred
 *     shape for any NEW route added in PR #2 or later.
 *
 * When both are set on a route, roleGuard runs first (as part of `guards`)
 * and only roles it allows reach the role-mismatch check. If you add the
 * new `role` tag to a route that already has `roleGuard`, the two policies
 * are effectively AND-ed.
 */
import { auth } from './auth.service.js';
import { resolveRoleName } from '../utils/role.js';

// eslint-disable-next-line no-console
console.warn(
  '[DEPRECATION] auth/role.guard.js → roleGuard() is being phased out as part ' +
    'of consolidar-layout-unico. New routes should use addRoute(..., shell, role) ' +
    'with router.setCurrentUserRole() instead. Full removal in PR #3.',
);

export function roleGuard(allowedRoles) {
  return {
    async canActivate() {
      if (!auth.isAuthenticated()) {
        window.location.hash = '#/login';
        return false;
      }

      let user = auth.getUser();
      if (!user) {
        try {
          user = await auth.me();
        } catch {
          window.location.hash = '#/login';
          return false;
        }
      }

      const roleName = resolveRoleName(user);
      if (!roleName || !allowedRoles.includes(roleName)) {
        window.location.hash = '#/feed';
        return false;
      }

      return true;
    },
  };
}
