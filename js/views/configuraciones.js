import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError, alertSuccess, confirmAction, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';

const TIPO_CUMPLE = 'CUMPLE';
const TIPO_DISCLAIMER = 'DISCLAIMER';
const TIPO_RECETA_PIE = 'RECETA_PIE';

const RECETA_CATEGORIAS = ['CIRUGIA QUIRUGICA', 'EXODONCIA', 'ENDODONCIA', 'OTROS'];
const RECETA_TIPOS = ['MEDICAMENTO', 'INDICACIONES'];

let tiposGasto = [];
let configRecetas = [];
let filtroRecetas = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadConfigTexto(tipo, elementId, viewGen) {
  const textarea = document.getElementById(elementId);
  if (!textarea) return;

  try {
    const config = await api.config.get(tipo);
    if (viewGen && !isViewMounted(viewGen)) return;
    textarea.value = config.DETALLES || '';
  } catch (error) {
    if (viewGen && !isViewMounted(viewGen)) return;

    if (error.message?.includes('no encontrada')) {
      textarea.value = '';
      return;
    }

    showAlert('configuracionesAlert', error.message);
  }
}

async function loadMensajeCumple(viewGen) {
  await loadConfigTexto(TIPO_CUMPLE, 'configCumpleMensaje', viewGen);
  if (!viewGen || isViewMounted(viewGen)) {
    clearAlert('configuracionesAlert');
  }
}

async function loadDisclaimer(viewGen) {
  await loadConfigTexto(TIPO_DISCLAIMER, 'configDisclaimerTexto', viewGen);
}

async function loadRecetaPie(viewGen) {
  await loadConfigTexto(TIPO_RECETA_PIE, 'configRecetaPieTexto', viewGen);
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

function optionsHtml(values, selected = '') {
  return values.map((value) => {
    const sel = value === selected ? 'selected' : '';
    return `<option value="${escapeHtml(value)}" ${sel}>${escapeHtml(value)}</option>`;
  }).join('');
}

function recetaFormHtml(item = null) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Categoría <span class="text-danger">*</span></label>
        <select id="swal-receta-categoria" class="form-select">
          <option value="">— Seleccionar —</option>
          ${optionsHtml(RECETA_CATEGORIAS, item?.CATEGORIA || '')}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Tipo <span class="text-danger">*</span></label>
        <select id="swal-receta-tipo" class="form-select">
          <option value="">— Seleccionar —</option>
          ${optionsHtml(RECETA_TIPOS, item?.TIPO || '')}
        </select>
      </div>
      <div class="mb-0">
        <label class="form-label">Descripción <span class="text-danger">*</span></label>
        <textarea
          id="swal-receta-descripcion"
          class="form-control"
          rows="4"
          maxlength="500"
          placeholder="Puede usar varias líneas. Ej.&#10;Amoxicilina 500 mg&#10;1 cápsula cada 8 horas por 7 días"
        >${escapeHtml(item?.DESCRIPCION || '')}</textarea>
        <div class="form-text">Máximo 500 caracteres. Se respetan los saltos de línea al imprimir.</div>
      </div>
    </div>
  `;
}

function sortRecetas(list) {
  return [...list].sort((a, b) => {
    const cat = String(a.CATEGORIA || '').localeCompare(String(b.CATEGORIA || ''), 'es');
    if (cat !== 0) return cat;
    const tipo = String(a.TIPO || '').localeCompare(String(b.TIPO || ''), 'es');
    if (tipo !== 0) return tipo;
    return String(a.DESCRIPCION || '').localeCompare(String(b.DESCRIPCION || ''), 'es');
  });
}

function getRecetasFiltradas() {
  const query = filtroRecetas.trim().toLowerCase();
  const ordenadas = sortRecetas(configRecetas);

  if (!query) return ordenadas;

  return ordenadas.filter((r) => {
    const texto = [r.CATEGORIA, r.TIPO, r.DESCRIPCION]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(query);
  });
}

function renderRecetasTable() {
  const tbody = document.getElementById('configRecetasBody');
  if (!tbody) return;

  if (configRecetas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-3">No hay registros de receta</td>
      </tr>
    `;
    return;
  }

  const filtradas = getRecetasFiltradas();

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-3">No se encontraron recetas con ese criterio</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtradas.map((r) => `
    <tr>
      <td>${escapeHtml(r.CATEGORIA || '—')}</td>
      <td>${escapeHtml(r.TIPO || '—')}</td>
      <td class="config-receta-desc">${escapeHtml(r.DESCRIPCION || '—')}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit-receta="${r.ID}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete-receta="${r.ID}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadConfigRecetas(viewGen) {
  configRecetas = await api.configRecetas.list();
  if (viewGen && !isViewMounted(viewGen)) return;
  renderRecetasTable();
}

async function openRecetaForm(mode, item = null) {
  const isEdit = mode === 'edit';

  const result = await openFormDialog({
    title: isEdit ? 'Editar receta' : 'Nueva receta',
    html: recetaFormHtml(item),
    width: '480px',
    didOpen: () => {
      document.getElementById('swal-receta-categoria')?.focus();
    },
    preConfirm: async () => {
      const CATEGORIA = document.getElementById('swal-receta-categoria')?.value || '';
      const TIPO = document.getElementById('swal-receta-tipo')?.value || '';
      const DESCRIPCION = sanitizeText(document.getElementById('swal-receta-descripcion')?.value, { maxLength: 500 });

      if (!CATEGORIA) {
        Swal.showValidationMessage('Debe seleccionar una categoría');
        return false;
      }
      if (!TIPO) {
        Swal.showValidationMessage('Debe seleccionar un tipo');
        return false;
      }
      if (!DESCRIPCION) {
        Swal.showValidationMessage('La descripción es requerida');
        return false;
      }

      const body = { CATEGORIA, TIPO, DESCRIPCION };

      try {
        if (isEdit) {
          await api.configRecetas.update(item.ID, body);
        } else {
          await api.configRecetas.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  await loadConfigRecetas();
  await alertSuccess(isEdit ? 'Receta actualizada' : 'Receta creada');
}

async function handleDeleteReceta(id) {
  const item = configRecetas.find((r) => r.ID == id);
  const nombre = item?.DESCRIPCION || id;

  const confirmed = await confirmAction({
    title: '¿Eliminar receta?',
    text: `¿Desea eliminar "${nombre}"?`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.configRecetas.delete(id);
    await loadConfigRecetas();
    await alertSuccess('Receta eliminada');
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
        <div class="config-options-stack">
          <div class="content-card config-option-card">
            <div class="config-option-header">
              <div>
                <h6 class="mb-1">
                  <i class="fa-solid fa-file-signature me-2 text-primary"></i>
                  Consentimiento Informado
                </h6>
                <p class="text-muted small mb-0">
                  Párrafo incluido al pie de algunos documentos impresos, como el reporte de tratamientos del paciente.
                </p>
              </div>
            </div>

            <form id="configDisclaimerForm" class="mt-3">
              <div class="mb-3">
                <label for="configDisclaimerTexto" class="form-label">Texto del consentimiento</label>
                <textarea
                  id="configDisclaimerTexto"
                  class="form-control"
                  rows="5"
                  maxlength="3000"
                  placeholder="Ej: El paciente declara haber sido informado sobre los procedimientos, riesgos y alternativas de tratamiento..."
                ></textarea>
                <div class="form-text">Máximo 3000 caracteres. Se imprime en letra pequeña al pie del documento.</div>
              </div>

              <div class="d-flex justify-content-end">
                <button type="submit" class="btn btn-primary btn-rounded" id="btnGuardarDisclaimer">
                  <i class="fa-solid fa-floppy-disk me-1"></i>Guardar consentimiento
                </button>
              </div>
            </form>
          </div>

          <div class="content-card config-option-card">
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

          <div class="content-card config-option-card">
            <div class="config-option-header">
              <div>
                <h6 class="mb-1">
                  <i class="fa-solid fa-prescription me-2 text-primary"></i>
                  Pie de página de receta
                </h6>
                <p class="text-muted small mb-0">
                  Texto que aparece al final de la receta impresa.
                </p>
              </div>
            </div>

            <form id="configRecetaPieForm" class="mt-3">
              <div class="mb-3">
                <label for="configRecetaPieTexto" class="form-label">Texto del pie de página</label>
                <textarea
                  id="configRecetaPieTexto"
                  class="form-control"
                  rows="4"
                  maxlength="1500"
                  placeholder="Ej: Ante cualquier molestia, comuníquese con la clínica. Esta receta es válida por 30 días."
                ></textarea>
                <div class="form-text">Máximo 1500 caracteres. Se imprime al final de la receta.</div>
              </div>

              <div class="d-flex justify-content-end">
                <button type="submit" class="btn btn-primary btn-rounded" id="btnGuardarRecetaPie">
                  <i class="fa-solid fa-floppy-disk me-1"></i>Guardar pie de página
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="config-options-stack">
          <div class="content-card config-option-card">
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

          <div class="content-card config-option-card">
            <div class="config-option-header config-tipos-header">
              <div>
                <h6 class="mb-1">
                  <i class="fa-solid fa-prescription-bottle-medical me-2 text-primary"></i>
                  Recetas
                </h6>
                <p class="text-muted small mb-0">
                  Medicamentos e indicaciones por categoría para las recetas.
                </p>
              </div>
              <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevaReceta" type="button">
                <i class="fa-solid fa-plus me-1"></i>Nuevo
              </button>
            </div>

            <div class="table-toolbar mt-3 mb-0">
              <div class="table-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="search"
                  id="configRecetasSearch"
                  class="form-control"
                  placeholder="Buscar por categoría, tipo o descripción..."
                  autocomplete="off"
                >
              </div>
            </div>

            <div class="table-responsive mt-3">
              <table class="table table-hover crud-table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th class="text-end" style="width: 100px;">Acciones</th>
                  </tr>
                </thead>
                <tbody id="configRecetasBody">
                  <tr><td colspan="4" class="text-center text-muted py-3">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindConfiguraciones(params = {}) {
  const { viewGen } = params;
  const formCumple = document.getElementById('configCumpleForm');
  const formDisclaimer = document.getElementById('configDisclaimerForm');
  const formRecetaPie = document.getElementById('configRecetaPieForm');

  await Promise.all([
    loadMensajeCumple(viewGen),
    loadDisclaimer(viewGen),
    loadRecetaPie(viewGen),
    loadTiposGasto(viewGen),
    loadConfigRecetas(viewGen),
  ]);
  if (viewGen && !isViewMounted(viewGen)) return;

  formCumple?.addEventListener('submit', async (e) => {
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

  formDisclaimer?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = document.getElementById('configDisclaimerTexto');
    const detalles = textarea?.value?.trim() || '';

    const btn = document.getElementById('btnGuardarDisclaimer');
    btn?.setAttribute('disabled', 'disabled');

    try {
      await api.config.update(TIPO_DISCLAIMER, { DETALLES: detalles });
      if (viewGen && !isViewMounted(viewGen)) return;

      clearAlert('configuracionesAlert');
      await alertSuccess('Consentimiento informado guardado correctamente');
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

  formRecetaPie?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = document.getElementById('configRecetaPieTexto');
    const detalles = textarea?.value?.trim() || '';

    const btn = document.getElementById('btnGuardarRecetaPie');
    btn?.setAttribute('disabled', 'disabled');

    try {
      await api.config.update(TIPO_RECETA_PIE, { DETALLES: detalles });
      if (viewGen && !isViewMounted(viewGen)) return;

      clearAlert('configuracionesAlert');
      await alertSuccess('Pie de página de receta guardado correctamente');
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

  document.getElementById('btnNuevaReceta')?.addEventListener('click', () => {
    openRecetaForm('create');
  });

  document.getElementById('configRecetasSearch')?.addEventListener('input', (e) => {
    filtroRecetas = e.target.value;
    renderRecetasTable();
  });

  document.getElementById('configRecetasBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-receta]');
    const deleteBtn = e.target.closest('[data-delete-receta]');

    if (editBtn) {
      const item = configRecetas.find((r) => r.ID == editBtn.dataset.editReceta);
      if (item) openRecetaForm('edit', item);
    }

    if (deleteBtn) {
      handleDeleteReceta(deleteBtn.dataset.deleteReceta);
    }
  });
}
