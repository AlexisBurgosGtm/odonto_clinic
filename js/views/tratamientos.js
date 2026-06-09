import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';

let tratamientos = [];

function formatPrecio(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
  }).format(num);
}

export function renderTratamientos() {
  return `
    <div id="tratamientosAlert"></div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-tooth me-2 text-primary"></i>Tratamientos disponibles</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevoTratamiento">
          <i class="fa-solid fa-plus me-1"></i>Nuevo tratamiento
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tratamiento</th>
              <th>Precio referencia</th>
              <th class="text-end" style="width: 120px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="tratamientosTableBody">
            <tr><td colspan="4" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tratamientoFormHtml(isEdit) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Código <span class="text-danger">*</span></label>
        <input type="text" id="swal-codprod" class="form-control" maxlength="150" ${isEdit ? 'readonly' : ''}>
        ${isEdit ? '<div class="form-text">El código no se puede modificar</div>' : ''}
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre del tratamiento <span class="text-danger">*</span></label>
        <input type="text" id="swal-desprod" class="form-control" maxlength="300">
      </div>
      <div class="mb-0">
        <label class="form-label">Precio referencia</label>
        <div class="input-group">
          <span class="input-group-text">Q</span>
          <input type="number" id="swal-precio" class="form-control" min="0" step="0.01" placeholder="0.00">
        </div>
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('tratamientosTableBody');
  if (!tbody) return;

  if (tratamientos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No hay tratamientos registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tratamientos.map((t) => `
    <tr>
      <td><span class="badge-empnit">${t.CODPROD || '—'}</span></td>
      <td>${t.DESPROD || '—'}</td>
      <td class="text-precio">${formatPrecio(t.PRECIO)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${t.ID}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${t.ID}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadTratamientos() {
  try {
    tratamientos = await api.productos.list();
    renderTable();
    clearAlert('tratamientosAlert');
  } catch (error) {
    showAlert('tratamientosAlert', error.message);
  }
}

async function openTratamientoForm(mode, item = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar tratamiento' : 'Nuevo tratamiento',
    html: tratamientoFormHtml(isEdit),
    didOpen: () => {
      if (isEdit) {
        document.getElementById('swal-codprod').value = item.CODPROD || '';
        document.getElementById('swal-desprod').value = item.DESPROD || '';
        document.getElementById('swal-precio').value = item.PRECIO ?? '';
      }
    },
    preConfirm: async () => {
      const CODPROD = sanitizeText(document.getElementById('swal-codprod').value, { maxLength: 150 });
      const DESPROD = sanitizeText(document.getElementById('swal-desprod').value, { maxLength: 300 });
      const precioVal = document.getElementById('swal-precio').value;

      if (!CODPROD) {
        Swal.showValidationMessage('El código es requerido');
        return false;
      }

      if (!DESPROD) {
        Swal.showValidationMessage('El nombre del tratamiento es requerido');
        return false;
      }

      const body = {
        CODPROD,
        DESPROD,
        PRECIO: precioVal !== '' ? Number(precioVal) : null,
      };

      try {
        if (isEdit) {
          await api.productos.update(item.ID, {
            DESPROD: body.DESPROD,
            PRECIO: body.PRECIO,
          });
        } else {
          await api.productos.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadTratamientos();
  await alertSuccess(isEdit ? 'Tratamiento actualizado' : 'Tratamiento creado');
}

async function handleDelete(id) {
  const item = tratamientos.find((t) => t.ID == id);
  const nombre = item?.DESPROD || item?.CODPROD || id;

  const confirmed = await confirmAction({
    title: '¿Eliminar tratamiento?',
    text: `¿Desea eliminar "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.productos.delete(id);
    await loadTratamientos();
    await alertSuccess('Tratamiento eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

export function bindTratamientos() {
  document.getElementById('btnNuevoTratamiento')?.addEventListener('click', () => openTratamientoForm('create'));

  document.getElementById('tratamientosTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const item = tratamientos.find((t) => t.ID == editBtn.dataset.edit);
      if (item) openTratamientoForm('edit', item);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  loadTratamientos();
}
