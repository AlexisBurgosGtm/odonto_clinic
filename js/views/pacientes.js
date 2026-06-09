import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';

let pacientes = [];

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function toInputDate(fecha) {
  if (!fecha) return '';
  return String(fecha).split('T')[0];
}

export function renderPacientes() {
  const session = getSession();

  return `
    <div class="page-header">
      <h2>Pacientes</h2>
      <p>Administración del registro de pacientes — <span class="badge-empnit">${session?.empnit || ''}</span></p>
    </div>

    <div id="pacientesAlert"></div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-users me-2 text-primary"></i>Listado de pacientes</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevoPaciente">
          <i class="fa-solid fa-user-plus me-1"></i>Nuevo paciente
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Nacimiento</th>
              <th>Dirección</th>
              <th>Teléfonos</th>
              <th>Email</th>
              <th class="text-end" style="width: 120px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="pacientesTableBody">
            <tr><td colspan="7" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function pacienteFormHtml() {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Nombre <span class="text-danger">*</span></label>
        <input type="text" id="swal-nombre" class="form-control" maxlength="500">
      </div>
      <div class="mb-3">
        <label class="form-label">Nacimiento</label>
        <input type="date" id="swal-nacimiento" class="form-control">
      </div>
      <div class="mb-3">
        <label class="form-label">Dirección</label>
        <input type="text" id="swal-direccion" class="form-control" maxlength="500">
      </div>
      <div class="mb-3">
        <label class="form-label">Teléfonos</label>
        <input type="text" id="swal-telefonos" class="form-control" maxlength="50">
      </div>
      <div class="mb-0">
        <label class="form-label">Email</label>
        <input type="email" id="swal-email" class="form-control" maxlength="50">
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('pacientesTableBody');
  if (!tbody) return;

  if (pacientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">No hay pacientes registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pacientes.map((p) => `
    <tr>
      <td>${p.CODPACIENTE}</td>
      <td>${p.NOMBRE || '—'}</td>
      <td>${formatFecha(p.NACIMIENTO)}</td>
      <td>${p.DIRECCION || '—'}</td>
      <td>${p.TELEFONOS || '—'}</td>
      <td>${p.EMAIL || '—'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${p.CODPACIENTE}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${p.CODPACIENTE}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
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

async function openPacienteForm(mode, paciente = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar paciente' : 'Nuevo paciente',
    html: pacienteFormHtml(),
    confirmButtonText: 'Guardar',
    didOpen: () => {
      if (isEdit) {
        document.getElementById('swal-nombre').value = paciente.NOMBRE || '';
        document.getElementById('swal-nacimiento').value = toInputDate(paciente.NACIMIENTO);
        document.getElementById('swal-direccion').value = paciente.DIRECCION || '';
        document.getElementById('swal-telefonos').value = paciente.TELEFONOS || '';
        document.getElementById('swal-email').value = paciente.EMAIL || '';
      }
    },
    preConfirm: () => {
      const NOMBRE = document.getElementById('swal-nombre').value.trim();
      const nacimiento = document.getElementById('swal-nacimiento').value;

      if (!NOMBRE) {
        Swal.showValidationMessage('El nombre es requerido');
        return false;
      }

      return {
        NOMBRE,
        NACIMIENTO: nacimiento || null,
        DIRECCION: document.getElementById('swal-direccion').value.trim(),
        TELEFONOS: document.getElementById('swal-telefonos').value.trim(),
        EMAIL: document.getElementById('swal-email').value.trim(),
      };
    },
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    if (isEdit) {
      await api.pacientes.update(paciente.CODPACIENTE, result.value);
    } else {
      await api.pacientes.create(result.value);
    }

    await loadPacientes();
    await alertSuccess(isEdit ? 'Paciente actualizado' : 'Paciente creado');
  } catch (error) {
    await alertError(error.message);
  }
}

async function handleDelete(codpaciente) {
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
  document.getElementById('btnNuevoPaciente')?.addEventListener('click', () => openPacienteForm('create'));

  document.getElementById('pacientesTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const paciente = pacientes.find((p) => p.CODPACIENTE == editBtn.dataset.edit);
      if (paciente) openPacienteForm('edit', paciente);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  loadPacientes();
}
