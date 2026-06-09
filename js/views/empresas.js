import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';

let empresas = [];

export function renderEmpresas() {
  return `
    <div id="empresasAlert"></div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-building me-2 text-primary"></i>Listado de empresas</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevaEmpresa">
          <i class="fa-solid fa-plus me-1"></i>Nueva empresa
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>EMPNIT</th>
              <th>Empresa</th>
              <th class="text-end" style="width: 120px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="empresasTableBody">
            <tr><td colspan="3" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function empresaFormHtml(isEdit) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">EMPNIT <span class="text-danger">*</span></label>
        <input type="text" id="swal-empnit" class="form-control" maxlength="50" ${isEdit ? 'readonly' : ''}>
        <div class="form-text">Identificador único de la empresa</div>
      </div>
      <div class="mb-0">
        <label class="form-label">Nombre de la empresa</label>
        <input type="text" id="swal-empresa" class="form-control" maxlength="255">
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('empresasTableBody');
  if (!tbody) return;

  if (empresas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted py-4">No hay empresas registradas</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = empresas.map((e) => `
    <tr>
      <td><span class="badge-empnit">${e.EMPNIT}</span></td>
      <td>${e.EMPRESA || '—'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${e.EMPNIT}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${e.EMPNIT}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadEmpresas() {
  try {
    empresas = await api.empresas.list();
    renderTable();
    clearAlert('empresasAlert');
  } catch (error) {
    showAlert('empresasAlert', error.message);
  }
}

async function openEmpresaForm(mode, empresa = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar empresa' : 'Nueva empresa',
    html: empresaFormHtml(isEdit),
    didOpen: () => {
      if (isEdit) {
        document.getElementById('swal-empnit').value = empresa.EMPNIT || '';
        document.getElementById('swal-empresa').value = empresa.EMPRESA || '';
      }
    },
    preConfirm: async () => {
      const EMPNIT = sanitizeText(document.getElementById('swal-empnit').value, { maxLength: 50 });
      const EMPRESA = sanitizeText(document.getElementById('swal-empresa').value, { maxLength: 255 });

      if (!EMPNIT) {
        Swal.showValidationMessage('EMPNIT es requerido');
        return false;
      }

      try {
        if (isEdit) {
          await api.empresas.update(empresa.EMPNIT, { EMPRESA });
        } else {
          await api.empresas.create({ EMPNIT, EMPRESA });
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadEmpresas();
  await alertSuccess(isEdit ? 'Empresa actualizada' : 'Empresa creada');
}

async function handleDelete(empnit) {
  const nombre = empresas.find((e) => e.EMPNIT === empnit)?.EMPRESA || empnit;

  const confirmed = await confirmAction({
    title: '¿Eliminar empresa?',
    text: `¿Desea eliminar "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.empresas.delete(empnit);
    await loadEmpresas();
    await alertSuccess('Empresa eliminada');
  } catch (error) {
    await alertError(error.message);
  }
}

export function bindEmpresas() {
  document.getElementById('btnNuevaEmpresa')?.addEventListener('click', () => openEmpresaForm('create'));

  document.getElementById('empresasTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const empresa = empresas.find((emp) => emp.EMPNIT === editBtn.dataset.edit);
      if (empresa) openEmpresaForm('edit', empresa);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  loadEmpresas();
}
