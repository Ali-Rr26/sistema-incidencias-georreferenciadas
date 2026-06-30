import { initShell } from '../utils/layout.js';
import { auth } from '../auth/auth.service.js';
import { router } from '../core/router.js';

const TEMPLATE_URL = 'app/layout/layout.component.html';

/**
 * mountLayout — fetches the app shell template and injects it into #shell-outlet.
 * Must be called before router.init() so #page-outlet exists in the DOM.
 */
export async function mountLayout() {
  const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      `Failed to load layout template: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  const outlet = document.getElementById('shell-outlet');
  if (!outlet) {
    throw new Error('mountLayout: #shell-outlet not found in DOM');
  }

  outlet.innerHTML = html;
  initShell();
}

/**
 * shellInitFn — paints user data and wires logout handlers once the shell is shown.
 * Called by the router after the first authenticated route is activated.
 */
export async function shellInitFn() {
  try {
    const user = await auth.me();
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const roleEl = document.getElementById('user-role-label');
    if (nameEl)
      nameEl.textContent =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    if (avatarEl)
      avatarEl.textContent = (user.first_name || user.email)[0].toUpperCase();
    if (roleEl) {
      const roleName = resolveRoleName(user);
      roleEl.textContent = roleName ? getRoleDisplayName(roleName) : 'Usuario';
    }

    // Aplicar visibilidad del sidebar según el rol
    applySidebarByRole(user);
  } catch {
    /* keep defaults */
  }

  const logout = async () => {
    await auth.logout();
    router.resetShell();
    window.location.hash = '#/login';
  };

  document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
  document.getElementById('logout-sidebar')?.addEventListener('click', logout);
}

/**
 * Extrae el nombre del rol desde user, manejando
 * { id, name } y string plano.
 */
function resolveRoleName(user) {
  if (!user?.role) return null;
  if (typeof user.role === 'string') return user.role;
  if (typeof user.role === 'object' && user.role?.name) return user.role.name;
  return null;
}

/**
 * Mapa de nombre de rol → etiqueta legible en español.
 */
const ROLE_LABELS = {
  admin_sistema: 'Super Administrador',
  admin_organizacion: 'Administrador de Organización',
  operador_organizacion: 'Operador de Organización',
  publicador: 'Publicador',
  usuario: 'Usuario',
  operador_sistema: 'Operador de Sistema',
};

function getRoleDisplayName(roleName) {
  return ROLE_LABELS[roleName] || roleName;
}

/**
 * Aplica visibilidad condicional en el sidebar según el rol del usuario.
 * Los elementos con data-roles="..." se muestran solo si el rol está en la lista.
 * Los elementos con clase .sidebar-admin-only se muestran solo para roles admin.
 */
function applySidebarByRole(user) {
  const roleName = resolveRoleName(user);
  if (!roleName) return;

  // 1. Elementos con data-roles
  document.querySelectorAll('#sidebarnav [data-roles]').forEach((el) => {
    const allowed = el.dataset.roles.split(',');
    el.style.display = allowed.includes(roleName) ? '' : 'none';
  });

  // 2. Section headers con .sidebar-admin-only
  const isAdmin = ['admin_sistema', 'admin_organizacion'].includes(roleName);
  document.querySelectorAll('#sidebarnav .sidebar-admin-only').forEach((el) => {
    el.style.display = isAdmin ? '' : 'none';
  });
}
