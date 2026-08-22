import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { isViewMounted } from '../utils/view.js';
import { cleanupFloatingUi } from '../utils/floating-ui.js';
import {
  renderPacienteOdontograma,
  bindPacienteOdontograma,
} from './paciente-odontograma.js';
import {
  renderPacienteTratamientos,
  bindPacienteTratamientos,
} from './paciente-tratamientos.js';
import {
  renderPacienteEstadoCuenta,
  bindPacienteEstadoCuenta,
} from './paciente-estado-cuenta.js';

const D_FIELDS = [
  { key: 'D_ALERGIAS', label: 'Alergias' },
  { key: 'D_ASMA', label: 'Asma' },
  { key: 'D_HEPATITIS', label: 'Hepatitis' },
  { key: 'D_ANTIBIOTICOS', label: 'Antibióticos' },
  { key: 'D_VIH', label: 'VIH' },
  { key: 'D_HIPERTENSION', label: 'Hipertensión' },
  { key: 'D_HIPOTENSION', label: 'Hipotensión' },
  { key: 'D_TUBERCULOSIS', label: 'Tuberculosis' },
];

const E_FIELDS = [
  { key: 'E_MEDICAMENTOS', label: 'Medicamentos' },
  { key: 'E_SENSIBILIDAD_MEDICAMENTOS', label: 'Sensibilidad' },
  { key: 'E_DETALLES', label: 'Detalles' },
];

const TABS = [
  { id: 'odontograma', label: 'Odontograma', icon: 'fa-teeth' },
  { id: 'tratamientos', label: 'Tratamientos', icon: 'fa-list' },
  { id: 'estado-cuenta', label: 'Estado de cuenta', icon: 'fa-file-invoice-dollar' },
  { id: 'citas', label: 'Citas', icon: 'fa-calendar-days' },
];

let codpacienteActual = null;
let pacienteActual = null;
let tabActual = 'odontograma';
let viewGenActual = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calcEdad(nacimiento) {
  if (!nacimiento) return '—';
  const d = new Date(`${String(nacimiento).split('T')[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad -= 1;
  if (edad < 0) return '—';
  return `${edad} año${edad === 1 ? '' : 's'}`;
}

function tipoPacienteLabel(value) {
  return (value || 'ADULTO') === 'NINO' ? 'Niño' : 'Adulto';
}

function tipoPacienteBadge(value) {
  const esNino = (value || 'ADULTO') === 'NINO';
  return `
    <span class="badge-denticion ${esNino ? 'badge-denticion-nino' : 'badge-denticion-adulto'}">
      <i class="fa-solid ${esNino ? 'fa-child' : 'fa-user'}"></i>
      ${esNino ? 'Niño' : 'Adulto'}
    </span>
  `;
}

function siNoChip(value, label) {
  const isSi = value === 'SI';
  return `
    <span class="detalle-antecedente-chip ${isSi ? 'is-si' : 'is-no'}" title="${escapeHtml(label)}: ${isSi ? 'SI' : 'NO'}">
      <i class="fa-solid ${isSi ? 'fa-circle-check' : 'fa-circle'}"></i>
      ${escapeHtml(label)}
    </span>
  `;
}

function formatFechaHora(fecha) {
  if (!fecha) return '—';
  const raw = String(fecha).replace('T', ' ').slice(0, 16);
  const [datePart, timePart] = raw.split(' ');
  if (!datePart) return raw;
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}${timePart ? ` ${timePart}` : ''}`;
}

function statusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FINALIZADO' || s === 'FINALIZADA') {
    return '<span class="badge-estado badge-estado-activo">Finalizada</span>';
  }
  if (s === 'CANCELADO' || s === 'CANCELADA') {
    return '<span class="badge-estado badge-estado-inactivo">Cancelada</span>';
  }
  return '<span class="badge-estado badge-estado-pendiente">Pendiente</span>';
}

function renderHeader(paciente) {
  const antecedentes = D_FIELDS.map((f) => siNoChip(paciente[f.key] || 'NO', f.label)).join('');
  const extras = E_FIELDS
    .map((f) => {
      const val = String(paciente[f.key] || '').trim();
      if (!val) return '';
      return `<div class="detalle-extra-line"><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(val)}</div>`;
    })
    .filter(Boolean)
    .join('');

  return `
    <div class="paciente-detalle-header">
      <div class="paciente-detalle-identidad">
        <div class="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
          <button type="button" class="btn btn-sm btn-outline-secondary btn-rounded" id="btnVolverListaPacientes">
            <i class="fa-solid fa-arrow-left me-1"></i>Pacientes
          </button>
          ${tipoPacienteBadge(paciente.TIPO_PACIENTE)}
        </div>
        <h4 class="paciente-detalle-nombre mb-2">${escapeHtml(paciente.NOMBRE || 'Paciente')}</h4>
        <div class="paciente-detalle-meta">
          <span><i class="fa-solid fa-phone me-1"></i>${escapeHtml(paciente.TELEFONOS || 'Sin teléfono')}</span>
          <span><i class="fa-solid fa-cake-candles me-1"></i>${escapeHtml(calcEdad(paciente.NACIMIENTO))}</span>
          <span><i class="fa-solid fa-tooth me-1"></i>${escapeHtml(tipoPacienteLabel(paciente.TIPO_PACIENTE))}</span>
        </div>
      </div>
      <div class="paciente-detalle-antecedentes">
        <div class="paciente-detalle-antecedentes-title">Antecedentes médicos</div>
        <div class="detalle-antecedentes-chips">${antecedentes}</div>
        ${extras ? `<div class="detalle-extras mt-2">${extras}</div>` : ''}
      </div>
    </div>
  `;
}

function renderTabs(activeTab) {
  return `
    <div class="paciente-detalle-tabs" role="tablist">
      ${TABS.map((tab) => `
        <button
          type="button"
          class="paciente-detalle-tab ${tab.id === activeTab ? 'is-active' : ''}"
          data-detalle-tab="${tab.id}"
          role="tab"
          aria-selected="${tab.id === activeTab ? 'true' : 'false'}"
        >
          <i class="fa-solid ${tab.icon} me-1"></i>${tab.label}
        </button>
      `).join('')}
    </div>
  `;
}

function renderCitasHtml(citas) {
  if (!citas.length) {
    return '<p class="text-center text-muted py-4 mb-0">No hay citas registradas para este paciente</p>';
  }

  return `
    <div class="table-responsive">
      <table class="table table-hover crud-table mb-0">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Médico</th>
            <th>Motivo</th>
            <th>Estado</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${citas.map((c) => `
            <tr>
              <td>${escapeHtml(formatFechaHora(c.FECHA))}</td>
              <td>${escapeHtml(c.MEDICO || '—')}</td>
              <td>${escapeHtml(c.MOTIVO || '—')}</td>
              <td>${statusBadge(c.STATUS)}</td>
              <td>${escapeHtml(c.OBS || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderPacienteDetalle() {
  return `
    <div id="pacienteDetalleAlert"></div>
    <div class="view-paciente-detalle" id="pacienteDetalleRoot">
      <div class="content-card paciente-detalle-header-card" id="pacienteDetalleHeader">
        <p class="text-muted mb-0 py-3 text-center">Cargando paciente...</p>
      </div>
      <div class="content-card mt-3 paciente-detalle-tabs-card">
        <div id="pacienteDetalleTabs">${renderTabs('odontograma')}</div>
        <div class="paciente-detalle-panel paciente-detalle-embed" id="pacienteDetallePanel">
          <p class="text-muted text-center py-4 mb-0">Cargando...</p>
        </div>
      </div>
    </div>
  `;
}

function bindTabClicks() {
  document.querySelectorAll('[data-detalle-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.detalleTab;
      if (!tab || tab === tabActual) return;
      mountTab(tab);
    });
  });
}

function wireEmbeddedNav(panel) {
  panel.querySelector('#btnVolverPacientesOdo')?.classList.add('d-none');
  panel.querySelectorAll('#btnVolverPacientes').forEach((btn) => btn.classList.add('d-none'));

  const linkTrat = panel.querySelector('#btnIrTratamientosOdo');
  if (linkTrat) {
    linkTrat.href = '#';
    linkTrat.addEventListener('click', (e) => {
      e.preventDefault();
      mountTab('tratamientos');
    });
  }

  const linkOdo = panel.querySelector('#btnIrOdontograma');
  if (linkOdo) {
    linkOdo.href = '#';
    linkOdo.addEventListener('click', (e) => {
      e.preventDefault();
      mountTab('odontograma');
    });
  }
}

async function mountCitasTab(panel) {
  panel.innerHTML = '<p class="text-muted text-center py-4 mb-0">Cargando citas...</p>';
  try {
    const citas = await api.agenda.listByPaciente(codpacienteActual);
    if (viewGenActual && !isViewMounted(viewGenActual)) return;
    panel.innerHTML = renderCitasHtml(citas || []);
  } catch (error) {
    if (!viewGenActual || isViewMounted(viewGenActual)) {
      panel.innerHTML = `<p class="text-danger text-center py-4 mb-0">${escapeHtml(error.message)}</p>`;
    }
  }
}

async function mountTab(tabId) {
  tabActual = tabId;
  const tabsHost = document.getElementById('pacienteDetalleTabs');
  const panel = document.getElementById('pacienteDetallePanel');
  if (!panel) return;

  if (tabsHost) tabsHost.innerHTML = renderTabs(tabActual);
  bindTabClicks();

  cleanupFloatingUi();
  panel.className = 'paciente-detalle-panel paciente-detalle-embed';

  const params = { codpaciente: codpacienteActual, viewGen: viewGenActual };

  if (tabId === 'odontograma') {
    panel.innerHTML = renderPacienteOdontograma();
    await bindPacienteOdontograma(params);
    if (viewGenActual && !isViewMounted(viewGenActual)) return;
    wireEmbeddedNav(panel);
    return;
  }

  if (tabId === 'tratamientos') {
    panel.innerHTML = renderPacienteTratamientos();
    await bindPacienteTratamientos(params);
    if (viewGenActual && !isViewMounted(viewGenActual)) return;
    wireEmbeddedNav(panel);
    return;
  }

  if (tabId === 'estado-cuenta') {
    panel.innerHTML = renderPacienteEstadoCuenta();
    await bindPacienteEstadoCuenta(params);
    if (viewGenActual && !isViewMounted(viewGenActual)) return;
    wireEmbeddedNav(panel);
    return;
  }

  if (tabId === 'citas') {
    await mountCitasTab(panel);
  }
}

export async function bindPacienteDetalle(params = {}) {
  const { viewGen } = params;
  viewGenActual = viewGen;
  codpacienteActual = params.codpaciente;
  pacienteActual = null;
  tabActual = params.tab || 'odontograma';

  if (!codpacienteActual) {
    window.location.hash = '#/pacientes';
    return;
  }

  try {
    pacienteActual = await api.pacientes.get(codpacienteActual);
    if (viewGen && !isViewMounted(viewGen)) return;

    const header = document.getElementById('pacienteDetalleHeader');
    if (header) header.innerHTML = renderHeader(pacienteActual);

    document.getElementById('btnVolverListaPacientes')?.addEventListener('click', () => {
      window.location.hash = '#/pacientes';
    });

    clearAlert('pacienteDetalleAlert');
    await mountTab(tabActual);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('pacienteDetalleAlert', error.message);
    }
  }
}
