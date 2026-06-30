/**
 * Role Guard — factory que crea guards de rol (canActivate).
 *
 * Uso:
 *   import { roleGuard } from './auth/role.guard.js';
 *   router.addRoute('/dashboard', dashboard, [roleGuard(['admin_sistema', 'admin_organizacion'])], true);
 *
 * Redirige a #/login si no hay sesión, o a #/feed si el rol no está permitido.
 * El rol se obtiene del UserResource como { id, name } — accede a name.
 */
import { auth } from './auth.service.js';

/**
 * Extrae el nombre del rol desde user, manejando tanto
 * `{ id, name }` como string plano por si el formato cambia.
 */
function resolveRoleName(user) {
  if (!user?.role) return null;
  if (typeof user.role === 'string') return user.role;
  if (typeof user.role === 'object' && user.role?.name) return user.role.name;
  return null;
}

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
