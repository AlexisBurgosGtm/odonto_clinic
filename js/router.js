/**
 * Router SPA basado en hash (#/ruta)
 */
export class Router {
  constructor(routes) {
    this.routes = routes;
    this.currentView = null;
    this.onRouteChange = null;

    window.addEventListener('hashchange', () => this.resolve());
  }

  /**
   * Navega a una ruta
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Resuelve la ruta actual y ejecuta el callback
   */
  resolve() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const route = this.routes[hash] || this.routes['/dashboard'];

    if (this.onRouteChange) {
      this.onRouteChange(route, hash);
    }

    this.currentView = route;
    return route;
  }

  /**
   * Inicia el router
   */
  start() {
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      this.resolve();
    }
  }
}
