import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';

const TIPOS = ['GERENTE', 'SECRETARIA', 'MEDICO'];

let empleados = [];

export function renderEmpleados() {
  const session = getSession();

  return `
    <div class="page-header">
      <h2>Empleados</h2>
      <p>Gestión del personal — <span class="badge-empnit">${session?.empnit || ''}</span></p>
    </div>

    <div id="empleadosAlert"></div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-user-doctor me-2 text-primary"></i>Personal de la clínica</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevoEmpleado">
          <i class="fa-solid fa-user-plus me-1"></i>Nuevo empleado
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Código</th>
              <th>Empleado</th>
              <th>Teléfono</th>
              <th>Tipo</th>
              <th>Color</th>
              <th>Usuario</th>
              <th>Estado</th>
              <th class="text-end" style="width: 120px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="empleadosTableBody">
            <tr><td colspan="8" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tipoBadge(tipo) {
  const colors = {
    GERENTE: 'badge-tipo-gerente',
    SECRETARIA: 'badge-tipo-secretaria',
    MEDICO: 'badge-tipo-medico',
  };
  const cls = colors[tipo] || 'badge-tipo-default';
  return `<span class="badge-tipo ${cls}">${tipo || '—'}</span>`;
}

function estadoBadge(habilitado) {
  const activo = habilitado === 'SI';
  return `<span class="badge-estado ${activo ? 'badge-estado-activo' : 'badge-estado-inactivo'}">
    ${activo ? 'Habilitado' : 'Deshabilitado'}
  </span>`;
}

function empleadoFormHtml(isEdit) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Nombre <span class="text-danger">*</span></label>
        <input type="text" id="swal-empleado" class="form-control" maxlength="255">
      </div>
      <div class="mb-3">
        <label class="form-label">Teléfono</label>
        <input type="text" id="swal-telefono" class="form-control" maxlength="50">
      </div>
      <div class="mb-3">
        <label class="form-label">Tipo</label>
        <select id="swal-tipo" class="form-select">
          <option value="">— Seleccionar —</option>
          ${TIPOS.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Color</label>
        <div class="d-flex align-items-center gap-2">
          <input type="color" id="swal-color" class="form-control form-control-color color-picker-input" value="#0ea5e9">
          <span class="text-muted" id="swal-color-value">#0ea5e9</span>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Usuario</label>
        <input type="text" id="swal-usuario" class="form-control" maxlength="255"
          autocomplete="off" name="empleado-usuario" ${isEdit ? '' : 'readonly'}>
      </div>
      <div class="mb-0">
        <label class="form-label">Contraseña ${isEdit ? '' : '<span class="text-danger">*</span>'}</label>
        <input type="password" id="swal-clave" class="form-control" maxlength="255"
          autocomplete="new-password" name="empleado-clave" ${isEdit ? '' : 'readonly'}>
        ${isEdit ? '<div class="form-text">Dejar vacío para mantener la actual</div>' : ''}
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('empleadosTableBody');
  if (!tbody) return;

  if (empleados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">No hay empleados registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = empleados.map((e) => `
    <tr>
      <td>${e.CODEMP}</td>
      <td>${e.EMPLEADO || '—'}</td>
      <td>${e.TELEFONO || '—'}</td>
      <td>${tipoBadge(e.TIPO)}</td>
      <td>
        <span class="color-swatch" style="background:${e.COLOR || '#0ea5e9'}" title="${e.COLOR || '#0ea5e9'}"></span>
      </td>
      <td>${e.USUARIO || '—'}</td>
      <td class="cell-habilitado" data-toggle="${e.CODEMP}" title="Clic para cambiar estado">
        ${estadoBadge(e.HABILITADO)}
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${e.CODEMP}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${e.CODEMP}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadEmpleados() {
  try {
    empleados = await api.empleados.list();
    renderTable();
    clearAlert('empleadosAlert');
  } catch (error) {
    showAlert('empleadosAlert', error.message);
  }
}

async function openEmpleadoForm(mode, empleado = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar empleado' : 'Nuevo empleado',
    html: empleadoFormHtml(isEdit),
    confirmButtonText: 'Guardar',
    didOpen: () => {
      const colorInput = document.getElementById('swal-color');
      const colorValue = document.getElementById('swal-color-value');

      const updateColorLabel = () => {
        if (colorValue) colorValue.textContent = colorInput.value;
      };

      colorInput?.addEventListener('input', updateColorLabel);

      const usuarioInput = document.getElementById('swal-usuario');
      const claveInput = document.getElementById('swal-clave');

      if (isEdit) {
        document.getElementById('swal-empleado').value = empleado.EMPLEADO || '';
        document.getElementById('swal-telefono').value = empleado.TELEFONO || '';
        document.getElementById('swal-tipo').value = empleado.TIPO || '';
        usuarioInput.value = empleado.USUARIO || '';
        claveInput.value = '';
        colorInput.value = empleado.COLOR || '#0ea5e9';
        updateColorLabel();
      } else {
        usuarioInput.value = '';
        claveInput.value = '';

        [usuarioInput, claveInput].forEach((input) => {
          input.addEventListener('focus', () => input.removeAttribute('readonly'), { once: true });
        });

        requestAnimationFrame(() => {
          usuarioInput.value = '';
          claveInput.value = '';
        });
      }
    },
    preConfirm: () => {
      const EMPLEADO = document.getElementById('swal-empleado').value.trim();
      const CLAVE = document.getElementById('swal-clave').value;

      if (!EMPLEADO) {
        Swal.showValidationMessage('El nombre es requerido');
        return false;
      }

      if (!isEdit && !CLAVE) {
        Swal.showValidationMessage('La contraseña es requerida');
        return false;
      }

      const body = {
        EMPLEADO,
        TELEFONO: document.getElementById('swal-telefono').value.trim(),
        TIPO: document.getElementById('swal-tipo').value,
        USUARIO: document.getElementById('swal-usuario').value.trim(),
        COLOR: document.getElementById('swal-color').value,
        HABILITADO: isEdit ? (empleado.HABILITADO || 'SI') : 'SI',
      };

      if (CLAVE) body.CLAVE = CLAVE;

      return body;
    },
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    if (isEdit) {
      await api.empleados.update(empleado.CODEMP, result.value);
    } else {
      await api.empleados.create(result.value);
    }

    await loadEmpleados();
    await alertSuccess(isEdit ? 'Empleado actualizado' : 'Empleado creado');
  } catch (error) {
    await alertError(error.message);
  }
}

async function handleToggleHabilitado(codemp) {
  const empleado = empleados.find((e) => e.CODEMP == codemp);
  if (!empleado) return;

  const activo = empleado.HABILITADO === 'SI';
  const nuevoEstado = activo ? 'NO' : 'SI';
  const accion = activo ? 'deshabilitar' : 'habilitar';
  const nombre = empleado.EMPLEADO || `código ${codemp}`;

  const confirmed = await confirmAction({
    title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} empleado?`,
    text: `¿Desea ${accion} a "${nombre}"?`,
    icon: 'question',
    confirmText: activo ? 'Deshabilitar' : 'Habilitar',
  });

  if (!confirmed) return;

  try {
    await api.empleados.update(codemp, {
      EMPLEADO: empleado.EMPLEADO,
      TELEFONO: empleado.TELEFONO,
      TIPO: empleado.TIPO,
      USUARIO: empleado.USUARIO,
      COLOR: empleado.COLOR || '#0ea5e9',
      HABILITADO: nuevoEstado,
    });

    await loadEmpleados();
    await alertSuccess(
      nuevoEstado === 'SI' ? 'Empleado habilitado' : 'Empleado deshabilitado'
    );
  } catch (error) {
    await alertError(error.message);
  }
}

async function handleDelete(codemp) {
  const empleado = empleados.find((e) => e.CODEMP == codemp);
  const nombre = empleado?.EMPLEADO || codemp;

  const confirmed = await confirmAction({
    title: '¿Eliminar empleado?',
    text: `¿Desea eliminar a "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.empleados.delete(codemp);
    await loadEmpleados();
    await alertSuccess('Empleado eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

export function bindEmpleados() {
  document.getElementById('btnNuevoEmpleado')?.addEventListener('click', () => openEmpleadoForm('create'));

  document.getElementById('empleadosTableBody')?.addEventListener('click', (e) => {
    const toggleCell = e.target.closest('[data-toggle]');
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (toggleCell) {
      handleToggleHabilitado(toggleCell.dataset.toggle);
      return;
    }

    if (editBtn) {
      const empleado = empleados.find((emp) => emp.CODEMP == editBtn.dataset.edit);
      if (empleado) openEmpleadoForm('edit', empleado);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  loadEmpleados();
}
