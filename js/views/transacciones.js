import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';
import { mountNuevoFab } from '../utils/nuevo-fab.js';
import { printComprobantePago } from '../utils/print-comprobante-pago.js';
import { localDateString } from '../utils/datetime.js';

let transacciones = [];
let pacientes = [];
let fechaInicio = '';
let fechaFin = '';

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

function transaccionFormHtml(isEdit) {
  const pacienteOptions = pacientes.map((p) => `
    <option value="${p.CODPACIENTE}">${p.NOMBRE || `Paciente #${p.CODPACIENTE}`}</option>
  `).join('');

  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Paciente <span class="text-danger">*</span></label>
        <select id="swal-codpaciente" class="form-select">
          <option value="">— Seleccionar paciente —</option>
          ${pacienteOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Fecha <span class="text-danger">*</span></label>
        <input type="date" id="swal-fecha" class="form-control">
      </div>
      <div class="mb-3">
        <label class="form-label">Monto <span class="text-danger">*</span></label>
        <div class="input-group">
          <span class="input-group-text">Q</span>
          <input type="number" id="swal-monto" class="form-control" min="0.01" step="0.01">
        </div>
      </div>
      <div class="mb-0">
        <label class="form-label">Observaciones</label>
        <textarea id="swal-obs" class="form-control" rows="2" maxlength="500"></textarea>
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('transaccionesTableBody');
  if (!tbody) return;

  if (transacciones.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          No hay transacciones del ${formatFecha(fechaInicio)} al ${formatFecha(fechaFin)}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transacciones.map((t) => `
    <tr>
      <td class="nowrap">${formatFecha(t.FECHA)}</td>
      <td>${t.PACIENTE || '—'}</td>
      <td class="num text-abono">${formatPrecio(t.MONTO)}</td>
      <td>${t.OBS || '—'}</td>
      <td class="text-end transacciones-actions">
        <button class="btn btn-sm btn-outline-secondary btn-action" data-print="${t.ID}" title="Reimprimir comprobante">
          <i class="fa-solid fa-print"></i>
        </button>
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

async function loadTransacciones(viewGen) {
  transacciones = await api.transacciones.list({ fechaInicio, fechaFin });
  if (viewGen && !isViewMounted(viewGen)) return;
  renderTable();
  clearAlert('transaccionesAlert');
}

function imprimirComprobante(item) {
  printComprobantePago(item, { empresa: getSession()?.empresa });
}

async function openTransaccionForm(mode, item = null) {
  const isEdit = mode === 'edit';
  const hoy = localDateString();
  let transaccionCreada = null;

  const result = await openFormDialog({
    title: isEdit ? 'Editar abono' : 'Nuevo abono',
    html: transaccionFormHtml(isEdit),
    width: '480px',
    didOpen: () => {
      if (isEdit) {
        document.getElementById('swal-codpaciente').value = item.CODPACIENTE || '';
        document.getElementById('swal-fecha').value = String(item.FECHA).split('T')[0];
        document.getElementById('swal-monto').value = item.MONTO ?? '';
        document.getElementById('swal-obs').value = item.OBS || '';
      } else {
        document.getElementById('swal-fecha').value = hoy;
      }
    },
    preConfirm: async () => {
      const CODPACIENTE = document.getElementById('swal-codpaciente').value;
      const FECHA = document.getElementById('swal-fecha').value;
      const MONTO = document.getElementById('swal-monto').value;
      const OBS = sanitizeText(document.getElementById('swal-obs').value, { maxLength: 500 });

      if (!CODPACIENTE) {
        Swal.showValidationMessage('Debe seleccionar un paciente');
        return false;
      }

      if (!FECHA) {
        Swal.showValidationMessage('La fecha es requerida');
        return false;
      }

      if (!MONTO) {
        Swal.showValidationMessage('El monto es requerido');
        return false;
      }

      const body = {
        CODPACIENTE: Number(CODPACIENTE),
        FECHA,
        TIPO: 'ABONO',
        MONTO: Number(MONTO),
        OBS,
      };

      try {
        if (isEdit) {
          await api.transacciones.update(item.ID, body);
        } else {
          transaccionCreada = await api.transacciones.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadTransacciones();

  if (!isEdit && transaccionCreada) {
    const pacienteNombre = transaccionCreada.PACIENTE
      || pacientes.find((p) => p.CODPACIENTE == transaccionCreada.CODPACIENTE)?.NOMBRE;
    imprimirComprobante({ ...transaccionCreada, PACIENTE: pacienteNombre });
  }

  await alertSuccess(isEdit ? 'Abono actualizado' : 'Abono registrado');
}

async function handleDelete(id) {
  const item = transacciones.find((t) => t.ID == id);
  const nombre = item?.PACIENTE || id;

  const confirmed = await confirmAction({
    title: '¿Eliminar transacción?',
    text: `¿Desea eliminar la transacción de "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.transacciones.delete(id);
    await loadTransacciones();
    await alertSuccess('Transacción eliminada');
  } catch (error) {
    await alertError(error.message);
  }
}

export function renderTransacciones() {
  const hoy = localDateString();
  fechaInicio = hoy;
  fechaFin = hoy;

  return `
    <div id="transaccionesAlert"></div>

    <div class="content-card view-transacciones">
      <div class="content-card-header transacciones-header">
        <h5><i class="fa-solid fa-money-bill-transfer me-2 text-primary"></i>Abonos</h5>
      </div>

      <div class="transacciones-filtros">
        <div>
          <label for="filtroFechaInicio" class="form-label">Fecha inicial</label>
          <input type="date" id="filtroFechaInicio" class="form-control" value="${hoy}">
        </div>
        <div>
          <label for="filtroFechaFin" class="form-label">Fecha final</label>
          <input type="date" id="filtroFechaFin" class="form-control" value="${hoy}">
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Monto</th>
              <th>Observaciones</th>
              <th class="text-end" style="width: 150px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="transaccionesTableBody">
            <tr><td colspan="5" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindTransacciones(params = {}) {
  const { viewGen } = params;

  try {
    pacientes = await api.pacientes.list();
    if (viewGen && !isViewMounted(viewGen)) return;

    await loadTransacciones(viewGen);
    if (viewGen && !isViewMounted(viewGen)) return;

    const aplicarFiltro = async () => {
      fechaInicio = document.getElementById('filtroFechaInicio')?.value || fechaInicio;
      fechaFin = document.getElementById('filtroFechaFin')?.value || fechaFin;

      try {
        await loadTransacciones(viewGen);
      } catch (error) {
        showAlert('transaccionesAlert', error.message);
      }
    };

    document.getElementById('filtroFechaInicio')?.addEventListener('change', aplicarFiltro);
    document.getElementById('filtroFechaFin')?.addEventListener('change', aplicarFiltro);

    mountNuevoFab({
      id: 'btnNuevaTransaccion',
      icon: 'fa-solid fa-plus',
      title: 'Nuevo abono',
      onClick: () => openTransaccionForm('create'),
    });

    document.getElementById('transaccionesTableBody')?.addEventListener('click', (e) => {
      const printBtn = e.target.closest('[data-print]');
      const editBtn = e.target.closest('[data-edit]');
      const deleteBtn = e.target.closest('[data-delete]');

      if (printBtn) {
        const item = transacciones.find((t) => t.ID == printBtn.dataset.print);
        if (item) imprimirComprobante(item);
        return;
      }

      if (editBtn) {
        const item = transacciones.find((t) => t.ID == editBtn.dataset.edit);
        if (item) openTransaccionForm('edit', item);
      }

      if (deleteBtn) {
        handleDelete(deleteBtn.dataset.delete);
      }
    });
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('transaccionesAlert', error.message);
    }
  }
}
