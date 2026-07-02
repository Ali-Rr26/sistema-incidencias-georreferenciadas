/**
 * User shell — Instagram-style citizen layout.
 *
 * Layout:
 *   - Top header (always visible): logo, notification bell, avatar, login button
 *   - Desktop sidebar (≥md): logo + 5 nav items + user info at bottom
 *   - Mobile bottom nav (<md): 5 items
 *   - Page content rendered inside #shell-content
 *
 * Outlet: #shell-content
 * Mounted once per session; init runs once after first auth route activates.
 */
import { auth } from '../auth/auth.service.js';

const TEMPLATE_URL = 'app/layout-usuario/layout-usuario.component.html';

let _unsubAuth = null;

export const userShell = {
  templateUrl: TEMPLATE_URL,

  async mount() {
    const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(
        `Failed to load user shell template: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const outlet = document.getElementById('shell-outlet');
    if (!outlet) {
      throw new Error('userShell.mount: #shell-outlet not found in DOM');
    }

    outlet.innerHTML = html;
  },

  async init() {
    await setupHeader();

    // Listen for auth changes (login/logout)
    _unsubAuth = auth.onAuthChange(() => setupHeader());

    setupNav();
  },

  destroy() {
    if (_unsubAuth) _unsubAuth();
  },

  outlet: '#shell-content',

  updateActive(path) {
    updateUserNavActive(path);
  },
};

async function setupHeader() {
  const loginBtn = document.getElementById('lu-login-btn');
  const bellWrap = document.getElementById('lu-bell-wrap');
  const avatarWrap = document.getElementById('lu-avatar-wrap');
  const avatarEl = document.getElementById('lu-avatar');
  const sidebarAvatar = document.getElementById('lu-sidebar-avatar');
  const sidebarUserName = document.getElementById('lu-sidebar-user-name');
  const sidebarUserRole = document.getElementById('lu-sidebar-user-role');

  if (auth.isAuthenticated()) {
    let user = auth.getUser();
    if (!user) {
      // Try to fetch user data if cache is empty (e.g. session restored via cookie)
      try {
        user = await auth.me();
      } catch {
        return; // can't render header without user data
      }
    }

    if (loginBtn) loginBtn.style.display = 'none';
    if (bellWrap) bellWrap.classList.remove('d-none');
    if (avatarWrap) avatarWrap.classList.remove('d-none');

    if (avatarEl && user) {
      const initial = (user.first_name || user.email || '?')[0].toUpperCase();
      avatarEl.textContent = initial;
    }

    // Sidebar user info
    if (sidebarAvatar && user) {
      sidebarAvatar.textContent = (user.first_name ||
        user.email ||
        '?')[0].toUpperCase();
    }
    if (sidebarUserName && user) {
      sidebarUserName.textContent = user.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user.email;
    }
    if (sidebarUserRole && user?.role?.name) {
      sidebarUserRole.textContent = user.role.name.replace(/_/g, ' ');
    }
  } else {
    if (loginBtn) loginBtn.style.display = '';
    if (bellWrap) bellWrap.classList.add('d-none');
    if (avatarWrap) avatarWrap.classList.add('d-none');
  }
}

function syncActiveState(targetRoute) {
  // Update active class on both mobile bottom nav and desktop sidebar
  document
    .querySelectorAll('#lu-bottom-nav .lu-nav-item, .lu-sidebar-item')
    .forEach((i) => {
      if (
        !i.classList.contains('lu-nav-plus') &&
        !i.classList.contains('lu-sidebar-plus')
      ) {
        const isSame = i.dataset.route === targetRoute;
        i.classList.toggle('active', isSame);
      }
    });
}

function setupNav() {
  // Bottom nav (mobile) + sidebar (desktop)
  const navItems = document.querySelectorAll(
    '#lu-bottom-nav .lu-nav-item, .lu-sidebar-item',
  );

  navItems.forEach((item) => {
    // Plus button — redirects to creation if authenticated
    if (
      item.classList.contains('lu-nav-plus') ||
      item.classList.contains('lu-sidebar-plus')
    ) {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        if (auth.isAuthenticated()) {
          window.location.hash = '#/feed/crear';
        } else {
          window.location.hash = '#/login';
        }
      });
      return;
    }

    // Regular nav items — update active state on click and navigate
    item.addEventListener('click', () => {
      const targetRoute = item.dataset.route;
      if (targetRoute) {
        window.location.hash = `#${targetRoute}`;
      }
      syncActiveState(targetRoute);
    });
  });
}

/**
 * Update active state of user shell nav based on current path.
 * Called by router after each shell route resolves.
 */
export function updateUserNavActive(path) {
  syncActiveState(path);
}
