/**
 * Hash-based SPA Router with persistent app shell.
 *
 * Routes marked shell:true mount their template into #page-outlet (inside the
 * persistent navbar+sidebar shell). All other routes (login) mount into
 * #auth-outlet and hide the shell.
 *
 * Shell initialisation (user data, logout wiring, layout events) runs exactly
 * once per session via setShellInitFn().
 */
import { initShell, initPage } from '../utils/layout.js';

class Router {
  constructor() {
    this.routes = [];
    this.currentComponent = null;
    this._boundResolve = () => this.resolve();
    this._shellInitialized = false;
    this._shellInitFn = null;
    /** @type {Object<string, object>} Registered custom layouts (name → component) */
    this._layouts = {};
    /** @type {Object<string, boolean>} Whether each custom layout has been initialized */
    this._layoutInitialized = {};
    /** @type {string|null} Currently active custom layout name */
    this._currentLayout = null;
  }

  /**
   * @param {string}   pattern  - hash path, e.g. '/login'
   * @param {object}   component
   * @param {Array}    guards   - optional canActivate guards
   * @param {boolean|string}  shell
   *   - true       → mount inside persistent admin shell (sidebar + topbar)
   *   - 'usuario'  → mount inside a registered custom layout
   *   - false|null → full-page (no shell)
   */
  addRoute(pattern, component, guards = [], shell = false) {
    this.routes.push({ pattern, component, guards, shell });
  }

  /**
   * Register a custom layout component by name.
   * @param {string} name
   * @param {object} layoutObj  — must have { templateUrl, onInit?, onDestroy? }
   */
  registerLayout(name, layoutObj) {
    this._layouts[name] = layoutObj;
    this._layoutInitialized[name] = false;
  }

  /** Callback invoked once when the shell is first shown (user data, logout). */
  setShellInitFn(fn) {
    this._shellInitFn = fn;
  }

  /** Reset shell init state — call on logout so next login re-runs shell init. */
  resetShell() {
    this._shellInitialized = false;
    this._layoutInitialized = {};
    this._currentLayout = null;
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

    const route = this.routes.find((r) => r.pattern === path);
    if (!route) {
      this.navigate('/not-found');
      return;
    }

    const { component, guards, shell } = route;

    for (const guard of guards) {
      const canProceed = await guard.canActivate();
      if (canProceed === false) return;
    }

    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this._cleanupStyles(this.currentComponent);
    }

    this.currentComponent = component;

    if (typeof shell === 'string') {
      await this._mountInCustomShell(shell, component);
    } else if (shell) {
      await this._mountInShell(component);
      this._updateSidebarActive(path);
    } else {
      await this._mountFull(component);
    }

    await component.onInit();
  }

  async _mountInShell(component) {
    const shell = document.getElementById('main-wrapper');
    const authOutlet = document.getElementById('auth-outlet');
    const userWrapper = document.getElementById('user-wrapper');
    if (shell) shell.style.display = 'block';
    if (authOutlet) {
      authOutlet.innerHTML = '';
      authOutlet.style.display = 'none';
    }
    if (userWrapper) userWrapper.style.display = 'none';
    this._currentLayout = null;

    if (!this._shellInitialized) {
      initShell();
      if (this._shellInitFn) await this._shellInitFn();
      this._shellInitialized = true;
    }

    const outlet = document.getElementById('page-outlet');
    if (!outlet) throw new Error('No se encontró #page-outlet');

    const html = await this._fetchTemplate(component.templateUrl);
    outlet.innerHTML = html;

    await this._injectStyles(component);
    initPage();
  }

  async _mountFull(component) {
    const shell = document.getElementById('main-wrapper');
    const authOutlet = document.getElementById('auth-outlet');
    const userWrapper = document.getElementById('user-wrapper');
    if (shell) shell.style.display = 'none';
    if (userWrapper) userWrapper.style.display = 'none';
    if (authOutlet) authOutlet.style.display = 'block';

    const html = await this._fetchTemplate(component.templateUrl);
    authOutlet.innerHTML = html;

    await this._injectStyles(component);
  }

  /**
   * Mount a component inside a registered custom layout.
   * The layout's template is fetched once and cached. The component's template
   * is loaded into the layout's #shell-content element.
   * @param {string} layoutName
   * @param {object} component
   */
  async _mountInCustomShell(layoutName, component) {
    const layout = this._layouts[layoutName];
    if (!layout) throw new Error(`Layout "${layoutName}" no registrado`);

    // Hide the admin shell and auth outlet
    const mainWrapper = document.getElementById('main-wrapper');
    const authOutlet = document.getElementById('auth-outlet');
    const userWrapper = document.getElementById('user-wrapper');
    if (mainWrapper) mainWrapper.style.display = 'none';
    if (authOutlet) {
      authOutlet.innerHTML = '';
      authOutlet.style.display = 'none';
    }

    // If switching from a different custom layout, destroy the old one
    if (this._currentLayout && this._currentLayout !== layoutName && userWrapper) {
      const oldLayout = this._layouts[this._currentLayout];
      if (oldLayout && oldLayout.onDestroy) oldLayout.onDestroy();
      userWrapper.innerHTML = '';
      this._layoutInitialized[this._currentLayout] = false;
    }

    // Init this layout if first time
    if (!this._layoutInitialized[layoutName]) {
      const html = await this._fetchTemplate(layout.templateUrl);
      let wrapper = document.getElementById('user-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'user-wrapper';
        document.getElementById('shell-outlet').appendChild(wrapper);
      }
      wrapper.innerHTML = html;
      if (layout.onInit) await layout.onInit();
      this._layoutInitialized[layoutName] = true;
    }

    // Ensure user-wrapper is visible
    const wrapper = document.getElementById('user-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    this._currentLayout = layoutName;

    // Mount the component template into the layout's shell-content
    const outlet = document.getElementById('shell-content');
    if (!outlet) throw new Error('No se encontró #shell-content en el layout');
    const componentHtml = await this._fetchTemplate(component.templateUrl);
    outlet.innerHTML = componentHtml;
    await this._injectStyles(component);
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

  _updateSidebarActive(path) {
    document.querySelectorAll('#sidebarnav .sidebar-item').forEach((item) => {
      const link = item.querySelector('.sidebar-link');
      if (!link) return;
      const href = link.getAttribute('href');
      const active = href === `#${path}`;
      link.classList.toggle('active', active);
      item.classList.toggle('selected', active);
    });
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
