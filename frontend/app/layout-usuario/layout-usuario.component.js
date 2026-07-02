/**
 * Layout Usuario — mobile citizen shell with header + bottom nav,
 * and desktop navigation menu.
 *
 * Header: shows logo + navigation (desktop) + bell + avatar (auth) or login button (public).
 * Bottom nav: 5 items with active state and auth-guarded "+" button (mobile).
 * Content mounted in #shell-content by the router.
 */
import { defineComponent } from '../utils/component.js';
import { auth } from '../auth/auth.service.js';

let _unsubAuth = null;

function setupHeader() {
  const loginBtn = document.getElementById('lu-login-btn');
  const bellWrap = document.getElementById('lu-bell-wrap');
  const avatarWrap = document.getElementById('lu-avatar-wrap');
  const avatarEl = document.getElementById('lu-avatar');
  const sidebarAvatar = document.getElementById('lu-sidebar-avatar');
  const sidebarUserName = document.getElementById('lu-sidebar-user-name');
  const sidebarUserRole = document.getElementById('lu-sidebar-user-role');

  if (auth.isAuthenticated()) {
    const user = auth.getUser();
    if (loginBtn) loginBtn.style.display = 'none';
    if (bellWrap) bellWrap.classList.remove('d-none');
    if (avatarWrap) avatarWrap.classList.remove('d-none');

    if (avatarEl && user) {
      const initial = (user.first_name || user.email || '?')[0].toUpperCase();
      avatarEl.textContent = initial;
    }

    // Sidebar user info
    if (sidebarAvatar) {
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

  // Set initial active state based on current route
  const currentPath = window.location.hash.slice(1) || '/';
  navItems.forEach((item) => {
    const route = item.dataset.route;
    if (route && currentPath.startsWith(route)) {
      syncActiveState(route);
    }
  });
}

export default defineComponent({
  templateUrl: 'app/layout-usuario/layout-usuario.component.html',

  async onInit() {
    // Setup header based on auth
    setupHeader();

    // Listen for auth changes (login/logout)
    _unsubAuth = auth.onAuthChange(() => setupHeader());

    // Setup nav actions
    setupNav();
  },

  onDestroy() {
    if (_unsubAuth) _unsubAuth();
  },
});
