import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';
import { mountNuevoFab } from '../utils/nuevo-fab.js';
import { localDateString } from '../utils/datetime.js';

let gastos = [];
let tiposGasto = [];
let totalGastos = 0;
let filtroMes = new Date().getMonth() + 1;
let filtroAnio = new Date().getFullYear();

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function formatPrecio(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function getPeriodoLabel() {
  const mes = MESES.find((m) => m.value === filtroMes)?.label || filtroMes;
  return `${mes} ${filtroAnio}`;
}

function tipoOptionsHtml(selected = '') {
  if (tiposGasto.length === 0) {
    return '<option value="">— Sin tipos registrados —</option>';
  }

  return `
    <option value="">— Seleccionar tipo —</option>
    ${tiposGasto.map((t) => {
      const sel = String(t.CODTIPO) === String(selected) ? 'selected' : '';
      return `<option value="${t.CODTIPO}" ${sel}>${t.TIPO || `Tipo #${t.CODTIPO}`}</option>`;
    }).join('')}
  `;
}

function gastoFormHtml(item = null) {
  const hoy = localDateString();

  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Tipo de gasto <span class="text-danger">*</span></label>
        <select id="swal-codtipo" class="form-select">
          ${tipoOptionsHtml(item?.CODTIPO)}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Fecha <span class="text-danger">*</span></label>
        <input type="date" id="swal-fecha" class="form-control" value="${item?.FECHA?.split('T')[0] || hoy}">
      </div>
      <div class="mb-3">
        <label class="form-label">Importe <span class="text-danger">*</span></label>
        <div class="input-group">
          <span class="input-group-text">Q</span>
          <input type="number" id="swal-importe" class="form-control" min="0.01" step="0.01" value="${item?.IMPORTE ?? ''}">
        </div>
      </div>
      <div class="mb-0">
        <label class="form-label">Descripción</label>
        <textarea id="swal-descripcion" class="form-control" rows="2" maxlength="2000">${item?.DESCRIPCION || ''}</textarea>
      </div>
    </div>
  `;
}

function renderGastosTable() {
  const tbody = document.getElementById('gastosTableBody');
  const totalEl = document.getElementById('gastosTotalMes');
  const periodoEl = document.getElementById('gastosPeriodoLabel');

  if (periodoEl) periodoEl.textContent = getPeriodoLabel();
  if (totalEl) totalEl.textContent = formatPrecio(totalGastos);

  if (!tbody) return;

  if (gastos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          No hay gastos registrados para ${getPeriodoLabel()}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = gastos.map((g) => `
    <tr>
      <td class="nowrap">${formatFecha(g.FECHA)}</td>
      <td>${g.TIPO || '—'}</td>
      <td>${g.DESCRIPCION || '—'}</td>
      <td class="num text-pago fw-semibold">${formatPrecio(g.IMPORTE)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit-gasto="${g.ID}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete-gasto="${g.ID}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadGastos(viewGen) {
  const data = await api.gastos.list({ mes: filtroMes, anio: filtroAnio });
  if (viewGen && !isViewMounted(viewGen)) return;

  gastos = data.gastos || [];
  totalGastos = Number(data.total) || 0;
  renderGastosTable();
  clearAlert('gastosAlert');
}

async function refreshTiposGasto() {
  tiposGasto = await api.gastosTipos.list();
}

async function openGastoForm(mode, item = null) {
  await refreshTiposGasto();

  if (tiposGasto.length === 0) {
    await alertError('Debe registrar al menos un tipo de gasto en Configuraciones antes de crear gastos');
    return;
  }

  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar gasto' : 'Nuevo gasto',
    html: gastoFormHtml(item),
    preConfirm: async () => {
      const CODTIPO = document.getElementById('swal-codtipo').value;
      const FECHA = document.getElementById('swal-fecha').value;
      const IMPORTE = document.getElementById('swal-importe').value;
      const DESCRIPCION = sanitizeText(document.getElementById('swal-descripcion').value, { maxLength: 2000 });

      if (!CODTIPO) {
        Swal.showValidationMessage('Debe seleccionar un tipo de gasto');
        return false;
      }

      if (!FECHA) {
        Swal.showValidationMessage('La fecha es requerida');
        return false;
      }

      if (!IMPORTE || Number(IMPORTE) <= 0) {
        Swal.showValidationMessage('El importe debe ser mayor a cero');
        return false;
      }

      const body = { CODTIPO: Number(CODTIPO), FECHA, IMPORTE: Number(IMPORTE), DESCRIPCION };

      try {
        if (isEdit) {
          await api.gastos.update(item.ID, body);
        } else {
          await api.gastos.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadGastos();
  await alertSuccess(isEdit ? 'Gasto actualizado' : 'Gasto registrado');
}

async function handleDeleteGasto(id) {
  const item = gastos.find((g) => g.ID == id);
  const nombre = item?.DESCRIPCION || item?.TIPO || id;

  const confirmed = await confirmAction({
    title: '¿Eliminar gasto?',
    text: `¿Desea eliminar el gasto "${nombre}"?`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.gastos.delete(id);
    await loadGastos();
    await alertSuccess('Gasto eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

function renderFiltroPeriodo() {
  const mesSelect = document.getElementById('filtroGastosMes');
  const anioInput = document.getElementById('filtroGastosAnio');

  if (mesSelect) {
    mesSelect.innerHTML = MESES.map((m) => `
      <option value="${m.value}" ${m.value === filtroMes ? 'selected' : ''}>${m.label}</option>
    `).join('');
  }

  if (anioInput) anioInput.value = filtroAnio;
}

export function renderGastos() {
  const anioActual = new Date().getFullYear();

  return `
    <div id="gastosAlert"></div>

    <div class="content-card view-gastos">
      <div class="content-card-header gastos-header">
        <div>
          <h5 class="mb-1"><i class="fa-solid fa-receipt me-2 text-primary"></i>Gastos</h5>
          <p class="gastos-subtitle mb-0">
            Periodo: <strong id="gastosPeriodoLabel">${getPeriodoLabel()}</strong>
            · Total: <strong class="text-pago" id="gastosTotalMes">Q 0.00</strong>
          </p>
        </div>
        <div class="gastos-filtros">
          <div class="gastos-filtro-item">
            <label for="filtroGastosMes" class="form-label">Mes</label>
            <select id="filtroGastosMes" class="form-select"></select>
          </div>
          <div class="gastos-filtro-item">
            <label for="filtroGastosAnio" class="form-label">Año</label>
            <input type="number" id="filtroGastosAnio" class="form-control" min="2000" max="2100" value="${anioActual}">
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th class="text-end">Importe</th>
              <th class="text-end" style="width: 120px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="gastosTableBody">
            <tr><td colspan="5" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindGastos(params = {}) {
  const { viewGen } = params;
  const now = new Date();
  filtroMes = now.getMonth() + 1;
  filtroAnio = now.getFullYear();

  renderFiltroPeriodo();

  mountNuevoFab({
    id: 'btnNuevoGasto',
    icon: 'fa-solid fa-plus',
    title: 'Nuevo gasto',
    onClick: () => openGastoForm('create'),
  });

  document.getElementById('filtroGastosMes')?.addEventListener('change', async (e) => {
    filtroMes = Number(e.target.value);
    await loadGastos(viewGen);
  });

  document.getElementById('filtroGastosAnio')?.addEventListener('change', async (e) => {
    filtroAnio = Number(e.target.value);
    if (filtroAnio) await loadGastos(viewGen);
  });

  document.getElementById('gastosTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-gasto]');
    const deleteBtn = e.target.closest('[data-delete-gasto]');

    if (editBtn) {
      const item = gastos.find((g) => g.ID == editBtn.dataset.editGasto);
      if (item) openGastoForm('edit', item);
    }

    if (deleteBtn) {
      handleDeleteGasto(deleteBtn.dataset.deleteGasto);
    }
  });

  try {
    await loadGastos(viewGen);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('gastosAlert', error.message);
    }
  }
}
