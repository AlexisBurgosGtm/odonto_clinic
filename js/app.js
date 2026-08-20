/**
 * Clínica Dental — Aplicación SPA
 * Punto de entrada principal
 */
import { Router } from './router.js';
import { api } from './services/api.js';
import { setSession, clearSession, getSession } from './services/session.js';
import { setSessionLogoFromHex, clearSessionLogo } from './utils/empresa-logo.js';
import { getMenuForRole, getDefaultRoute, isRouteAllowed } from './utils/roles.js';
import { bumpViewGeneration, isViewCurrent } from './utils/view.js';
import { renderLogin, bindLoginEvents } from './views/login.js';
import { renderDashboard, bindDashboard } from './views/dashboard.js';
import { renderAgenda, bindAgenda, cleanupAgenda } from './views/agenda.js';
import { renderPacientes, bindPacientes } from './views/pacientes.js';
import { renderRecetas, bindRecetas } from './views/recetas.js';
import { renderCumpleaneros, bindCumpleaneros } from './views/cumpleaneros.js';
import { renderPacienteTratamientos, bindPacienteTratamientos } from './views/paciente-tratamientos.js';
import { renderPacienteOdontograma, bindPacienteOdontograma } from './views/paciente-odontograma.js';
import { renderTratamientos, bindTratamientos } from './views/tratamientos.js';
import { renderTransacciones, bindTransacciones } from './views/transacciones.js';
import { renderPacienteEstadoCuenta, bindPacienteEstadoCuenta } from './views/paciente-estado-cuenta.js';
import { renderEmpleados, bindEmpleados } from './views/empleados.js';
import { renderEmpresas, bindEmpresas } from './views/empresas.js';
import { renderConfiguraciones, bindConfiguraciones } from './views/configuraciones.js';
import { renderDocumentos, bindDocumentos } from './views/documentos.js';
import { renderCredencialesFel, bindCredencialesFel } from './views/credenciales-fel.js';
import { renderGastos, bindGastos } from './views/gastos.js';
import { renderReportes, bindReportes } from './views/reportes.js';
import { alertError, confirmAction } from './utils/swal.js';
import { cleanupFloatingUi } from './utils/floating-ui.js';
import { initThemeSystem, mountThemeSelector, unmountThemeSelector } from './utils/themes.js';

/* ─── Mapa de rutas → renderers ────────────── */
const routes = {
  '/dashboard':       { title: 'Inicio',          render: renderDashboard, bind: bindDashboard },
  '/agenda':          { title: 'Agenda',          render: renderAgenda, bind: bindAgenda },
  '/pacientes':       { title: 'Pacientes',       render: renderPacientes, bind: bindPacientes },
  '/recetas':         { title: 'Recetas',         render: renderRecetas, bind: bindRecetas },
  '/cumpleaneros':    { title: 'Cumpleañeros',    render: renderCumpleaneros, bind: bindCumpleaneros },
  '/pacientes/:codpaciente/odontograma': {
    title: 'Odontograma',
    getTitle: (params) => `Odontograma — Paciente #${params.codpaciente || ''}`,
    render: renderPacienteOdontograma,
    bind: bindPacienteOdontograma,
  },
  '/pacientes/:codpaciente/tratamientos': {
    title: 'Tratamientos del paciente',
    getTitle: (params) => `Tratamientos — Paciente #${params.codpaciente || ''}`,
    render: renderPacienteTratamientos,
    bind: bindPacienteTratamientos,
  },
  '/pacientes/:codpaciente/estado-cuenta': {
    title: 'Estado de cuenta',
    getTitle: (params) => `Estado de cuenta — Paciente #${params.codpaciente || ''}`,
    render: renderPacienteEstadoCuenta,
    bind: bindPacienteEstadoCuenta,
  },
  '/transacciones':   { title: 'Transacciones',   render: renderTransacciones, bind: bindTransacciones },
  '/gastos':          { title: 'Gastos',          render: renderGastos, bind: bindGastos },
  '/reportes':        { title: 'Reportes',        render: renderReportes, bind: bindReportes },
  '/tratamientos':    { title: 'Tratamientos',    render: renderTratamientos, bind: bindTratamientos },
  '/empleados':       { title: 'Empleados',       render: renderEmpleados, bind: bindEmpleados },
  '/empresas':        { title: 'Empresas',        render: renderEmpresas, bind: bindEmpresas },
  '/documentos':        { title: 'Documentos',        render: renderDocumentos, bind: bindDocumentos },
  '/credenciales-fel':  { title: 'Credenciales FEL',  render: renderCredencialesFel, bind: bindCredencialesFel },
  '/configuraciones': { title: 'Configuraciones', render: renderConfiguraciones, bind: bindConfiguraciones },
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
    </aside>

    <div class="main-content">
      <header class="topbar">
        <button class="btn-menu-toggle" id="btnMenuToggle" aria-label="Abrir menú">
          <i class="fa-solid fa-bars"></i>
        </button>
        <span class="topbar-title" id="topbarTitle">${defaultTitle}</span>
        <div class="topbar-user">
          <div id="themeSelectorMount" class="topbar-theme-mount"></div>
          <div class="topbar-user-avatar">
            <i class="fa-solid fa-user"></i>
          </div>
          <span class="topbar-user-name">${session?.empleado || 'Usuario'}</span>
          <button class="btn-logout-topbar" id="btnLogout" type="button" title="Cerrar sesión">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span class="btn-logout-topbar-text">Cerrar sesión</span>
          </button>
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
  mountThemeSelector();
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
    requestLogout();
  });
}

async function requestLogout() {
  const confirmed = await confirmAction({
    title: '¿Cerrar sesión?',
    text: '¿Desea salir del sistema?',
    icon: 'question',
    confirmText: 'Salir',
    cancelText: 'Cancelar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  logout();
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
    cleanupFloatingUi();
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
  cleanupAgenda();
  cleanupFloatingUi();
  unmountThemeSelector();
  clearSessionLogo();
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
    empresaDireccion: data.empresaDireccion || null,
    empresaTelefonos: data.empresaTelefonos || null,
  });

  clearSessionLogo();

  try {
    const logoData = await api.empresas.getLogo(data.empnit);
    if (logoData?.LOGO) {
      setSessionLogoFromHex(logoData.LOGO);
    }
  } catch (_) {
    /* usar logo por defecto */
  }

  renderLayout();
}

function logout() {
  clearSessionLogo();
  clearSession();
  window.location.hash = '';
  showLogin();
}

/* ─── Inicio — F5 siempre vuelve al login ──── */
function init() {
  initThemeSystem();
  clearSessionLogo();
  clearSession();
  window.location.hash = '';
  showLogin();
}

init();

