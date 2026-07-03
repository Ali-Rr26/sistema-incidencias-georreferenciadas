/**
 * appShell — unified responsive layout shell (PR #1 of consolidar-layout-unico).
 *
 * Replaces the previous dual-shell model (adminShell + userShell) with a single
 * CSS-grid layout that adapts to the user's role:
 *
 *   - admin (admin_sistema | admin_organizacion): back-office chrome with
 *     full sidebar nav, search bar in header, user menu dropdown.
 *   - citizen (any other authenticated role): simpler header (bell + avatar),
 *     flat 4-item sidebar, "+" plus button as the 3rd bottom-nav slot.
 *   - guest (no auth): login button instead of avatar.
 *
 * Role is exposed as a body[data-role] attribute and consumed by CSS rules
 * keyed on `[data-show-on-role="..."]`. No JS resize listeners — the browser
 * handles all breakpoint work via media queries.
 *
 * Wiring: registered with the router under shell name 'app' (PR #2). Until
 * then the shell is fully self-contained and can be mounted manually for
 * visual QA.
 */
import { auth } from '../auth/auth.service.js';
import { resolveRoleName } from '../utils/role.js';

const TEMPLATE_URL = 'app/app-shell/app-shell.component.html';

let _unsubAuth = null;

/**
 * Classify a user object into one of the three shell role buckets.
 * Public for tests + future role-guard helpers.
 */
export function classifyRole(user) {
  if (!user) return 'guest';
  const roleName = resolveRoleName(user);
  if (roleName === 'admin_sistema' || roleName === 'admin_organizacion') {
    return 'admin';
  }
  return 'citizen';
}

export const appShell = {
  templateUrl: TEMPLATE_URL,

  async mount() {
    const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(
        `Failed to load appShell template: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const outlet = document.getElementById('shell-outlet');
    if (!outlet) {
      throw new Error('appShell.mount: #shell-outlet not found in DOM');
    }

    outlet.innerHTML = html;
  },

  async init() {
    // Apply role attribute on <body> so CSS can toggle chrome regions.
    // SECURITY: fetch role fresh from /me — never trust cached user state.
    const user = await auth.me().catch(() => null);
    document.body.dataset.role = classifyRole(user);

    await populateHeader();
    wireNav();

    // Re-apply role on every auth change (login / logout / role swap).
    _unsubAuth = auth.onAuthChange(async () => {
      const u = await auth.me().catch(() => null);
      document.body.dataset.role = classifyRole(u);
      await populateHeader();
    });

    return _unsubAuth;
  },

  destroy() {
    if (_unsubAuth) {
      _unsubAuth();
      _unsubAuth = null;
    }
  },

  outlet: '#page-outlet',

  /**
   * Toggle .active on every nav item whose data-route matches `path`.
   * The "+" plus button and the admin "Crear" item are always skipped —
   * they are action triggers, not navigation destinations.
   */
  updateActive(path) {
    document.querySelectorAll('.app-shell-nav-item').forEach((item) => {
      if (
        item.classList.contains('app-shell-bottom-nav__plus') ||
        item.classList.contains('app-shell-bottom-nav__create')
      ) {
        return;
      }
      const isMatch = item.dataset.route === path;
      item.classList.toggle('active', isMatch);
    });
  },
};

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Populate the role-specific header content. Admin gets the user menu
 * (name + avatar), citizen gets a single-letter avatar, guest has no
 * header content beyond the login button (already in the template).
 *
 * SECURITY: Always fetches /me fresh — never uses cached user state.
 */
async function populateHeader() {
  const u = await auth.me().catch(() => null);
  if (!u) return;
  const role = classifyRole(u);

  if (role === 'admin') {
    const nameEl = document.getElementById('app-shell-user-name');
    const avatarEl = document.getElementById('app-shell-user-avatar');
    if (nameEl) {
      nameEl.textContent =
        `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
        u.email ||
        'Usuario';
    }
    if (avatarEl) {
      avatarEl.textContent = (u.first_name || u.email || '?')[0].toUpperCase();
    }
    return;
  }

  if (role === 'citizen') {
    const avatarEl = document.getElementById('app-shell-avatar');
    if (avatarEl) {
      avatarEl.textContent = (u.first_name || u.email || '?')[0].toUpperCase();
    }
  }
}

/**
 * Wire up dynamic navigation actions:
 *   - The citizen/guest "+" plus button: redirect to /feed/crear when
 *     authenticated, /login otherwise.
 *   - The admin user-menu trigger: opens a dropdown menu (placeholder —
 *     full menu is wired in PR #2 alongside router integration).
 */
function wireNav() {
  const plusBtn = document.getElementById('app-shell-bottom-plus');
  if (plusBtn) {
    plusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (auth.isAuthenticated()) {
        window.location.hash = '#/feed/crear';
      } else {
        window.location.hash = '#/login';
      }
    });
  }
}
