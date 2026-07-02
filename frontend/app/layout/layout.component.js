import { initShell } from '../utils/layout.js';
import { ROLE_LABELS, resolveRoleName } from '../utils/role.js';
import { auth } from '../auth/auth.service.js';
import { router } from '../core/router.js';

const TEMPLATE_URL = 'app/layout/layout.component.html';

/**
 * Admin shell — back-office layout with top navbar + collapsible sidebar.
 *
 * Outlet: #page-outlet (mounted inside the persistent #main-wrapper).
 * Mounted once per session; init runs once after first auth route activates.
 */
export const adminShell = {
  templateUrl: TEMPLATE_URL,

  async mount() {
    const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(
        `Failed to load admin shell template: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const outlet = document.getElementById('shell-outlet');
    if (!outlet) {
      throw new Error('adminShell.mount: #shell-outlet not found in DOM');
    }

    outlet.innerHTML = html;
  },

  async init() {
    initShell();
    await populateUserInfo();
    wireLogout();
  },

  outlet: '#page-outlet',

  updateActive(path) {
    updateAdminNavActive(path);
  },
};

/**
 * @deprecated Backwards-compat shim. Kept so app.js (and tests) can keep
 * calling mountLayout() before router.init(). Returns once the shell template
 * is in the DOM. Use adminShell.mount() directly in new code.
 */
export async function mountLayout() {
  await adminShell.mount();
}

/**
 * @deprecated Backwards-compat alias for the legacy setShellInitFn() flow.
 * Use adminShell.init() in new code.
 */
export async function shellInitFn() {
  await adminShell.init();
}

/**
 * Update sidebar active state based on current path. Called by router after
 * each shell route resolves.
 */
export function updateAdminNavActive(path) {
  document.querySelectorAll('#sidebarnav .sidebar-item').forEach((li) => {
    const a = li.querySelector(':scope > a.sidebar-link');
    if (!a) return;
    const href = a.getAttribute('href');
    const active = href === `#${path}`;
    li.classList.toggle('selected', active);
  });
}

// ─── Internal helpers ────────────────────────────────────────────────

async function populateUserInfo() {
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

    // Apply sidebar visibility based on role
    applySidebarByRole(user);
  } catch {
    /* keep defaults */
  }
}

function wireLogout() {
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

function getRoleDisplayName(roleName) {
  return ROLE_LABELS[roleName] || roleName;
}

function applySidebarByRole(user) {
  const roleName = resolveRoleName(user);
  if (!roleName) return;

  // 1. Items with data-roles attribute — shown only if role is in the list
  document.querySelectorAll('#sidebarnav [data-roles]').forEach((el) => {
    const allowed = el.dataset.roles.split(',');
    el.style.display = allowed.includes(roleName) ? '' : 'none';
  });

  // 2. Section headers with .sidebar-admin-only — shown only for admins
  const isAdmin = ['admin_sistema', 'admin_organizacion'].includes(roleName);
  document.querySelectorAll('#sidebarnav .sidebar-admin-only').forEach((el) => {
    el.style.display = isAdmin ? '' : 'none';
  });
}