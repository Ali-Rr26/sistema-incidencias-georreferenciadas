/**
 * Hash-based SPA Router with persistent app shell.
 *
 * Routes can mount inside one of several registered shells:
 *   - 'admin' — navbar + sidebar layout for back-office users
 *   - 'user'  — Instagram-style layout (top bar + sidebar desktop, bottom nav mobile)
 *   - 'app'   — unified responsive shell (consolidar-layout-unico, PR #1/3 + PR #2/3)
 *
 * Each shell is registered via registerShell() with:
 *   - mount:    fetches and injects the shell template into #shell-outlet
 *   - init:     runs once after the shell is first shown (wires nav, user data, etc.)
 *   - outlet:   CSS selector for the per-page outlet inside the shell
 *
 * Routes that don't pass a shell name render full-page into #auth-outlet (login, etc.).
 *
 * Role-based gating (PR #2 — transitional, full migration in PR #3):
 *   - addRoute(..., shell, role) tags a route with a role bucket.
 *   - setCurrentUserRole(role) tells the router which bucket the visitor is in.
 *   - resolve() redirects mismatched visitors to /dashboard (admins) or /feed (others).
 */
import { initPage } from '../utils/layout.js';

class Router {
  constructor() {
    this.routes = [];
    this.shells = new Map();
    this.currentComponent = null;
    this._boundResolve = () => this.resolve();
    this._shellState = new Map(); // shell name -> { mounted, initialized }
    this._activeShell = null;
    // Role-tracking for the role-mismatch guard (PR #2, T-2.4).
    // Default null = no role known → role-tagged routes that require a
    // specific role will treat the visitor as a mismatch and redirect to
    // the public fallback (citizen's home: /feed).
    this._currentUserRole = null;
  }

  /**
   * Set the role bucket the current visitor belongs to. Consumed by the
   * role-mismatch guard in resolve() when a route declares a `role` tag.
   *
   * Role buckets (see app-shell/app-shell.component.js → classifyRole):
   *   - 'admin'   : admin_sistema | admin_organizacion
   *   - 'citizen' : all other authenticated roles
   *   - 'guest'   : unauthenticated
   *   - 'both'    : reserved as a route tag only — never a current role
   *
   * Pass `null` to clear (e.g. on logout) so no role enforcement applies.
   *
   * @param {string|null} role
   */
  setCurrentUserRole(role) {
    this._currentUserRole = role;
  }

  /**
   * @param {string}   pattern  - hash path, e.g. '/login'
   * @param {object}   component
   * @param {Array}    guards   - optional canActivate guards
   * @param {string|boolean|null} shell
   *     - shell name (string, e.g. 'admin' | 'user' | 'app')
   *     - true (legacy 'admin' shortcut)
   *     - null/undefined → render full-page (login, error pages)
   * @param {string|undefined} role
   *     NEW (PR #2, T-2.1) — optional role tag for the role-mismatch guard:
   *     - 'admin'   : only admin visitors may proceed
   *     - 'citizen' : only citizen visitors may proceed
   *     - 'both'    : any authenticated visitor may proceed
   *     - undefined : no role enforcement (public)
   */
  addRoute(pattern, component, guards = [], shell = null, role = undefined) {
    if (shell === true) shell = 'admin';
    this.routes.push({ pattern, component, guards, shell, role });
  }

  /**
   * Register a shell that can host routes.
   *
   * @param {string}   name
   * @param {object}   config
   * @param {Function} config.mount        - async () => void. Injects shell HTML.
   * @param {Function} config.init         - async () => void. Runs once when shell is first shown.
   * @param {string}   config.outlet       - CSS selector for the per-page outlet.
   * @param {Function} config.updateActive - (path: string) => void. Updates nav active state.
   */
  registerShell(name, { mount, init, outlet, updateActive }) {
    if (!mount || !outlet) {
      throw new Error(`registerShell(${name}): mount and outlet are required`);
    }
    this.shells.set(name, { mount, init, outlet, updateActive });
    this._shellState.set(name, { mounted: false, initialized: false });
  }

  /**
   * @deprecated Use registerShell() instead. Kept for backwards compatibility —
   * registers an 'admin' shell using the legacy setShellInitFn() callback.
   */
  setShellInitFn(fn) {
    this._legacyShellInitFn = fn;
  }

  /** Reset shell init state — call on logout so next login re-runs shell init. */
  resetShell() {
    for (const [name] of this._shellState) {
      this._shellState.set(name, { mounted: false, initialized: false });
    }
  }

  navigate(path) {
    window.location.hash = `#${path}`;
  }

  async resolve() {
    const fullPath = window.location.hash.slice(1) || '/';

    if (fullPath === '/') {
      this.navigate('/login');
      return;
    }

    // Split query params from path for matching
    const qsIndex = fullPath.indexOf('?');
    const path = qsIndex >= 0 ? fullPath.substring(0, qsIndex) : fullPath;
    this.queryParams =
      qsIndex >= 0
        ? new URLSearchParams(fullPath.substring(qsIndex + 1))
        : new URLSearchParams();

    // Match exact or parameterized route
    let route = this.routes.find((r) => r.pattern === path);
    this.routeParams = {};

    if (!route) {
      // Try to match parameterized routes
      for (const r of this.routes) {
        const params = this._matchRoute(r.pattern, path);
        if (params !== null) {
          route = r;
          this.routeParams = params;
          break;
        }
      }
    }

    if (!route) {
      this.navigate('/not-found');
      return;
    }

    const { component, guards, shell, role } = route;

    for (const guard of guards) {
      const canProceed = await guard.canActivate();
      if (canProceed === false) return;
    }

    // Role-mismatch guard (PR #2, T-2.2).
    // Only fires for routes that opt in via the `role` tag. Public routes
    // (role undefined) and 'both' routes are never blocked.
    if (
      role !== undefined &&
      role !== 'both' &&
      this._currentUserRole &&
      role !== this._currentUserRole
    ) {
      const home = this._currentUserRole === 'admin' ? '/dashboard' : '/feed';
      this.navigate(home);
      return;
    }

    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this._cleanupStyles(this.currentComponent);
    }

    this.currentComponent = component;

    if (shell) {
      await this._mountInShell(shell, component, path);
    } else {
      await this._mountFull(component);
    }

    await component.onInit();
  }

  /**
   * Match a route pattern against a path.
   * @param {string} pattern - e.g. '/incidencias/:id'
   * @param {string} path    - e.g. '/incidencias/42'
   * @returns {object|null} params object or null if no match
   */
  _matchRoute(pattern, path) {
    const parts = pattern.split('/');
    const pathParts = path.split('/');
    if (parts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        params[parts[i].slice(1)] = pathParts[i];
      } else if (parts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }

  async _mountInShell(shellName, component, path) {
    const shell = this.shells.get(shellName);
    if (!shell) {
      throw new Error(`Shell not registered: ${shellName}`);
    }

    const state = this._shellState.get(shellName);

    // If switching to a different shell, unmount the previous one
    if (this._activeShell && this._activeShell !== shellName) {
      const prevShell = this.shells.get(this._activeShell);
      if (prevShell) {
        const outlet = document.querySelector(prevShell.outlet);
        if (outlet) outlet.innerHTML = '';
        // Run shell cleanup if provided (unsub listeners, etc.)
        if (typeof prevShell.destroy === 'function') {
          try {
            prevShell.destroy();
          } catch (err) {
            console.error(
              `[Router] Error destroying shell '${this._activeShell}':`,
              err,
            );
          }
        }
      }
      // Clear shell-outlet to remove previous shell HTML
      const shellOutlet = document.getElementById('shell-outlet');
      if (shellOutlet) shellOutlet.innerHTML = '';
      this._shellState.set(this._activeShell, {
        mounted: false,
        initialized: false,
      });
    }

    // Toggle shell visibility on full-page outlet (login)
    const authOutlet = document.getElementById('auth-outlet');
    if (authOutlet) {
      authOutlet.innerHTML = '';
      authOutlet.style.display = 'none';
    }

    // Mount shell template if not mounted yet
    if (!state.mounted) {
      await shell.mount();
      state.mounted = true;
    }

    // Run shell init once (user info, nav wiring, etc.)
    if (!state.initialized) {
      if (shell.init) {
        await shell.init();
      } else if (this._legacyShellInitFn) {
        // Backwards compat path
        await this._legacyShellInitFn();
      }
      state.initialized = true;
    }

    // Mount page content into the shell's outlet
    const outlet = document.querySelector(shell.outlet);
    if (!outlet) {
      throw new Error(
        `Outlet not found for shell '${shellName}': ${shell.outlet}`,
      );
    }

    const html = await this._fetchTemplate(component.templateUrl);
    outlet.innerHTML = html;

    await this._injectStyles(component);
    initPage();

    this._activeShell = shellName;
    this._updateNavActive(shellName, path);
  }

  async _mountFull(component) {
    const shellOutlet = document.getElementById('shell-outlet');
    if (shellOutlet) shellOutlet.innerHTML = '';

    const authOutlet = document.getElementById('auth-outlet');
    if (authOutlet) authOutlet.style.display = 'block';

    const html = await this._fetchTemplate(component.templateUrl);
    if (authOutlet) authOutlet.innerHTML = html;

    await this._injectStyles(component);
    this._activeShell = null;
  }

  async _injectStyles(component) {
    if (!component.styleUrl) return;
    const css = await this._fetchTemplate(component.styleUrl);
    const style = document.createElement('style');
    const id = `style-${Date.now()}`;
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    component._styleId = id;
  }

  _cleanupStyles(component) {
    if (component._styleId) {
      document.getElementById(component._styleId)?.remove();
      delete component._styleId;
    }
  }

  /**
   * Update active state on the current shell's navigation (sidebar, bottom nav, top nav).
   */
  _updateNavActive(shellName, path) {
    const shell = this.shells.get(shellName);
    if (shell?.updateActive) {
      shell.updateActive(path);
    }
  }

  async _fetchTemplate(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Error loading ${url}: ${res.status}`);
    return res.text();
  }

  init() {
    window.addEventListener('hashchange', this._boundResolve);
    this.resolve();
  }

  destroy() {
    window.removeEventListener('hashchange', this._boundResolve);
    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this._cleanupStyles(this.currentComponent);
    }
  }
}

export const router = new Router();
