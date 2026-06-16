/**
 * Hash-based SPA Router — reemplaza al RouterModule de Angular.
 *
 * Rutas con hash:
 *   #/login      → LoginComponent
 *   #/dashboard  → DashboardComponent
 *
 * Cada ruta puede tener guards (como Angular canActivate).
 */
class Router {
  constructor() {
    this.routes = [];
    this.currentComponent = null;
    this.outletSelector = 'router-outlet';
    this._boundResolve = () => this.resolve();
  }

  /**
   * Registrar una ruta.
   * @param {string} pattern - hash path, ej: '/login'
   * @param {object} component - objeto con templateUrl, onInit, onDestroy
   * @param {Array} guards - opcional, array de { canActivate() }
   */
  addRoute(pattern, component, guards = []) {
    this.routes.push({ pattern, component, guards });
  }

  /** Navegar a una ruta */
  navigate(path) {
    window.location.hash = `#${path}`;
  }

  /** Resolver la ruta actual */
  async resolve() {
    let path = window.location.hash.slice(1) || '/';

    if (path === '/') {
      this.navigate('/login');
      return;
    }

    const route = this.routes.find(r => r.pattern === path);
    if (!route) {
      this.navigate('/login');
      return;
    }

    const { component, guards } = route;

    // Ejecutar guards (como canActivate de Angular)
    for (const guard of guards) {
      const canProceed = await guard.canActivate();
      if (canProceed === false) return;
    }

    // Destruir componente actual
    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this._cleanupStyles(this.currentComponent);
    }

    // Montar nuevo componente
    this.currentComponent = component;
    await this._mount(component);
    await component.onInit();
  }

  async _mount(component) {
    const outlet = document.getElementById(this.outletSelector);
    if (!outlet) throw new Error(`No se encontró <router-outlet>`);

    // Fetch template HTML
    const html = await this._fetchTemplate(component.templateUrl);
    outlet.innerHTML = html;

    // Inject CSS
    if (component.styleUrl) {
      const css = await this._fetchTemplate(component.styleUrl);
      const id = `style-${Date.now()}`;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
      component._styleId = id;
    }
  }

  _cleanupStyles(component) {
    if (component._styleId) {
      const el = document.getElementById(component._styleId);
      if (el) el.remove();
      delete component._styleId;
    }
  }

  async _fetchTemplate(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error loading ${url}: ${res.status}`);
    return res.text();
  }

  /** Iniciar el router */
  init() {
    window.addEventListener('hashchange', this._boundResolve);
    this.resolve();
  }

  /** Destruir el router (cleanup) */
  destroy() {
    window.removeEventListener('hashchange', this._boundResolve);
    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this._cleanupStyles(this.currentComponent);
    }
  }
}

export const router = new Router();
