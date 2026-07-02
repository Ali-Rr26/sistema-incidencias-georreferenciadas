/**
 * Shared role / permission helpers used across the admin shell.
 *
 * Single-source helpers extracted from:
 *   - `auth/role.guard.js`        (resolveRoleName)
 *   - `layout/layout.component.js` (ROLE_LABELS, originally at line 123)
 *
 * `ROLE_LABELS` keys mirror the role names returned by the `UserResource`
 * (`{ id, name }` shape) — see `App\Domains\Roles\Enums\UserRole`.
 */

/**
 * Extract the role name from a user object, handling both
 * `{ role: { id, name } }` and `{ role: 'admin_sistema' }` payloads.
 *
 * Returns `null` when the user has no role or the shape is unrecognised.
 */
export function resolveRoleName(user) {
  if (!user?.role) return null;
  if (typeof user.role === 'string') return user.role;
  if (typeof user.role === 'object' && user.role?.name) return user.role.name;
  return null;
}

/**
 * Map from role name keys to Spanish display labels.
 */
export const ROLE_LABELS = Object.freeze({
  admin_sistema: 'Super Administrador',
  admin_organizacion: 'Administrador de Organización',
  operador_organizacion: 'Operador de Organización',
  publicador: 'Publicador',
  usuario: 'Usuario',
  operador_sistema: 'Operador de Sistema',
});
