import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError, alertSuccess, confirmAction, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';

const TIPO_CUMPLE = 'CUMPLE';

let tiposGasto = [];

async function loadMensajeCumple(viewGen) {
  try {
    const config = await api.config.get(TIPO_CUMPLE);
    if (viewGen && !isViewMounted(viewGen)) return;

    const textarea = document.getElementById('configCumpleMensaje');
    if (textarea) {
      textarea.value = config.DETALLES || '';
    }
    clearAlert('configuracionesAlert');
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('configuracionesAlert', error.message);
    }
  }
}

function tipoGastoFormHtml(item = null) {
  return `
    <div class="swal-form text-start">
      <div class="mb-0">
        <label class="form-label">Nombre del tipo <span class="text-danger">*</span></label>
        <input type="text" id="swal-tipo" class="form-control" maxlength="255" value="${item?.TIPO || ''}" placeholder="Ej. Compra de insumos">
      </div>
    </div>
  `;
}

function renderTiposTable() {
  const tbody = document.getElementById('configGastosTiposBody');
  if (!tbody) return;

  if (tiposGasto.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted py-3">No hay tipos registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tiposGasto.map((t) => `
    <tr>
      <td>${t.TIPO || '—'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit-tipo="${t.CODTIPO}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete-tipo="${t.CODTIPO}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadTiposGasto(viewGen) {
  tiposGasto = await api.gastosTipos.list();
  if (viewGen && !isViewMounted(viewGen)) return;
  renderTiposTable();
}

async function openTipoGastoForm(mode, item = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto',
    html: tipoGastoFormHtml(item),
    didOpen: () => {
      document.getElementById('swal-tipo')?.focus();
    },
    preConfirm: async () => {
      const TIPO = sanitizeText(document.getElementById('swal-tipo').value, { maxLength: 255 });

      if (!TIPO) {
        Swal.showValidationMessage('El nombre del tipo es requerido');
        return false;
      }

      try {
        if (isEdit) {
          await api.gastosTipos.update(item.CODTIPO, { TIPO });
        } else {
          await api.gastosTipos.create({ TIPO });
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadTiposGasto();
  await alertSuccess(isEdit ? 'Tipo de gasto actualizado' : 'Tipo de gasto creado');
}

async function handleDeleteTipo(codtipo) {
  const item = tiposGasto.find((t) => t.CODTIPO == codtipo);
  const nombre = item?.TIPO || codtipo;

  const confirmed = await confirmAction({
    title: '¿Eliminar tipo de gasto?',
    text: `¿Desea eliminar "${nombre}"?`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.gastosTipos.delete(codtipo);
    await loadTiposGasto();
    await alertSuccess('Tipo de gasto eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

export function renderConfiguraciones() {
  return `
    <div id="configuracionesAlert"></div>

    <div class="content-card view-configuraciones">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-gear me-2 text-primary"></i>Configuración del sistema</h5>
      </div>
      <p class="text-muted mb-4">
        Ajustes generales de la clínica. Los cambios aplican para todos los usuarios.
      </p>

      <div class="config-options-grid">
        <div class="content-card config-option-card h-100">
          <div class="config-option-header">
            <div>
              <h6 class="mb-1">
                <i class="fa-solid fa-cake-candles me-2 text-primary"></i>
                Mensaje de cumpleaños (WhatsApp)
              </h6>
              <p class="text-muted small mb-0">
                Texto enviado al felicitar pacientes. La palabra <strong>paciente</strong> se reemplaza por el nombre del paciente.
              </p>
            </div>
          </div>

          <form id="configCumpleForm" class="mt-3">
            <div class="mb-3">
              <label for="configCumpleMensaje" class="form-label">Mensaje personalizado</label>
              <textarea
                id="configCumpleMensaje"
                class="form-control"
                rows="4"
                maxlength="700"
                placeholder="Ej: ¡Feliz cumpleaños, paciente! Te deseamos un excelente día."
              ></textarea>
              <div class="form-text">Máximo 700 caracteres. Use la palabra <em>paciente</em> donde quiera insertar el nombre.</div>
            </div>

            <div class="d-flex justify-content-end">
              <button type="submit" class="btn btn-primary btn-rounded" id="btnGuardarCumple">
                <i class="fa-solid fa-floppy-disk me-1"></i>Guardar mensaje
              </button>
            </div>
          </form>
        </div>

        <div class="content-card config-option-card h-100">
          <div class="config-option-header config-tipos-header">
            <div>
              <h6 class="mb-1">
                <i class="fa-solid fa-tags me-2 text-primary"></i>
                Tipos de gasto
              </h6>
              <p class="text-muted small mb-0">
                Catálogo usado al registrar gastos en la sección de Gastos.
              </p>
            </div>
            <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevoTipoGasto" type="button">
              <i class="fa-solid fa-plus me-1"></i>Nuevo
            </button>
          </div>

          <div class="table-responsive mt-3">
            <table class="table table-hover crud-table table-sm mb-0">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th class="text-end" style="width: 100px;">Acciones</th>
                </tr>
              </thead>
              <tbody id="configGastosTiposBody">
                <tr><td colspan="2" class="text-center text-muted py-3">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindConfiguraciones(params = {}) {
  const { viewGen } = params;
  const form = document.getElementById('configCumpleForm');

  await Promise.all([loadMensajeCumple(viewGen), loadTiposGasto(viewGen)]);
  if (viewGen && !isViewMounted(viewGen)) return;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = document.getElementById('configCumpleMensaje');
    const detalles = textarea?.value?.trim() || '';

    if (!detalles) {
      showAlert('configuracionesAlert', 'El mensaje no puede estar vacío');
      return;
    }

    const btn = document.getElementById('btnGuardarCumple');
    btn?.setAttribute('disabled', 'disabled');

    try {
      await api.config.update(TIPO_CUMPLE, { DETALLES: detalles });
      if (viewGen && !isViewMounted(viewGen)) return;

      clearAlert('configuracionesAlert');
      await alertSuccess('Mensaje de cumpleaños guardado correctamente');
    } catch (error) {
      if (!viewGen || isViewMounted(viewGen)) {
        showAlert('configuracionesAlert', error.message);
      }
    } finally {
      if (!viewGen || isViewMounted(viewGen)) {
        btn?.removeAttribute('disabled');
      }
    }
  });

  document.getElementById('btnNuevoTipoGasto')?.addEventListener('click', () => {
    openTipoGastoForm('create');
  });

  document.getElementById('configGastosTiposBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-tipo]');
    const deleteBtn = e.target.closest('[data-delete-tipo]');

    if (editBtn) {
      const item = tiposGasto.find((t) => t.CODTIPO == editBtn.dataset.editTipo);
      if (item) openTipoGastoForm('edit', item);
    }

    if (deleteBtn) {
      handleDeleteTipo(deleteBtn.dataset.deleteTipo);
    }
  });
}
