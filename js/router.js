/**
 * Router SPA basado en hash (#/ruta)
 */
export class Router {
  constructor(routes, defaultRoute = '/dashboard') {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
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
    const hash = window.location.hash.slice(1) || this.defaultRoute;
    let route = this.routes[hash];
    let path = hash;
    const params = {};

    if (!route) {
      for (const [pattern, candidate] of Object.entries(this.routes)) {
        if (!pattern.includes(':')) continue;

        const paramNames = [];
        const regex = new RegExp(
          `^${pattern.replace(/:(\w+)/g, (_, name) => {
            paramNames.push(name);
            return '([^/]+)';
          })}$`
        );

        const match = hash.match(regex);
        if (!match) continue;

        route = candidate;
        path = hash;
        paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        break;
      }
    }

    if (!route) {
      route = this.routes[this.defaultRoute] || this.routes['/dashboard'];
      path = this.defaultRoute;
    }

    if (this.onRouteChange) {
      this.onRouteChange(route, path, params);
    }

    this.currentView = route;
    return { route, path, params };
  }

  /**
   * Inicia el router
   */
  start() {
    if (!window.location.hash) {
      window.location.hash = `#${this.defaultRoute}`;
    } else {
      this.resolve();
    }
  }
}
