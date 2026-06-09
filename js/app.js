/**
 * Clínica Dental — Aplicación SPA
 * Punto de entrada principal
 */
import { Router } from './router.js';
import { api } from './services/api.js';
import { setSession, clearSession, getSession } from './services/session.js';
import { getMenuForRole, getDefaultRoute, isRouteAllowed } from './utils/roles.js';
import { bumpViewGeneration, isViewCurrent } from './utils/view.js';
import { renderLogin, bindLoginEvents } from './views/login.js';
import { renderDashboard, bindDashboard } from './views/dashboard.js';
import { renderAgenda, bindAgenda, cleanupAgenda } from './views/agenda.js';
import { renderPacientes, bindPacientes } from './views/pacientes.js';
import { renderPacienteTratamientos, bindPacienteTratamientos } from './views/paciente-tratamientos.js';
import { renderTratamientos, bindTratamientos } from './views/tratamientos.js';
import { renderEmpleados, bindEmpleados } from './views/empleados.js';
import { renderEmpresas, bindEmpresas } from './views/empresas.js';
import { renderConfiguraciones } from './views/configuraciones.js';
import { alertError } from './utils/swal.js';

/* ─── Mapa de rutas → renderers ────────────── */
const routes = {
  '/dashboard':       { title: 'Inicio',          render: renderDashboard, bind: bindDashboard },
  '/agenda':          { title: 'Agenda',          render: renderAgenda, bind: bindAgenda },
  '/pacientes':       { title: 'Pacientes',       render: renderPacientes, bind: bindPacientes },
  '/pacientes/:codpaciente/tratamientos': {
    title: 'Tratamientos del paciente',
    getTitle: (params) => `Tratamientos — Paciente #${params.codpaciente || ''}`,
    render: renderPacienteTratamientos,
    bind: bindPacienteTratamientos,
  },
  '/tratamientos':    { title: 'Tratamientos',    render: renderTratamientos, bind: bindTratamientos },
  '/empleados':       { title: 'Empleados',       render: renderEmpleados, bind: bindEmpleados },
  '/empresas':        { title: 'Empresas',        render: renderEmpresas, bind: bindEmpresas },
  '/configuraciones': { title: 'Configuraciones', render: renderConfiguraciones },
};

let router = null;
const app = document.getElementById('app');

/* ─── Renderizado del layout principal ─────── */
function renderLayout() {
  const session = getSession();
  const menuItems = getMenuForRole(session?.tipo);

  const navCards = menuItems.map(item => `
    <a
      href="#${item.path}"
      class="nav-card"
      data-path="${item.path}"
    >
      <div class="nav-card-icon">
        <i class="${item.icon}"></i>
      </div>
      <span class="nav-card-label">${item.label}</span>
    </a>
  `).join('');

  const defaultTitle = getDefaultRoute(session?.tipo) === '/dashboard' ? 'Inicio' : 'Agenda';

  app.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand-icon">
          <i class="fa-solid fa-tooth"></i>
        </div>
        <div class="sidebar-brand-text">
          Clínica Dental
          <small>${session?.empresa || 'Sistema de gestión'}</small>
        </div>
      </div>

      <nav class="sidebar-nav" id="sidebarNav">
        ${navCards}
      </nav>

      <div class="sidebar-footer">
        <button class="btn-logout" id="btnLogout">
          <i class="fa-solid fa-right-from-bracket"></i>
          Cerrar sesión
        </button>
      </div>
    </aside>

    <div class="main-content">
      <header class="topbar">
        <button class="btn-menu-toggle" id="btnMenuToggle" aria-label="Abrir menú">
          <i class="fa-solid fa-bars"></i>
        </button>
        <span class="topbar-title" id="topbarTitle">${defaultTitle}</span>
        <div class="topbar-user">
          <div class="topbar-user-avatar">
            <i class="fa-solid fa-user"></i>
          </div>
          <span class="topbar-user-name">${session?.empleado || 'Usuario'}</span>
        </div>
      </header>

      <main class="view-container" id="viewContainer"></main>
    </div>

    <button class="btn-menu-fab" id="btnMenuFab" aria-label="Abrir menú">
      <i class="fa-solid fa-bars"></i>
      <span>Menú</span>
    </button>
  `;

  bindLayoutEvents();
  initRouter();
}

/* ─── Eventos del layout ───────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('active');
}

function bindLayoutEvents() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btnLogout = document.getElementById('btnLogout');

  document.getElementById('btnMenuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('btnMenuFab')?.addEventListener('click', toggleSidebar);

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  document.getElementById('sidebarNav')?.addEventListener('click', () => {
    if (window.innerWidth < 992) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  btnLogout?.addEventListener('click', () => {
    logout();
  });
}

/* ─── Router e inyección de vistas ─────────── */
function initRouter() {
  const defaultRoute = getDefaultRoute(getSession()?.tipo);
  router = new Router(routes, defaultRoute);

  router.onRouteChange = (route, path, params) => {
    const session = getSession();
    if (!isRouteAllowed(session?.tipo, path)) {
      router.navigate(defaultRoute);
      return;
    }
    renderView(route, path, params);
  };

  router.start();
}

function renderView(route, path, params = {}) {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const viewGen = bumpViewGeneration();

  const inject = () => {
    if (!isViewCurrent(viewGen)) return;

    cleanupAgenda();
    document.getElementById('btnPrintOrders')?.remove();
    container.innerHTML = `<div class="view-enter" data-view-gen="${viewGen}">${route.render(params)}</div>`;

    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle) {
      topbarTitle.textContent = route.getTitle?.(params) || route.title;
    }

    updateActiveNav(path);

    const bindParams = { ...params, viewGen };
    const bindResult = route.bind?.(bindParams);
    if (bindResult?.catch) {
      bindResult.catch((error) => {
        if (isViewCurrent(viewGen)) {
          alertError(error.message);
        }
      });
    }
  };

  const currentContent = container.firstElementChild;

  if (currentContent?.classList.contains('view-exit')) {
    inject();
    return;
  }

  if (currentContent) {
    currentContent.classList.add('view-exit');
    currentContent.addEventListener('animationend', inject, { once: true });
  } else {
    inject();
  }
}

function updateActiveNav(path) {
  const basePath = path.startsWith('/pacientes') ? '/pacientes' : path;

  document.querySelectorAll('.nav-card').forEach(card => {
    card.classList.toggle('active', card.dataset.path === basePath);
  });
}

/* ─── Autenticación ────────────────────────── */
function showLogin() {
  app.innerHTML = renderLogin();
  bindLoginEvents(handleLogin);
}

async function handleLogin(usuario, clave) {
  const data = await api.login(usuario, clave);

  setSession({
    codemp: data.codemp,
    empnit: data.empnit,
    empleado: data.empleado,
    tipo: data.tipo,
    usuario: data.usuario,
    empresa: data.empresa,
  });

  renderLayout();
}

function logout() {
  clearSession();
  window.location.hash = '';
  showLogin();
}

/* ─── Inicio — F5 siempre vuelve al login ──── */
function init() {
  clearSession();
  window.location.hash = '';
  showLogin();
}

init();

