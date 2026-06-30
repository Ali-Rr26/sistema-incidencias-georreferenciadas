/**
 * Layout Usuario — mobile citizen shell with header + bottom nav.
 *
 * Header: shows logo + bell + avatar (auth) or login button (public).
 * Bottom nav: 5 items with active state and auth-guarded "+" button.
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

  if (auth.isAuthenticated()) {
    const user = auth.getUser();
    if (loginBtn) loginBtn.style.display = 'none';
    if (bellWrap) bellWrap.classList.remove('d-none');
    if (avatarWrap) avatarWrap.classList.remove('d-none');

    if (avatarEl && user) {
      const initial = (user.first_name || user.email || '?')[0].toUpperCase();
      avatarEl.textContent = initial;
    }
  } else {
    if (loginBtn) loginBtn.style.display = '';
    if (bellWrap) bellWrap.classList.add('d-none');
    if (avatarWrap) avatarWrap.classList.add('d-none');
  }
}

function setupBottomNav() {
  const items = document.querySelectorAll('#lu-bottom-nav .lu-nav-item');

  items.forEach((item) => {
    // Skip the "+" button — no nav route
    if (item.classList.contains('lu-nav-plus')) {
      item.addEventListener('click', (_e) => {
        if (auth.isAuthenticated()) {
          window.location.hash = '#/feed/crear';
        } else {
          window.location.hash = '#/login';
        }
      });
      return;
    }

    // Regular nav items — update active state on click
    item.addEventListener('click', () => {
      items.forEach((i) => {
        if (!i.classList.contains('lu-nav-plus')) {
          i.classList.remove('active');
        }
      });
      item.classList.add('active');
    });
  });

  // Set initial active state based on current route
  const currentPath = window.location.hash.slice(1) || '/';
  items.forEach((item) => {
    const route = item.dataset.route;
    if (route && currentPath.startsWith(route)) {
      items.forEach((i) => {
        if (!i.classList.contains('lu-nav-plus')) {
          i.classList.remove('active');
        }
      });
      item.classList.add('active');
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

    // Setup bottom nav
    setupBottomNav();
  },

  onDestroy() {
    if (_unsubAuth) _unsubAuth();
  },
});
