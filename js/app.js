/**
 * Clínica Dental — Aplicación SPA
 * Punto de entrada principal
 */
import { Router } from './router.js';
import { api } from './services/api.js';
import { setSession, clearSession, getSession } from './services/session.js';
import { renderLogin, bindLoginEvents } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderAgenda, bindAgenda } from './views/agenda.js';
import { renderPacientes, bindPacientes } from './views/pacientes.js';
import { renderTratamientos } from './views/tratamientos.js';
import { renderEmpleados, bindEmpleados } from './views/empleados.js';
import { renderEmpresas, bindEmpresas } from './views/empresas.js';
import { renderConfiguraciones } from './views/configuraciones.js';

/* ─── Configuración del menú ───────────────── */
const MENU_ITEMS = [
  { path: '/dashboard',       label: 'Dashboard',       icon: 'fa-solid fa-chart-line' },
  { path: '/agenda',          label: 'Agenda',          icon: 'fa-solid fa-calendar-days' },
  { path: '/pacientes',       label: 'Pacientes',       icon: 'fa-solid fa-users' },
  { path: '/tratamientos',    label: 'Tratamientos',    icon: 'fa-solid fa-tooth' },
  { path: '/empleados',       label: 'Empleados',       icon: 'fa-solid fa-user-doctor' },
  { path: '/empresas',        label: 'Empresas',        icon: 'fa-solid fa-building' },
  { path: '/configuraciones', label: 'Configuraciones', icon: 'fa-solid fa-gear' },
];

/* ─── Mapa de rutas → renderers ────────────── */
const routes = {
  '/dashboard':       { title: 'Dashboard',       render: renderDashboard },
  '/agenda':          { title: 'Agenda',          render: renderAgenda, bind: bindAgenda },
  '/pacientes':       { title: 'Pacientes',       render: renderPacientes, bind: bindPacientes },
  '/tratamientos':    { title: 'Tratamientos',    render: renderTratamientos },
  '/empleados':       { title: 'Empleados',       render: renderEmpleados, bind: bindEmpleados },
  '/empresas':        { title: 'Empresas',        render: renderEmpresas, bind: bindEmpresas },
  '/configuraciones': { title: 'Configuraciones', render: renderConfiguraciones },
};

let router = null;
const app = document.getElementById('app');

/* ─── Renderizado del layout principal ─────── */
function renderLayout() {
  const session = getSession();

  const navCards = MENU_ITEMS.map(item => `
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
        <span class="topbar-title" id="topbarTitle">Dashboard</span>
        <div class="topbar-user">
          <div class="topbar-user-avatar">
            <i class="fa-solid fa-user"></i>
          </div>
          <span class="topbar-user-name">${session?.empleado || 'Usuario'}</span>
        </div>
      </header>

      <main class="view-container" id="viewContainer"></main>
    </div>
  `;

  bindLayoutEvents();
  initRouter();
}

/* ─── Eventos del layout ───────────────────── */
function bindLayoutEvents() {
  const btnMenuToggle = document.getElementById('btnMenuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btnLogout = document.getElementById('btnLogout');

  btnMenuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

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
  router = new Router(routes);

  router.onRouteChange = (route, path) => {
    renderView(route, path);
  };

  router.start();
}

function renderView(route, path) {
  const container = document.getElementById('viewContainer');
  const topbarTitle = document.getElementById('topbarTitle');
  if (!container) return;

  const currentContent = container.firstElementChild;

  const inject = () => {
    container.innerHTML = `<div class="view-enter">${route.render()}</div>`;
    topbarTitle.textContent = route.title;
    updateActiveNav(path);
    route.bind?.();
  };

  if (currentContent) {
    currentContent.classList.add('view-exit');
    currentContent.addEventListener('animationend', inject, { once: true });
  } else {
    inject();
  }
}

function updateActiveNav(path) {
  document.querySelectorAll('.nav-card').forEach(card => {
    card.classList.toggle('active', card.dataset.path === path);
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
