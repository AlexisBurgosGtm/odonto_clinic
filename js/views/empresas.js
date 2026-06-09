import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess } from '../utils/swal.js';

let empresas = [];
let modal = null;

export function renderEmpresas() {
  return `
    <div class="page-header">
      <h2>Empresas</h2>
      <p>Administración de empresas registradas</p>
    </div>

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

    <div class="modal fade" id="empresaModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="empresaModalTitle">Nueva empresa</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="empresaForm">
            <div class="modal-body">
              <div class="mb-3">
                <label for="empnit" class="form-label">EMPNIT <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="empnit" maxlength="50" required>
                <div class="form-text" id="empnitHelp">Identificador único de la empresa</div>
              </div>
              <div class="mb-3">
                <label for="empresa" class="form-label">Nombre de la empresa</label>
                <input type="text" class="form-control" id="empresa" maxlength="255">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnGuardarEmpresa">Guardar</button>
            </div>
          </form>
        </div>
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

function openModal(mode, empresa = null) {
  const title = document.getElementById('empresaModalTitle');
  const empnitInput = document.getElementById('empnit');
  const empresaInput = document.getElementById('empresa');
  const form = document.getElementById('empresaForm');

  form.dataset.mode = mode;
  form.dataset.originalEmpnit = empresa?.EMPNIT || '';

  if (mode === 'edit') {
    title.textContent = 'Editar empresa';
    empnitInput.value = empresa.EMPNIT;
    empnitInput.readOnly = true;
    empnitInput.classList.add('bg-light');
    empresaInput.value = empresa.EMPRESA || '';
  } else {
    title.textContent = 'Nueva empresa';
    form.reset();
    empnitInput.readOnly = false;
    empnitInput.classList.remove('bg-light');
  }

  modal.show();
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const mode = form.dataset.mode;
  const empnit = document.getElementById('empnit').value.trim();
  const empresa = document.getElementById('empresa').value.trim();
  const btn = document.getElementById('btnGuardarEmpresa');

  btn.disabled = true;

  try {
    if (mode === 'edit') {
      await api.empresas.update(form.dataset.originalEmpnit, { EMPRESA: empresa });
    } else {
      await api.empresas.create({ EMPNIT: empnit, EMPRESA: empresa });
    }

    modal.hide();
    await loadEmpresas();
  } catch (error) {
    showAlert('empresasAlert', error.message);
  } finally {
    btn.disabled = false;
  }
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
  const modalEl = document.getElementById('empresaModal');
  modal = new bootstrap.Modal(modalEl);

  document.getElementById('btnNuevaEmpresa')?.addEventListener('click', () => openModal('create'));

  document.getElementById('empresaForm')?.addEventListener('submit', handleSubmit);

  document.getElementById('empresasTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const empresa = empresas.find((emp) => emp.EMPNIT === editBtn.dataset.edit);
      if (empresa) openModal('edit', empresa);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  loadEmpresas();
}
