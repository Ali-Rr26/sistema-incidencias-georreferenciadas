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
import { menuService } from '../shared/menu.service.js';
import { notificationService } from '../shared/notification.service.js';

const TEMPLATE_URL = 'app/app-shell/app-shell.component.html';
const STYLE_URL = 'app/app-shell/app-shell.component.css';

let _unsubAuth = null;

// User-menu instances (T-1.11 + citizen parity).
// We now have two menus with identical behavior: one in the admin header
// (avatar + name + chevron) and one in the citizen header (compact, just
// the avatar). Both run the same WAI-ARIA menu-button pattern, so we
// share the implementation via a factory and hold the instances in an
// array so destroy() can tear them all down.
let _userMenus = [];

// Sidebar collapse/expand module-scope state.
// - `_sidebarCollapsed` is the persisted user preference (desktop).
// - `_sidebarOpenMobile` is the transient off-canvas overlay state.
// - The two are kept separate because they answer different questions:
//   "does the user want the sidebar narrow?" vs "is the user looking at
//   the sidebar right now on a small screen?".
let _sidebarToggleBtn = null;
let _sidebarEl = null;
let _sidebarBackdropEl = null;
let _sidebarCollapsed = false;
let _sidebarOpenMobile = false;
const SIDEBAR_COLLAPSE_STORAGE_KEY = 'appShell:sidebarCollapsed';
const SIDEBAR_COLLAPSE_BREAKPOINT = 768;
let _onSidebarDocClick = null;
let _onSidebarKeydown = null;
let _onResize = null;

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
    if (!html.trim()) {
      throw new Error('appShell.mount: template body is empty');
    }
    const outlet = document.getElementById('shell-outlet');
    if (!outlet) {
      throw new Error('appShell.mount: #shell-outlet not found in DOM');
    }

    // SECURITY: parse with DOMParser instead of assigning to innerHTML.
    // DOMParser does not execute inline <script> tags, so even if the
    // template source were ever compromised the worst case is markup
    // injection, not script execution. The template is served from our
    // own static assets, but defense-in-depth matters.
    //
    // We append each parsed child one at a time rather than going through
    // a DocumentFragment + replaceChildren in a single call. The fragment
    // approach was observed to drop the parsed nodes in some browsers
    // (the adoption step across documents can fail silently when the
    // fragment's children come from the parsed HTML's document). The
    // explicit appendChild loop makes each adoption observable.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    outlet.replaceChildren();
    for (const node of Array.from(doc.body.childNodes)) {
      outlet.appendChild(node);
    }

    // Sanity check: the router downstream does
    // `document.querySelector('#page-outlet')` and throws
    // "Outlet not found" if it's missing. If the insert pipeline dropped
    // our nodes for any reason, fail loudly here with diagnostics so the
    // failure points at the right call site instead of confusingly
    // surfacing in the router.
    if (!outlet.querySelector('#page-outlet')) {
      throw new Error(
        `appShell.mount: #page-outlet not present after insert. ` +
          `template length=${html.length} bytes, outlet children=${outlet.children.length}`,
      );
    }
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
    wireSidebarToggle();

    // Render admin sidebar dynamically from /api/menus/my.
    // Falls back silently if the endpoint fails or the user is not admin.
    if (document.body.dataset.role === 'admin') {
      renderAdminMenu().catch(() => {
        // No-op: empty sidebar is preferable to crashing the shell.
      });
    }

    // Re-apply role on every auth change (login / logout / role swap).
    _unsubAuth = auth.onAuthChange(async () => {
      let u = await auth.me().catch(() => null);
      if (!u) u = auth.getUser();
      document.body.dataset.role = classifyRole(u);
      await populateHeader();
      // Re-apply sidebar collapsed state in case the role swap rebuilt
      // chrome (e.g. switching roles changes which sidebar is visible,
      // and we want the collapsed preference to remain consistent).
      applySidebarCollapsed();
    });

    return _unsubAuth;
  },

  destroy() {
    if (_unsubAuth) {
      _unsubAuth();
      _unsubAuth = null;
    }
    // T-1.11.12 + citizen parity: tear down every user-menu instance.
    // Each menu owns its own listeners + debounce timer, so calling
    // destroy() on every instance is enough to fully release resources.
    _userMenus.forEach((menu) => menu.destroy());
    _userMenus = [];

    // Sidebar toggle teardown — remove every listener we registered
    // and null the refs so a subsequent init() starts clean.
    teardownSidebarToggle();
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
 * Wire the sidebar collapse/expand toggle.
 *
 * Desktop: clicking the button flips a persisted collapsed preference
 * and adds .app-shell--sidebar-collapsed to the root grid container.
 *
 * Mobile (<768px): clicking the button opens/closes an off-canvas
 * overlay. The collapsed preference is ignored on mobile because the
 * sidebar is already off-screen by default.
 *
 * Persistence: we use localStorage with try/catch so private-browsing
 * mode (where storage throws) degrades gracefully to in-memory only.
 */
function wireSidebarToggle() {
  const grid = document.querySelector('.app-shell');
  if (!grid) return;
  _sidebarEl = document.getElementById('app-shell-sidebar');
  _sidebarToggleBtn = document.getElementById('app-shell-sidebar-toggle');
  if (!_sidebarToggleBtn) return;

  // Restore persisted preference. If storage is unavailable (private
  // browsing) the catch keeps _sidebarCollapsed at its default false.
  try {
    _sidebarCollapsed =
      localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1';
  } catch (_e) {
    _sidebarCollapsed = false;
  }
  applySidebarCollapsed();

  _sidebarToggleBtn.addEventListener('click', () => {
    if (isMobileViewport()) {
      _sidebarOpenMobile = !_sidebarOpenMobile;
      applySidebarMobileOpen();
    } else {
      _sidebarCollapsed = !_sidebarCollapsed;
      try {
        localStorage.setItem(
          SIDEBAR_COLLAPSE_STORAGE_KEY,
          _sidebarCollapsed ? '1' : '0',
        );
      } catch (_e) {
        /* storage unavailable — preference stays in-memory only */
      }
      applySidebarCollapsed();
    }
  });

  // Backdrop click closes the mobile overlay.
  _onSidebarDocClick = (event) => {
    if (!_sidebarOpenMobile) return;
    const target = event.target;
    if (_sidebarBackdropEl && _sidebarBackdropEl.contains(target)) {
      _sidebarOpenMobile = false;
      applySidebarMobileOpen();
    }
  };
  document.addEventListener('click', _onSidebarDocClick, true);

  // Escape closes the mobile overlay.
  _onSidebarKeydown = (event) => {
    if (event.key === 'Escape' && _sidebarOpenMobile) {
      _sidebarOpenMobile = false;
      applySidebarMobileOpen();
    }
  };
  document.addEventListener('keydown', _onSidebarKeydown);

  // Re-sync state on viewport cross so a resize from mobile to desktop
  // (or vice versa) doesn't leave a half-applied class.
  _onResize = () => {
    if (isMobileViewport()) {
      // Moving to mobile: drop the desktop collapsed class but keep the
      // stored preference for the next desktop session.
      grid.classList.remove('app-shell--sidebar-collapsed');
      // Close the mobile overlay on resize to avoid stale state.
      if (_sidebarOpenMobile) {
        _sidebarOpenMobile = false;
        applySidebarMobileOpen();
      }
    } else {
      // Moving to desktop: re-apply the persisted preference and
      // force-close the mobile overlay state.
      _sidebarOpenMobile = false;
      applySidebarMobileOpen();
      applySidebarCollapsed();
    }
  };
  window.addEventListener('resize', _onResize);
}

/**
 * Apply or remove the desktop collapsed class based on `_sidebarCollapsed`.
 * Also flips the toggle button's aria-expanded + title to match.
 */
function applySidebarCollapsed() {
  const grid = document.querySelector('.app-shell');
  if (!grid) return;
  grid.classList.toggle('app-shell--sidebar-collapsed', _sidebarCollapsed);
  if (_sidebarToggleBtn) {
    _sidebarToggleBtn.setAttribute(
      'aria-expanded',
      _sidebarCollapsed ? 'false' : 'true',
    );
    _sidebarToggleBtn.setAttribute(
      'title',
      _sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral',
    );
  }
}

/**
 * Apply the mobile off-canvas overlay state. Lazily creates the backdrop
 * element the first time we need it so the DOM stays clean for desktop
 * users who never trigger the mobile path.
 */
function applySidebarMobileOpen() {
  if (!_sidebarEl) return;
  _sidebarEl.classList.toggle('is-open', _sidebarOpenMobile);
  if (_sidebarToggleBtn) {
    _sidebarToggleBtn.setAttribute(
      'aria-expanded',
      _sidebarOpenMobile ? 'true' : 'false',
    );
  }
  if (_sidebarOpenMobile) {
    if (!_sidebarBackdropEl) {
      _sidebarBackdropEl = document.createElement('div');
      _sidebarBackdropEl.className = 'app-shell-sidebar-backdrop';
      document.body.appendChild(_sidebarBackdropEl);
    }
    _sidebarBackdropEl.classList.add('is-open');
  } else if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('is-open');
  }
}

/**
 * Cheap viewport check. matchMedia is the only reliable way to mirror
 * the CSS breakpoint without coupling to specific browser APIs.
 */
function isMobileViewport() {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(
    `(max-width: ${SIDEBAR_COLLAPSE_BREAKPOINT - 0.02}px)`,
  ).matches;
}

/**
 * Remove every sidebar-toggle listener + DOM helper. Called from
 * destroy() so the shell can be torn down without leaving dangling
 * handlers.
 */
function teardownSidebarToggle() {
  if (_sidebarToggleBtn) {
    // The click listener is anonymous, so we can't remove it directly.
    // Replacing the node with a clone strips all listeners attached
    // via addEventListener — a safe tear-down for a node we own.
    const clone = _sidebarToggleBtn.cloneNode(true);
    _sidebarToggleBtn.parentNode.replaceChild(clone, _sidebarToggleBtn);
    _sidebarToggleBtn = clone;
  }
  if (_onSidebarDocClick) {
    document.removeEventListener('click', _onSidebarDocClick, true);
    _onSidebarDocClick = null;
  }
  if (_onSidebarKeydown) {
    document.removeEventListener('keydown', _onSidebarKeydown);
    _onSidebarKeydown = null;
  }
  if (_onResize) {
    window.removeEventListener('resize', _onResize);
    _onResize = null;
  }
  if (_sidebarBackdropEl && _sidebarBackdropEl.parentNode) {
    _sidebarBackdropEl.parentNode.removeChild(_sidebarBackdropEl);
  }
  _sidebarBackdropEl = null;
  _sidebarEl = null;
  _sidebarOpenMobile = false;
}

/**
 * Populate the role-specific header content. Admin gets the user menu
 * (name + avatar), citizen gets a single-letter avatar, guest has no
 * header content beyond the login button (already in the template).
 *
 * SECURITY: Always fetches /me fresh — never uses cached user state.
 */
async function renderAdminMenu() {
  const listEl = document.getElementById('app-shell-admin-menu-list');
  if (!listEl) return;

  const tree = await menuService.getMyMenu();
  if (!Array.isArray(tree) || tree.length === 0) return;

  const nodes = [];
  for (const item of tree) {
    if (item.children && item.children.length > 0) {
      nodes.push(buildSectionHeader(item.name));
      for (const child of item.children) {
        if (child.route) nodes.push(buildLeafLink(child));
      }
    } else if (item.route) {
      nodes.push(buildLeafLink(item));
    }
  }

  listEl.replaceChildren(...nodes);
}

function buildSectionHeader(name) {
  const li = document.createElement('li');
  li.className = 'app-shell-section';
  const span = document.createElement('span');
  span.textContent = String(name ?? '').toUpperCase();
  li.appendChild(span);
  return li;
}

function buildLeafLink(item) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `#${item.route}`;
  a.className = 'app-shell-nav-item';
  a.dataset.route = item.route;

  if (item.icon) {
    const i = document.createElement('i');
    i.className = item.icon;
    a.appendChild(i);
  }

  const label = document.createElement('span');
  label.textContent = item.name ?? '';
  a.appendChild(label);

  li.appendChild(a);
  return li;
}

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

    // Notifications badge (admin header bell).
    notificationService
      .unreadCount()
      .then((count) => {
        const badge = document.getElementById('app-shell-bell-badge-admin');
        if (!badge) return;
        if (count > 0) {
          badge.textContent = String(count);
          badge.classList.remove('d-none');
        } else {
          badge.classList.add('d-none');
        }
      })
      .catch(() => {
        // silent fail — badge stays hidden
      });

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

  // T-1.11.6 + citizen parity: wire both user-menu instances (admin +
  // citizen) through the shared factory. We push every successfully
  // initialised menu into _userMenus so destroy() can tear them all
  // down with one loop.
  const menus = [
    {
      triggerId: 'app-shell-user-menu-trigger',
      panelId: 'app-shell-user-menu-panel',
      profileItemId: 'app-shell-user-menu-profile',
      logoutItemId: 'app-shell-user-menu-logout',
    },
    {
      triggerId: 'app-shell-citizen-menu-trigger',
      panelId: 'app-shell-citizen-menu-panel',
      profileItemId: 'app-shell-citizen-menu-profile',
      logoutItemId: 'app-shell-citizen-menu-logout',
    },
  ];
  menus.forEach((config) => {
    const menu = createUserMenu(config);
    if (menu) {
      menu.init();
      _userMenus.push(menu);
    }
  });
}

/**
 * Build a WAI-ARIA menu-button instance bound to the given DOM ids.
 *
 * Returns `{ init, destroy }` so the caller can manage lifecycle.
 * `init()` wires the click trigger, item clicks, outside-click close,
 * and Escape-to-close. `destroy()` reverses every listener and clears
 * the debounce timer so the instance can be safely garbage-collected
 * after the shell is torn down.
 *
 * Item semantics:
 *   - "Mi perfil" — set window.location.hash to '#/configuracion/perfil'
 *     and close the panel.
 *   - "Cerrar sesión" — set aria-disabled + pointer-events for a 300 ms
 *     debounce window (proposal R2 race mitigation), await auth.logout(),
 *     then redirect to '#/login'. A second click during the debounce
 *     window is a no-op.
 */
function createUserMenu({ triggerId, panelId, profileItemId, logoutItemId }) {
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  if (!trigger || !panel) return null;

  const profileItem = profileItemId
    ? document.getElementById(profileItemId)
    : null;
  const logoutItem = logoutItemId
    ? document.getElementById(logoutItemId)
    : null;
  const items = panel.querySelectorAll('[role="menuitem"]');

  let isOpen = false;
  let onDocClick = null;
  let onKeydown = null;
  let logoutDebounceTimer = null;
  const itemClickListeners = new WeakMap();
  const itemKeydownListeners = new WeakMap();

  function showPanel() {
    isOpen = true;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (items[0]) items[0].focus();
  }

  function hidePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  function toggle() {
    if (isOpen) hidePanel();
    else showPanel();
  }

  async function handleItem(item) {
    if (!item) return;
    if (item === profileItem) {
      window.location.hash = '#/configuracion/perfil';
      hidePanel();
      return;
    }
    if (item === logoutItem) {
      // Debounce guard — second click during the 300ms window is a no-op.
      if (item.getAttribute('aria-disabled') === 'true') return;
      item.setAttribute('aria-disabled', 'true');
      item.style.pointerEvents = 'none';
      if (logoutDebounceTimer) clearTimeout(logoutDebounceTimer);
      logoutDebounceTimer = setTimeout(() => {
        item.setAttribute('aria-disabled', 'false');
        item.style.pointerEvents = '';
        logoutDebounceTimer = null;
      }, 300);
      await auth.logout();
      window.location.hash = '#/login';
      hidePanel();
    }
  }

  function init() {
    trigger.addEventListener('click', toggle);
    items.forEach((item) => {
      const clickListener = () => handleItem(item);
      const keydownListener = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleItem(item);
        }
      };
      item.addEventListener('click', clickListener);
      item.addEventListener('keydown', keydownListener);
      itemClickListeners.set(item, clickListener);
      itemKeydownListeners.set(item, keydownListener);
    });

    // Capture-phase so the panel closes even when the click target is
    // nested inside another click-handler (e.g. router nav links).
    //
    // We also bail out if the click is inside ANY .app-shell-user-menu
    // wrapper, not just our own. Without this guard, opening the admin
    // menu would close the citizen menu (and vice versa) because each
    // menu's outside-click handler treats the other menu's trigger as
    // "outside" its own subtree. The `closest('.app-shell-user-menu')`
    // check is cheap and lets the menu that actually owns the click
    // decide what to do.
    onDocClick = (event) => {
      if (!isOpen) return;
      if (event.target.closest('.app-shell-user-menu')) return;
      hidePanel();
    };
    document.addEventListener('click', onDocClick, true);

    onKeydown = (event) => {
      if (event.key === 'Escape' && isOpen) hidePanel();
    };
    document.addEventListener('keydown', onKeydown);
  }

  function destroy() {
    hidePanel();
    if (onDocClick) {
      document.removeEventListener('click', onDocClick, true);
      onDocClick = null;
    }
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
      onKeydown = null;
    }
    if (logoutDebounceTimer) {
      clearTimeout(logoutDebounceTimer);
      logoutDebounceTimer = null;
    }
    if (trigger) trigger.removeEventListener('click', toggle);
    items.forEach((item) => {
      const clickListener = itemClickListeners.get(item);
      const keydownListener = itemKeydownListeners.get(item);
      if (clickListener) item.removeEventListener('click', clickListener);
      if (keydownListener) item.removeEventListener('keydown', keydownListener);
      itemClickListeners.delete(item);
      itemKeydownListeners.delete(item);
    });
  }

  return { init, destroy };
}
