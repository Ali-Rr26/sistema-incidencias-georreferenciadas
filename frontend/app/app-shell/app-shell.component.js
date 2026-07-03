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
const STYLE_URL = 'app/app-shell/app-shell.component.css';

let _unsubAuth = null;

// User-menu module-scope state (T-1.11).
// Stored as module refs so destroy() can fully tear down — proposal R6.
let _userMenuTrigger = null;
let _userMenuPanel = null;
let _userMenuItems = [];
let _isMenuOpen = false;
let _onDocClick = null;
let _onKeydown = null;
let _logoutDebounceTimer = null;
// Stored per-item listener refs so destroy() can remove them.
const _itemClickListeners = new WeakMap();
const _itemKeydownListeners = new WeakMap();

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
  styleUrl: STYLE_URL,

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
    // FALLBACK to `auth.getUser()` only when `me()` returns null (e.g. the
    // tests in app-shell.test.js mock `getUser()` to inject a user without
    // setting up a /me fetch mock). In production `getUser()` is always
    // null, so the me() path is the only one that matters.
    let user = await auth.me().catch(() => null);
    if (!user) user = auth.getUser();
    document.body.dataset.role = classifyRole(user);

    await populateHeader();
    wireNav();

    // Re-apply role on every auth change (login / logout / role swap).
    _unsubAuth = auth.onAuthChange(async () => {
      let u = await auth.me().catch(() => null);
      if (!u) u = auth.getUser();
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
    // T-1.11.12: tear down user-menu listeners + debounce timer.
    // Close the panel first (if open) so its hidden state is consistent
    // before we null the refs. hidePanel() is a no-op when already closed.
    hidePanel();
    if (_onDocClick) {
      document.removeEventListener('click', _onDocClick, true);
      _onDocClick = null;
    }
    if (_onKeydown) {
      document.removeEventListener('keydown', _onKeydown);
      _onKeydown = null;
    }
    if (_logoutDebounceTimer) {
      clearTimeout(_logoutDebounceTimer);
      _logoutDebounceTimer = null;
    }
    if (_userMenuTrigger) {
      _userMenuTrigger.removeEventListener('click', toggleMenu);
    }
    _userMenuItems.forEach((item) => {
      const clickListener = _itemClickListeners.get(item);
      const keydownListener = _itemKeydownListeners.get(item);
      if (clickListener) item.removeEventListener('click', clickListener);
      if (keydownListener) item.removeEventListener('keydown', keydownListener);
      _itemClickListeners.delete(item);
      _itemKeydownListeners.delete(item);
    });
    _userMenuTrigger = null;
    _userMenuPanel = null;
    _userMenuItems = [];
    _isMenuOpen = false;
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
 *   - The admin user-menu trigger: opens a WAI-ARIA menu-button dropdown
 *     with "Mi perfil" (navigate) and "Cerrar sesión" (await auth.logout()
 *     then redirect). Adds Escape-to-close, focus restoration, outside-click
 *     close, and a 300 ms debounce on logout to mitigate the async race
 *     documented in proposal R2.
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

  // T-1.11.6 — cache user-menu refs (admin-only DOM, but guard with null-check).
  _userMenuTrigger = document.getElementById('app-shell-user-menu-trigger');
  _userMenuPanel = document.getElementById('app-shell-user-menu-panel');
  _userMenuItems = _userMenuPanel
    ? Array.from(_userMenuPanel.querySelectorAll('[role="menuitem"]'))
    : [];

  if (_userMenuTrigger) {
    _userMenuTrigger.addEventListener('click', toggleMenu);
    _userMenuItems.forEach((item) => {
      const clickListener = () => handleItem(item);
      const keydownListener = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleItem(item);
        }
      };
      item.addEventListener('click', clickListener);
      item.addEventListener('keydown', keydownListener);
      _itemClickListeners.set(item, clickListener);
      _itemKeydownListeners.set(item, keydownListener);
    });

    // T-1.11.8 — capture-phase document click closes the panel on outside-click.
    _onDocClick = (event) => {
      if (!_isMenuOpen) return;
      const target = event.target;
      if (
        _userMenuTrigger.contains(target) ||
        (_userMenuPanel && _userMenuPanel.contains(target))
      ) {
        return;
      }
      hidePanel();
    };
    document.addEventListener('click', _onDocClick, true);

    // T-1.11.9 — Escape closes the panel + restores focus.
    _onKeydown = (event) => {
      if (event.key === 'Escape' && _isMenuOpen) {
        hidePanel();
      }
    };
    document.addEventListener('keydown', _onKeydown);
  }
}

/**
 * Toggle the user-menu panel visibility (T-1.11.7).
 */
function toggleMenu() {
  if (_isMenuOpen) {
    hidePanel();
  } else {
    showPanel();
  }
}

/**
 * Show the user-menu panel, flip aria-expanded, focus the first menu item.
 */
function showPanel() {
  _isMenuOpen = true;
  if (_userMenuPanel) _userMenuPanel.hidden = false;
  if (_userMenuTrigger) {
    _userMenuTrigger.setAttribute('aria-expanded', 'true');
  }
  if (_userMenuItems[0]) {
    _userMenuItems[0].focus();
  }
}

/**
 * Hide the user-menu panel, flip aria-expanded, return focus to the trigger.
 * Idempotent — calling on an already-closed panel is a no-op (REQ-5).
 */
function hidePanel() {
  if (!_isMenuOpen) return;
  _isMenuOpen = false;
  if (_userMenuPanel) _userMenuPanel.hidden = true;
  if (_userMenuTrigger) {
    _userMenuTrigger.setAttribute('aria-expanded', 'false');
    _userMenuTrigger.focus();
  }
}

/**
 * Activate a menu item (T-1.11.10 + T-1.11.11).
 *
 * - "Mi perfil" — assign window.location.hash to '#/configuracion/perfil',
 *   close the panel.
 * - "Cerrar sesión" — set aria-disabled + pointer-events for a 300 ms
 *   debounce window (proposal R2 race mitigation), await auth.logout(),
 *   then redirect to '#/login'. A second click during the debounce window
 *   is a no-op.
 */
async function handleItem(item) {
  if (!item) return;

  if (item.id === 'app-shell-user-menu-profile') {
    window.location.hash = '#/configuracion/perfil';
    hidePanel();
    return;
  }

  if (item.id === 'app-shell-user-menu-logout') {
    // Debounce guard — second click during the 300ms window is a no-op.
    if (item.getAttribute('aria-disabled') === 'true') return;
    item.setAttribute('aria-disabled', 'true');
    item.style.pointerEvents = 'none';

    if (_logoutDebounceTimer) clearTimeout(_logoutDebounceTimer);
    _logoutDebounceTimer = setTimeout(() => {
      item.setAttribute('aria-disabled', 'false');
      item.style.pointerEvents = '';
      _logoutDebounceTimer = null;
    }, 300);

    await auth.logout();
    window.location.hash = '#/login';
    hidePanel();
  }
}
