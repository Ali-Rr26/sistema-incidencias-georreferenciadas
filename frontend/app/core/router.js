/**
 * Hash-based SPA Router (simplified, single-shell).
 *
 * Responsibilities:
 *   - Match the current hash against registered patterns (`:param` supported).
 *   - Run per-route guards (auth, role) before mounting.
 *   - Tear down the previous component's `onDestroy` + injected CSS, then
 *     mount the next component's template into either the shell's page outlet
 *     or the full-page auth outlet.
 *   - Pass `{ params, query, role }` to the component's `onInit` so the
 *     component never has to read router state directly.
 *
 * Shell handling is intentionally minimal: with a single shell registered via
 * `setShell()`, the shell is mounted ONCE on the first navigation that needs
 * it and stays in the DOM. Routes that opt out of the shell (i.e. routes
 * WITHOUT a role tag, like /login) are rendered into `#auth-outlet`. Routes
 * WITH a role tag (admin/citizen/both) are rendered into the shell's page
 * outlet — the role tag is also passed to the component as part of the
 * `onInit` context.
 */
import { initPage } from '../utils/layout.js';

class Router {
  constructor() {
    this.routes = []; // [{ pattern, component, guards, role }]
    this.shell = null; // { mount, init, destroy?, outlet, updateActive?, styleUrl }
    this.currentComponent = null; // the active page component (has onInit/onDestroy)
    this.routeParams = {};
    this.queryParams = new URLSearchParams();
    this._shellMounted = false; // first-time mount only
  }

  // ─── Public API ──────────────────────────────────────────────────────

  setShell(shell) {
    this.shell = shell;
  }

  addRoute(pattern, component, guards = [], role = undefined) {
    this.routes.push({ pattern, component, guards, role });
  }

  navigate(path) {
    window.location.hash = '#' + path;
  }

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  destroy() {
    if (this.currentComponent?.onDestroy) this.currentComponent.onDestroy();
    this._cleanupStyles();
    this.currentComponent = null;
  }

  // ─── Resolve: the heart of the router ────────────────────────────────

  async resolve() {
    // Lazy-mount the shell on the first route that needs it.
    if (this.shell && !this._shellMounted) {
      await this._mountShell();
      this._shellMounted = true;
    }

    const fullPath = window.location.hash.slice(1) || '/';
    if (fullPath === '/') {
      this.navigate('/login');
      return;
    }

    const [path, qs = ''] = fullPath.split('?');
    this.queryParams = new URLSearchParams(qs);
    this.routeParams = {};

    const { route, params } = this._match(path);
    this.routeParams = params;

    if (!route) {
      this.navigate('/not-found');
      return;
    }

    // Per-route guards (auth, role, etc.) — short-circuit on first refusal.
    // Each guard receives the same context the component will receive,
    // so role-based checks can run with the matched route info.
    const ctx = { params, query: this.queryParams, role: route.role };
    for (const guard of route.guards) {
      if ((await guard.canActivate(ctx)) === false) return;
    }

    // Tear down the previous component BEFORE mounting the new one. This is
    // critical for resources that hold DOM nodes or external library handles
    // (e.g. Leaflet maps, polling timers) — their onDestroy must run while
    // their elements are still in the DOM, not after the new template has
    // replaced them.
    if (this.currentComponent?.onDestroy) {
      this.currentComponent.onDestroy();
    }
    this._cleanupStyles();

    this.currentComponent = route.component;
    const isFullPage = route.role === undefined;
    await this._mountPage(route.component, isFullPage);
    await route.component.onInit?.(ctx);
  }

  // ─── Internal helpers ────────────────────────────────────────────────

  _match(path) {
    for (const route of this.routes) {
      const params = this._matchPattern(route.pattern, path);
      if (params) return { route, params };
    }
    return { route: null, params: {} };
  }

  _matchPattern(pattern, path) {
    const pp = pattern.split('/');
    const ap = path.split('/');
    if (pp.length !== ap.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) {
        params[pp[i].slice(1)] = ap[i];
      } else if (pp[i] !== ap[i]) {
        return null;
      }
    }
    return params;
  }

  async _mountShell() {
    if (this.shell.mount) await this.shell.mount();
    if (this.shell.init) await this.shell.init();
    if (this.shell.styleUrl) {
      await this._injectStyle(this.shell.styleUrl, 'shell-style');
    }
  }

  async _mountPage(component, isFullPage) {
    const authOutlet = document.getElementById('auth-outlet');
    const shellOutlet = document.getElementById('shell-outlet');

    // Full-page routes (login, not-found) must hide the shell so the
    // auth-outlet isn't visually covered by the shell chrome sitting at
    // y=0..720. The shell stays mounted in the DOM (no re-mount cost on
    // the next shell route) — only its display flips.
    if (shellOutlet) {
      shellOutlet.style.display = isFullPage ? 'none' : '';
    }
    if (authOutlet) {
      authOutlet.style.display = isFullPage ? 'block' : 'none';
      authOutlet.innerHTML = '';
    }

    const outlet = isFullPage
      ? authOutlet
      : document.querySelector(this.shell?.outlet || '#page-outlet');

    if (!outlet) {
      throw new Error('Router: page outlet not found');
    }

    // Fetch template + CSS in parallel so the component never renders
    // without its styles (eliminates FOUC between insert and style inject).
    const htmlPromise = component.template
      ? Promise.resolve(component.template)
      : this._fetchText(component.templateUrl);
    const cssPromise = component.styleUrl
      ? this._fetchText(component.styleUrl)
      : Promise.resolve(null);

    const [html, css] = await Promise.all([htmlPromise, cssPromise]);

    outlet.innerHTML = html;

    if (css !== null) {
      const id = `style-${Date.now()}`;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
      component._styleId = id;
    }

    // initPage wires per-route Bootstrap widgets (tooltips, popovers).
    initPage();

    if (this.shell?.updateActive && !isFullPage) {
      this.shell.updateActive(window.location.hash.slice(1));
    }
  }

  async _injectStyle(url, id) {
    const css = await this._fetchText(url);
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  _cleanupStyles() {
    // Remove the previous component's <style> tag(s). The shell's
    // 'shell-style' tag is left alone — it must persist across navigations.
    document
      .querySelectorAll('style[id^="style-"]')
      .forEach((el) => el.remove());
  }

  async _fetchText(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Router: failed to load ${url} (${res.status})`);
    return res.text();
  }
}

export const router = new Router();
