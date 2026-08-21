import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog, SwalTheme } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { mountNuevoFab } from '../utils/nuevo-fab.js';
import { canManagePacientes } from '../utils/roles.js';
import { formatLocalDateTime, localNowDatetime } from '../utils/datetime.js';

let pacientes = [];
let filtroBusqueda = '';

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
  { key: 'E_MEDICAMENTOS', label: 'Medicamentos', maxLength: 500 },
  { key: 'E_SENSIBILIDAD_MEDICAMENTOS', label: 'Sensibilidad a medicamentos', maxLength: 500 },
  { key: 'E_DETALLES', label: 'Detalles', textarea: true },
];

function fieldId(key) {
  return `swal-${key.toLowerCase()}`;
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatProximaCita(cita) {
  if (!cita?.FECHA) return 'Sin cita programada';

  const fecha = formatLocalDateTime(cita.FECHA);
  const medico = cita.MEDICO ? ` · ${cita.MEDICO}` : '';
  return `${fecha}${medico}`;
}

function toInputDate(fecha) {
  if (!fecha) return '';
  return String(fecha).split('T')[0];
}

function siNoBadgeHtml(field, value = 'NO') {
  const isSi = value === 'SI';

  return `
    <div
      class="si-no-badge-toggle"
      id="${fieldId(field)}"
      data-field="${field}"
      data-value="${isSi ? 'SI' : 'NO'}"
      title="Clic para cambiar"
    >
      <span class="badge-estado ${isSi ? 'badge-estado-activo' : 'badge-estado-inactivo'}">
        ${isSi ? 'SI' : 'NO'}
      </span>
    </div>
  `;
}

function updateSiNoBadge(group, value) {
  const normalized = value === 'SI' ? 'SI' : 'NO';
  group.dataset.value = normalized;

  const badge = group.querySelector('.badge-estado');
  if (!badge) return;

  badge.textContent = normalized;
  badge.classList.toggle('badge-estado-activo', normalized === 'SI');
  badge.classList.toggle('badge-estado-inactivo', normalized !== 'SI');
}

function bindSiNoBadges(root = document) {
  root.querySelectorAll('.si-no-badge-toggle').forEach((group) => {
    group.addEventListener('click', () => {
      const next = group.dataset.value === 'SI' ? 'NO' : 'SI';
      updateSiNoBadge(group, next);
    });
  });
}

function getSiNoValue(field) {
  const group = document.getElementById(fieldId(field));
  return group?.dataset.value === 'SI' ? 'SI' : 'NO';
}

function setSiNoValue(field, value) {
  const group = document.getElementById(fieldId(field));
  if (group) updateSiNoBadge(group, value);
}

function getPacientesFiltrados() {
  const query = filtroBusqueda.trim().toLowerCase();
  if (!query) return pacientes;

  return pacientes.filter((p) => {
    const texto = [
      p.CODPACIENTE,
      p.NOMBRE,
      p.DIRECCION,
      p.TELEFONOS,
      p.EMAIL,
      formatFecha(p.NACIMIENTO),
      tipoPacienteLabel(p.TIPO_PACIENTE),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return texto.includes(query);
  });
}

function tipoPacienteNorm(value) {
  return (value || 'ADULTO') === 'NINO' ? 'NINO' : 'ADULTO';
}

function tipoPacienteLabel(value) {
  return tipoPacienteNorm(value) === 'NINO' ? 'Niño' : 'Adulto';
}

function tipoPacienteBadgeListHtml(value) {
  const esNino = tipoPacienteNorm(value) === 'NINO';
  return `
    <span class="badge-denticion ${esNino ? 'badge-denticion-nino' : 'badge-denticion-adulto'}">
      <i class="fa-solid ${esNino ? 'fa-child' : 'fa-user'}"></i>
      ${esNino ? 'Niño' : 'Adulto'}
    </span>
  `;
}

function denticionBadgeHtml(tipo = 'ADULTO') {
  const esNino = tipoPacienteNorm(tipo) === 'NINO';
  return `
    <button
      type="button"
      id="swal-denticion-badge"
      class="denticion-badge ${esNino ? 'denticion-badge-nino' : 'denticion-badge-adulto'}"
      title="Clic para cambiar dentición"
      aria-label="Cambiar dentición"
    >
      <i class="fa-solid ${esNino ? 'fa-child' : 'fa-user'}"></i>
      <span>${esNino ? 'Niño' : 'Adulto'}</span>
    </button>
  `;
}

function updateDenticionBadge(tipo) {
  const badge = document.getElementById('swal-denticion-badge');
  if (!badge) return;

  const esNino = tipoPacienteNorm(tipo) === 'NINO';
  badge.classList.toggle('denticion-badge-nino', esNino);
  badge.classList.toggle('denticion-badge-adulto', !esNino);
  badge.innerHTML = `
    <i class="fa-solid ${esNino ? 'fa-child' : 'fa-user'}"></i>
    <span>${esNino ? 'Niño' : 'Adulto'}</span>
  `;
}

function setDenticionTipo(tipo) {
  const normalized = tipoPacienteNorm(tipo);
  const select = document.getElementById('swal-tipo-paciente');
  if (select) select.value = normalized;
  updateDenticionBadge(normalized);
}

function bindDenticionControls(root = document) {
  const select = root.querySelector('#swal-tipo-paciente') || document.getElementById('swal-tipo-paciente');
  const badge = root.querySelector('#swal-denticion-badge') || document.getElementById('swal-denticion-badge');

  select?.addEventListener('change', () => {
    updateDenticionBadge(select.value);
  });

  badge?.addEventListener('click', () => {
    const actual = tipoPacienteNorm(select?.value);
    setDenticionTipo(actual === 'NINO' ? 'ADULTO' : 'NINO');
  });
}

function siNoBadgeReadonly(value) {
  const isSi = value === 'SI';
  return `<span class="badge-estado ${isSi ? 'badge-estado-activo' : 'badge-estado-inactivo'}">${isSi ? 'SI' : 'NO'}</span>`;
}

function detalleItem(label, value, col = 'col-md-6') {
  const contenido = value || '—';
  return `
    <div class="${col}">
      <div class="detalle-item">
        <span class="detalle-label">${label}</span>
        <span class="detalle-value">${contenido}</span>
      </div>
    </div>
  `;
}

function pacienteDetalleHtml(paciente, proximaCita = null) {
  const dFieldsHtml = D_FIELDS.map(({ key, label }) =>
    detalleItem(label, siNoBadgeReadonly(paciente[key] || 'NO'), 'col-md-4')
  ).join('');

  const eFieldsHtml = E_FIELDS.map(({ key, label }) =>
    detalleItem(label, paciente[key], 'col-12')
  ).join('');

  const tipoPaciente = tipoPacienteLabel(paciente.TIPO_PACIENTE);

  return `
    <div class="swal-form text-start swal-form-wide paciente-detalle">
      <div class="row g-3">
        ${detalleItem('Nombre', paciente.NOMBRE, 'col-12')}
        ${detalleItem('Nacimiento', formatFecha(paciente.NACIMIENTO), 'col-md-4')}
        ${detalleItem('Dentición', tipoPacienteBadgeListHtml(paciente.TIPO_PACIENTE), 'col-md-4')}
        ${detalleItem('Teléfonos', paciente.TELEFONOS, 'col-md-4')}
        ${detalleItem('Email', paciente.EMAIL, 'col-md-4')}
        ${detalleItem('Dirección', paciente.DIRECCION, 'col-12')}
        ${detalleItem('Próxima cita', formatProximaCita(proximaCita), 'col-12')}
      </div>

      <div class="swal-form-section">
        <h6 class="swal-form-section-title">Antecedentes médicos</h6>
        <div class="row g-3">
          ${dFieldsHtml}
        </div>
      </div>

      <div class="swal-form-section">
        <h6 class="swal-form-section-title">Información adicional</h6>
        <div class="row g-3">
          ${eFieldsHtml}
        </div>
      </div>
    </div>
  `;
}

function collectExtraFields() {
  const body = {};

  D_FIELDS.forEach(({ key }) => {
    body[key] = getSiNoValue(key);
  });

  E_FIELDS.forEach(({ key }) => {
    const field = E_FIELDS.find((f) => f.key === key);
    body[key] = sanitizeText(document.getElementById(fieldId(key))?.value, {
      maxLength: field?.maxLength || 2000,
    });
  });

  return body;
}

export function renderPacientes() {
  return `
    <div id="pacientesAlert"></div>

    <div class="content-card view-pacientes">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-users me-2 text-primary"></i>Listado de pacientes</h5>
      </div>

      <div class="table-toolbar">
        <div class="table-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            type="search"
            id="pacientesSearch"
            class="form-control"
            placeholder="Buscar por nombre, teléfono, dentición, dirección..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="pacientes-desktop table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Nacimiento</th>
              <th>Dentición</th>
              <th>Dirección</th>
              <th>Teléfonos</th>
              <th class="text-end" style="width: 320px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="pacientesTableBody">
            <tr><td colspan="6" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pacientes-mobile" id="pacientesMobileList">
        <p class="text-center text-muted py-4 mb-0">Cargando...</p>
      </div>
    </div>
  `;
}

function pacienteFormHtml() {
  const dFieldsHtml = D_FIELDS.map(({ key, label }) => `
    <div class="col-md-4">
      <label class="form-label">${label}</label>
      ${siNoBadgeHtml(key)}
    </div>
  `).join('');

  const eFieldsHtml = E_FIELDS.map(({ key, label, maxLength, textarea }) => `
    <div class="col-12">
      <label class="form-label" for="${fieldId(key)}">${label}</label>
      ${textarea
        ? `<textarea id="${fieldId(key)}" class="form-control" rows="3" maxlength="${maxLength || 2000}"></textarea>`
        : `<input type="text" id="${fieldId(key)}" class="form-control" maxlength="${maxLength || 500}">`
      }
    </div>
  `).join('');

  return `
    <div class="swal-form text-start swal-form-wide" autocomplete="off">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label">Nombre <span class="text-danger">*</span></label>
          <input type="text" id="swal-nombre" class="form-control" maxlength="500" autocomplete="off">
        </div>
        <div class="col-md-4">
          <label class="form-label">Nacimiento</label>
          <input type="date" id="swal-nacimiento" class="form-control" autocomplete="off">
        </div>
        <div class="col-md-4">
          <label class="form-label">Dentición <span class="text-danger">*</span></label>
          <div class="denticion-field">
            <select id="swal-tipo-paciente" class="form-select">
              <option value="ADULTO">Adulto (FDI 1.1–4.8)</option>
              <option value="NINO">Niño (FDI 5.1–8.5)</option>
            </select>
            ${denticionBadgeHtml('ADULTO')}
          </div>
        </div>
        <div class="col-md-4">
          <label class="form-label">Teléfonos</label>
          <input type="text" id="swal-telefonos" class="form-control" maxlength="50" autocomplete="off">
        </div>
        <div class="col-md-4">
          <label class="form-label">Email</label>
          <input type="email" id="swal-email" class="form-control" maxlength="50" autocomplete="off">
        </div>
        <div class="col-12">
          <label class="form-label">Dirección</label>
          <input type="text" id="swal-direccion" class="form-control" maxlength="500" autocomplete="off">
        </div>
      </div>

      <div class="swal-form-section">
        <h6 class="swal-form-section-title">Antecedentes médicos</h6>
        <div class="row g-3">
          ${dFieldsHtml}
        </div>
      </div>

      <div class="swal-form-section">
        <h6 class="swal-form-section-title">Información adicional</h6>
        <div class="row g-3">
          ${eFieldsHtml}
        </div>
      </div>
    </div>
  `;
}

function resetPacienteForm() {
  document.getElementById('swal-nombre').value = '';
  document.getElementById('swal-nacimiento').value = '';
  setDenticionTipo('ADULTO');
  document.getElementById('swal-direccion').value = '';
  document.getElementById('swal-telefonos').value = '';
  document.getElementById('swal-email').value = '';

  D_FIELDS.forEach(({ key }) => setSiNoValue(key, 'NO'));

  E_FIELDS.forEach(({ key }) => {
    const input = document.getElementById(fieldId(key));
    if (input) input.value = '';
  });
}

function fillPacienteForm(paciente) {
  document.getElementById('swal-nombre').value = paciente.NOMBRE || '';
  document.getElementById('swal-nacimiento').value = toInputDate(paciente.NACIMIENTO);
  setDenticionTipo(paciente.TIPO_PACIENTE);
  document.getElementById('swal-direccion').value = paciente.DIRECCION || '';
  document.getElementById('swal-telefonos').value = paciente.TELEFONOS || '';
  document.getElementById('swal-email').value = paciente.EMAIL || '';

  D_FIELDS.forEach(({ key }) => {
    setSiNoValue(key, paciente[key] || 'NO');
  });

  E_FIELDS.forEach(({ key }) => {
    const input = document.getElementById(fieldId(key));
    if (input) input.value = paciente[key] || '';
  });
}

function renderPacienteAcciones(p, canManage, mobile = false) {
  const odontogramaContent = mobile && !canManage
    ? '<i class="fa-solid fa-teeth me-1"></i>Odontograma'
    : '<i class="fa-solid fa-teeth"></i>';

  return `
    <button class="btn btn-sm btn-outline-secondary btn-action" data-view="${p.CODPACIENTE}" title="Ver datos">
      <i class="fa-solid fa-eye"></i>
    </button>
    <button class="btn btn-sm btn-outline-info btn-action${mobile && !canManage ? ' btn-action-labeled' : ''}" data-odontograma="${p.CODPACIENTE}" title="Odontograma (cargar tratamientos)">
      ${odontogramaContent}
    </button>
    <button class="btn btn-sm btn-outline-primary btn-action" data-tratamientos="${p.CODPACIENTE}" title="Listado de tratamientos">
      <i class="fa-solid fa-list"></i>
    </button>
    <button class="btn btn-sm btn-outline-warning btn-action" data-estado-cuenta="${p.CODPACIENTE}" title="Estado de cuenta">
      <i class="fa-solid fa-file-invoice-dollar"></i>
    </button>
    ${canManage ? `
    <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${p.CODPACIENTE}" title="Editar">
      <i class="fa-solid fa-pen"></i>
    </button>
    <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${p.CODPACIENTE}" title="Eliminar">
      <i class="fa-solid fa-trash"></i>
    </button>
    ` : ''}
  `;
}

function handlePacientesListClick(e) {
  const viewBtn = e.target.closest('[data-view]');
  const odontogramaBtn = e.target.closest('[data-odontograma]');
  const tratamientosBtn = e.target.closest('[data-tratamientos]');
  const estadoCuentaBtn = e.target.closest('[data-estado-cuenta]');
  const editBtn = e.target.closest('[data-edit]');
  const deleteBtn = e.target.closest('[data-delete]');

  if (viewBtn) {
    const paciente = pacientes.find((p) => p.CODPACIENTE == viewBtn.dataset.view);
    if (paciente) openPacienteDetalle(paciente);
    return;
  }

  if (odontogramaBtn) {
    window.location.hash = `#/pacientes/${odontogramaBtn.dataset.odontograma}/odontograma`;
    return;
  }

  if (tratamientosBtn) {
    window.location.hash = `#/pacientes/${tratamientosBtn.dataset.tratamientos}/tratamientos`;
    return;
  }

  if (estadoCuentaBtn) {
    window.location.hash = `#/pacientes/${estadoCuentaBtn.dataset.estadoCuenta}/estado-cuenta`;
    return;
  }

  if (editBtn) {
    if (!canManagePacientes(getSession()?.tipo)) return;
    const paciente = pacientes.find((p) => p.CODPACIENTE == editBtn.dataset.edit);
    if (paciente) openPacienteForm('edit', paciente);
    return;
  }

  if (deleteBtn) {
    if (!canManagePacientes(getSession()?.tipo)) return;
    handleDelete(deleteBtn.dataset.delete);
  }
}

function renderTable() {
  const tbody = document.getElementById('pacientesTableBody');
  const mobileList = document.getElementById('pacientesMobileList');
  const filtrados = getPacientesFiltrados();
  const canManage = canManagePacientes(getSession()?.tipo);

  if (!tbody) return;

  if (pacientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No hay pacientes registrados</td>
      </tr>
    `;
    if (mobileList) {
      mobileList.innerHTML = '<p class="text-center text-muted py-4 mb-0">No hay pacientes registrados</p>';
    }
    return;
  }

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No se encontraron pacientes con ese criterio</td>
      </tr>
    `;
    if (mobileList) {
      mobileList.innerHTML = '<p class="text-center text-muted py-4 mb-0">No se encontraron pacientes con ese criterio</p>';
    }
    return;
  }

  tbody.innerHTML = filtrados.map((p) => `
    <tr>
      <td>${p.NOMBRE || '—'}</td>
      <td>${formatFecha(p.NACIMIENTO)}</td>
      <td>${tipoPacienteBadgeListHtml(p.TIPO_PACIENTE)}</td>
      <td>${p.DIRECCION || '—'}</td>
      <td>${p.TELEFONOS || '—'}</td>
      <td class="text-end">
        ${renderPacienteAcciones(p, canManage)}
      </td>
    </tr>
  `).join('');

  if (mobileList) {
    mobileList.innerHTML = filtrados.map((p) => `
      <article class="paciente-mobile-card">
        <div class="paciente-mobile-main">
          <h6 class="paciente-mobile-nombre">${p.NOMBRE || '—'}</h6>
          <p class="paciente-mobile-meta">
            ${tipoPacienteBadgeListHtml(p.TIPO_PACIENTE)}
            <span><i class="fa-solid fa-cake-candles me-1"></i>${formatFecha(p.NACIMIENTO)}</span>
            ${p.TELEFONOS ? `<span><i class="fa-solid fa-phone me-1"></i>${p.TELEFONOS}</span>` : ''}
          </p>
          ${p.DIRECCION ? `<p class="paciente-mobile-direccion"><i class="fa-solid fa-location-dot me-1"></i>${p.DIRECCION}</p>` : ''}
        </div>
        <div class="paciente-mobile-actions">
          ${renderPacienteAcciones(p, canManage, true)}
        </div>
      </article>
    `).join('');
  }
}

async function loadPacientes() {
  try {
    pacientes = await api.pacientes.list();
    renderTable();
    clearAlert('pacientesAlert');
  } catch (error) {
    showAlert('pacientesAlert', error.message);
  }
}

async function openPacienteDetalle(paciente) {
  await showPacienteDetalle(paciente);
}

export async function showPacienteDetalle(paciente) {
  let proximaCita = null;

  try {
    proximaCita = await api.agenda.proximaCita(paciente.CODPACIENTE, {
      desde: localNowDatetime(),
    });
  } catch (error) {
    await alertError(error.message);
    return;
  }

  SwalTheme.fire({
    title: 'Datos del paciente',
    html: pacienteDetalleHtml(paciente, proximaCita),
    width: '960px',
    showCancelButton: false,
    confirmButtonText: 'Cerrar',
  });
}

export async function showPacienteDetalleByCod(codpaciente) {
  if (!codpaciente) return;

  try {
    const paciente = await api.pacientes.get(codpaciente);
    await showPacienteDetalle(paciente);
  } catch (error) {
    await alertError(error.message);
  }
}

async function openPacienteForm(mode, paciente = null) {
  if (!canManagePacientes(getSession()?.tipo)) return;

  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar paciente' : 'Nuevo paciente',
    html: pacienteFormHtml(),
    width: '960px',
    didOpen: () => {
      bindSiNoBadges(Swal.getHtmlContainer());
      bindDenticionControls(Swal.getHtmlContainer());
      if (isEdit) {
        fillPacienteForm(paciente);
      } else {
        resetPacienteForm();
      }
    },
    preConfirm: async () => {
      const NOMBRE = sanitizeText(document.getElementById('swal-nombre').value, { maxLength: 500 });
      const nacimiento = document.getElementById('swal-nacimiento').value;

      if (!NOMBRE) {
        Swal.showValidationMessage('El nombre es requerido');
        return false;
      }

      const body = {
        NOMBRE,
        NACIMIENTO: nacimiento || null,
        TIPO_PACIENTE: document.getElementById('swal-tipo-paciente')?.value || 'ADULTO',
        DIRECCION: sanitizeText(document.getElementById('swal-direccion').value, { maxLength: 500 }),
        TELEFONOS: sanitizeText(document.getElementById('swal-telefonos').value, { maxLength: 50 }),
        EMAIL: sanitizeText(document.getElementById('swal-email').value, { maxLength: 50 }),
        ...collectExtraFields(),
      };

      try {
        if (isEdit) {
          await api.pacientes.update(paciente.CODPACIENTE, body);
        } else {
          await api.pacientes.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadPacientes();
  await alertSuccess(isEdit ? 'Paciente actualizado' : 'Paciente creado');
}

async function handleDelete(codpaciente) {
  if (!canManagePacientes(getSession()?.tipo)) return;

  const paciente = pacientes.find((p) => p.CODPACIENTE == codpaciente);
  const nombre = paciente?.NOMBRE || codpaciente;

  const confirmed = await confirmAction({
    title: '¿Eliminar paciente?',
    text: `¿Desea eliminar a "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.pacientes.delete(codpaciente);
    await loadPacientes();
    await alertSuccess('Paciente eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

export function bindPacientes() {
  if (canManagePacientes(getSession()?.tipo)) {
    mountNuevoFab({
      id: 'btnNuevoPaciente',
      icon: 'fa-solid fa-user-plus',
      title: 'Nuevo paciente',
      onClick: () => openPacienteForm('create'),
    });
  }

  document.getElementById('pacientesSearch')?.addEventListener('input', (e) => {
    filtroBusqueda = e.target.value;
    renderTable();
  });

  document.getElementById('pacientesTableBody')?.addEventListener('click', handlePacientesListClick);
  document.getElementById('pacientesMobileList')?.addEventListener('click', handlePacientesListClick);

  loadPacientes();
}
