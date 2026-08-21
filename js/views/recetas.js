import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess } from '../utils/swal.js';
import { isViewMounted } from '../utils/view.js';
import { mountNuevoFab } from '../utils/nuevo-fab.js';
import { localDateString } from '../utils/datetime.js';
import { printReceta } from '../utils/print-receta.js';

const RECETA_CATEGORIAS = ['CIRUGIA QUIRUGICA', 'EXODONCIA', 'ENDODONCIA', 'OTROS'];

let recetas = [];
let pacientes = [];
let configRecetas = [];
let recetaEditando = null;
let fechaInicio = '';
let fechaFin = '';
let filtroBusqueda = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function localTimeString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '00:00';
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':');
}

function parseDetalle(detalle) {
  if (!detalle) return { categoria: '', medicamentos: [], indicaciones: [] };
  if (typeof detalle === 'string') {
    try {
      return parseDetalle(JSON.parse(detalle));
    } catch {
      return { categoria: '', medicamentos: [], indicaciones: [] };
    }
  }
  return {
    categoria: detalle.categoria || '',
    medicamentos: Array.isArray(detalle.medicamentos) ? detalle.medicamentos : [],
    indicaciones: Array.isArray(detalle.indicaciones) ? detalle.indicaciones : [],
  };
}

function showPanel(panel) {
  document.getElementById('recetasListPanel')?.classList.toggle('d-none', panel !== 'list');
  document.getElementById('recetasFormPanel')?.classList.toggle('d-none', panel !== 'form');
  const fab = document.getElementById('btnNuevaRecetaPaciente');
  if (fab) fab.style.display = panel === 'list' ? '' : 'none';
}

function resumenDetalle(detalle) {
  const data = parseDetalle(detalle);
  const meds = data.medicamentos.length;
  const inds = data.indicaciones.length;
  const cat = data.categoria || '—';
  return `${escapeHtml(cat)} · ${meds} med. · ${inds} ind.`;
}

function getRecetasFiltradas() {
  const query = filtroBusqueda.trim().toLowerCase();
  if (!query) return recetas;

  return recetas.filter((r) => {
    const data = parseDetalle(r.DETALLE);
    const texto = [
      r.PACIENTE,
      r.CODPACIENTE,
      r.HORA,
      formatFecha(r.FECHA),
      data.categoria,
      ...(data.medicamentos || []).map((i) => i.descripcion),
      ...(data.indicaciones || []).map((i) => i.descripcion),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(query);
  });
}

function renderTable() {
  const tbody = document.getElementById('recetasTableBody');
  if (!tbody) return;

  if (recetas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          No hay recetas del ${formatFecha(fechaInicio)} al ${formatFecha(fechaFin)}
        </td>
      </tr>
    `;
    return;
  }

  const filtradas = getRecetasFiltradas();

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          No se encontraron recetas con ese criterio
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtradas.map((r) => `
    <tr>
      <td class="nowrap">${formatFecha(r.FECHA)}</td>
      <td class="nowrap">${escapeHtml(r.HORA || '—')}</td>
      <td>${escapeHtml(r.PACIENTE || `Paciente #${r.CODPACIENTE}`)}</td>
      <td>${resumenDetalle(r.DETALLE)}</td>
      <td class="text-end transacciones-actions">
        <button class="btn btn-sm btn-outline-secondary btn-action" data-print="${r.ID}" title="Imprimir">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${r.ID}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${r.ID}" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadRecetas(viewGen) {
  recetas = await api.recetas.list({ fechaInicio, fechaFin });
  if (viewGen && !isViewMounted(viewGen)) return;
  renderTable();
  clearAlert('recetasAlert');
}

function itemsByCategoriaTipo(categoria, tipo) {
  const cat = String(categoria || '').toUpperCase();
  const tip = String(tipo || '').toUpperCase();
  return configRecetas.filter((item) => {
    return String(item.CATEGORIA || '').toUpperCase() === cat
      && String(item.TIPO || '').toUpperCase() === tip;
  });
}

function renderItemsChecklist(containerId, items, selectedIds = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<p class="text-muted small mb-0">No hay opciones configuradas para esta categoría.</p>';
    return;
  }

  const selected = new Set(selectedIds.map(String));
  container.innerHTML = items.map((item) => `
    <label class="receta-item-check">
      <input type="checkbox" value="${item.ID}" ${selected.has(String(item.ID)) ? 'checked' : ''}>
      <span class="receta-item-desc">${escapeHtml(item.DESCRIPCION || '—')}</span>
    </label>
  `).join('');
}

function refreshCategoriaItems(selectedDetalle = null) {
  const categoria = document.getElementById('recetaCategoria')?.value || '';
  const meds = itemsByCategoriaTipo(categoria, 'MEDICAMENTO');
  const inds = itemsByCategoriaTipo(categoria, 'INDICACIONES');

  if (!categoria) {
    renderItemsChecklist('recetaMedicamentosList', [], []);
    renderItemsChecklist('recetaIndicacionesList', [], []);
    return;
  }

  // Al editar: respetar selección guardada. Al crear/cambiar categoría: marcar todos.
  if (selectedDetalle) {
    const data = parseDetalle(selectedDetalle);
    const selectedMeds = (data.medicamentos || []).map((i) => i.id).filter((id) => id != null);
    const selectedInds = (data.indicaciones || []).map((i) => i.id).filter((id) => id != null);

    const medIds = selectedMeds.length
      ? selectedMeds
      : meds.filter((m) => (data.medicamentos || []).some((s) => s.descripcion === m.DESCRIPCION)).map((m) => m.ID);
    const indIds = selectedInds.length
      ? selectedInds
      : inds.filter((m) => (data.indicaciones || []).some((s) => s.descripcion === m.DESCRIPCION)).map((m) => m.ID);

    renderItemsChecklist('recetaMedicamentosList', meds, medIds);
    renderItemsChecklist('recetaIndicacionesList', inds, indIds);
    return;
  }

  renderItemsChecklist('recetaMedicamentosList', meds, meds.map((m) => m.ID));
  renderItemsChecklist('recetaIndicacionesList', inds, inds.map((m) => m.ID));
}

function collectSelectedItems(containerId, tipo) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => {
    const id = Number(input.value);
    const cfg = configRecetas.find((c) => c.ID == id);
    return {
      id,
      tipo,
      descripcion: cfg?.DESCRIPCION || input.parentElement?.querySelector('span')?.textContent?.trim() || '',
    };
  }).filter((item) => item.descripcion);
}

function resetForm() {
  recetaEditando = null;
  const hoy = localDateString();
  const ahora = localTimeString();

  document.getElementById('recetaFormTitle').textContent = 'Nueva receta';
  document.getElementById('recetaFecha').value = hoy;
  document.getElementById('recetaHora').value = ahora;
  document.getElementById('recetaPacienteBuscar').value = '';
  document.getElementById('recetaCodpaciente').value = '';
  document.getElementById('recetaCategoria').value = '';
  clearAlert('recetasFormAlert');
  renderItemsChecklist('recetaMedicamentosList', [], []);
  renderItemsChecklist('recetaIndicacionesList', [], []);
}

async function openForm(item = null) {
  resetForm();

  if (item) {
    const detalle = item.DETALLE ? item : await api.recetas.get(item.ID);
    recetaEditando = detalle;
    const data = parseDetalle(detalle.DETALLE);
    const paciente = pacientes.find((p) => p.CODPACIENTE == detalle.CODPACIENTE);

    document.getElementById('recetaFormTitle').textContent = `Editar receta #${detalle.ID}`;
    document.getElementById('recetaFecha').value = String(detalle.FECHA || '').split('T')[0];
    document.getElementById('recetaHora').value = String(detalle.HORA || '').slice(0, 5);
    document.getElementById('recetaCodpaciente').value = detalle.CODPACIENTE || '';
    document.getElementById('recetaPacienteBuscar').value = paciente?.NOMBRE || detalle.PACIENTE || '';
    document.getElementById('recetaCategoria').value = data.categoria || '';
    refreshCategoriaItems(data);
  }

  showPanel('form');
}

function collectBody() {
  const CODPACIENTE = document.getElementById('recetaCodpaciente').value;
  const FECHA = document.getElementById('recetaFecha').value;
  const HORA = document.getElementById('recetaHora').value;
  const categoria = document.getElementById('recetaCategoria').value;

  return {
    CODPACIENTE: CODPACIENTE ? Number(CODPACIENTE) : null,
    FECHA,
    HORA,
    DETALLE: {
      categoria,
      medicamentos: collectSelectedItems('recetaMedicamentosList', 'MEDICAMENTO'),
      indicaciones: collectSelectedItems('recetaIndicacionesList', 'INDICACIONES'),
    },
  };
}

async function saveReceta() {
  const body = collectBody();

  if (!body.CODPACIENTE) {
    showAlert('recetasFormAlert', 'Debe seleccionar un paciente');
    return;
  }
  if (!body.FECHA) {
    showAlert('recetasFormAlert', 'La fecha es requerida');
    return;
  }
  if (!body.HORA || !/^\d{2}:\d{2}$/.test(body.HORA)) {
    showAlert('recetasFormAlert', 'La hora debe tener formato HH:MM');
    return;
  }
  if (!body.DETALLE.categoria) {
    showAlert('recetasFormAlert', 'Debe seleccionar el tipo de tratamiento');
    return;
  }
  if (!body.DETALLE.medicamentos.length && !body.DETALLE.indicaciones.length) {
    showAlert('recetasFormAlert', 'Seleccione al menos un medicamento o una indicación');
    return;
  }

  try {
    if (recetaEditando) {
      await api.recetas.update(recetaEditando.ID, body);
    } else {
      await api.recetas.create(body);
    }
    await loadRecetas();
    showPanel('list');
    await alertSuccess(recetaEditando ? 'Receta actualizada' : 'Receta creada');
  } catch (error) {
    showAlert('recetasFormAlert', error.message);
  }
}

async function handlePrint(id) {
  try {
    const item = recetas.find((r) => r.ID == id) || await api.recetas.get(id);
    let piePagina = '';
    try {
      const config = await api.config.get('RECETA_PIE');
      piePagina = config?.DETALLES || '';
    } catch (_) {
      piePagina = '';
    }
    printReceta(item, { empresa: getSession()?.empresa, piePagina });
  } catch (error) {
    await alertError(error.message);
  }
}

async function handleDelete(id, btn = null) {
  const item = recetas.find((r) => r.ID == id);
  const confirmed = await confirmAction({
    title: '¿Eliminar receta?',
    text: `¿Desea eliminar la receta de ${item?.PACIENTE || 'este paciente'}?`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });
  if (!confirmed) return;

  const deleteBtn = btn || document.querySelector(`[data-delete="${id}"]`);
  deleteBtn?.setAttribute('disabled', 'disabled');

  try {
    await api.recetas.delete(id);
    await loadRecetas();
    await alertSuccess('Receta eliminada');
  } catch (error) {
    deleteBtn?.removeAttribute('disabled');
    await alertError(error.message);
  }
}

function bindPacienteSearch() {
  const input = document.getElementById('recetaPacienteBuscar');
  const hidden = document.getElementById('recetaCodpaciente');
  const list = document.getElementById('recetaPacienteSuggestions');
  if (!input || !hidden || !list) return;

  let selectedLabel = '';
  let activeIndex = -1;

  const hide = () => {
    list.classList.remove('open');
    activeIndex = -1;
  };

  const getItems = () => [...list.querySelectorAll('.paciente-suggestion-item')];

  const setActive = (index) => {
    const items = getItems();
    if (!items.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = ((index % items.length) + items.length) % items.length;
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === activeIndex);
    });
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const selectPaciente = (paciente) => {
    if (!paciente) return;
    input.value = paciente.NOMBRE || '';
    hidden.value = paciente.CODPACIENTE;
    selectedLabel = input.value;
    hide();
  };

  const selectByButton = (btn) => {
    if (!btn) return;
    const paciente = pacientes.find((p) => p.CODPACIENTE == btn.dataset.id);
    selectPaciente(paciente);
  };

  const render = (items) => {
    activeIndex = -1;
    if (!items.length) {
      list.innerHTML = '<li class="paciente-suggestion-empty">No se encontraron pacientes</li>';
      list.classList.add('open');
      return;
    }
    list.innerHTML = items.map((p) => `
      <li>
        <button type="button" class="paciente-suggestion-item" data-id="${p.CODPACIENTE}">
          <span class="paciente-suggestion-nombre">${escapeHtml(p.NOMBRE || 'Sin nombre')}</span>
        </button>
      </li>
    `).join('');
    list.classList.add('open');
  };

  input.addEventListener('input', () => {
    if (input.value !== selectedLabel) {
      hidden.value = '';
      selectedLabel = '';
    }
    const q = input.value.trim().toLowerCase();
    if (q.length < 3) {
      hide();
      return;
    }
    render(pacientes.filter((p) => {
      const nombre = (p.NOMBRE || '').toLowerCase();
      const tel = (p.TELEFONOS || '').toLowerCase();
      return nombre.includes(q) || tel.includes(q);
    }).slice(0, 12));
  });

  input.addEventListener('keydown', (e) => {
    if (!list.classList.contains('open')) return;

    const items = getItems();
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIndex + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex <= 0 ? items.length - 1 : activeIndex - 1);
      return;
    }

    if (e.key === 'Enter') {
      if (activeIndex < 0) return;
      e.preventDefault();
      selectByButton(items[activeIndex]);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });

  input.addEventListener('blur', () => setTimeout(hide, 150));

  list.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.paciente-suggestion-item');
    if (!btn) return;
    selectByButton(btn);
  });

  list.addEventListener('mousemove', (e) => {
    const btn = e.target.closest('.paciente-suggestion-item');
    if (!btn) return;
    const items = getItems();
    const index = items.indexOf(btn);
    if (index >= 0 && index !== activeIndex) setActive(index);
  });
}

export function renderRecetas() {
  const hoy = localDateString();
  const categoriaOptions = RECETA_CATEGORIAS.map((c) => `
    <option value="${escapeHtml(c)}">${escapeHtml(c)}</option>
  `).join('');

  return `
    <div id="recetasAlert"></div>

    <div class="content-card view-recetas" id="recetasListPanel">
      <div class="content-card-header transacciones-header">
        <h5><i class="fa-solid fa-prescription me-2 text-primary"></i>Recetas</h5>
      </div>

      <div class="transacciones-filtros">
        <div>
          <label for="filtroRecetaInicio" class="form-label">Fecha inicial</label>
          <input type="date" id="filtroRecetaInicio" class="form-control" value="${hoy}">
        </div>
        <div>
          <label for="filtroRecetaFin" class="form-label">Fecha final</label>
          <input type="date" id="filtroRecetaFin" class="form-control" value="${hoy}">
        </div>
      </div>

      <div class="table-toolbar">
        <div class="table-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            type="search"
            id="recetasSearch"
            class="form-control"
            placeholder="Buscar por paciente, categoría o detalle..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Paciente</th>
              <th>Detalle</th>
              <th class="text-end" style="width: 150px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="recetasTableBody">
            <tr><td colspan="5" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="content-card view-recetas d-none" id="recetasFormPanel">
      <div class="content-card-header">
        <h5 id="recetaFormTitle">Nueva receta</h5>
        <button type="button" class="btn btn-sm btn-outline-secondary btn-rounded" id="btnCancelarReceta">
          <i class="fa-solid fa-arrow-left me-1"></i>Volver
        </button>
      </div>

      <div id="recetasFormAlert"></div>

      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Paciente <span class="text-danger">*</span></label>
          <div class="paciente-autocomplete">
            <input
              type="search"
              id="recetaPacienteBuscar"
              class="form-control"
              placeholder="Buscar paciente (mín. 3 caracteres)..."
              autocomplete="off"
            >
            <input type="hidden" id="recetaCodpaciente">
            <ul class="paciente-suggestions" id="recetaPacienteSuggestions"></ul>
          </div>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="recetaFecha">Fecha <span class="text-danger">*</span></label>
          <input type="date" id="recetaFecha" class="form-control">
        </div>
        <div class="col-md-3">
          <label class="form-label" for="recetaHora">Hora <span class="text-danger">*</span></label>
          <input type="time" id="recetaHora" class="form-control" step="60">
        </div>
        <div class="col-md-6">
          <label class="form-label" for="recetaCategoria">Tipo de tratamiento <span class="text-danger">*</span></label>
          <select id="recetaCategoria" class="form-select">
            <option value="">— Seleccionar categoría —</option>
            ${categoriaOptions}
          </select>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-6">
          <div class="receta-items-card">
            <h6 class="mb-2"><i class="fa-solid fa-pills me-2 text-primary"></i>Medicamentos</h6>
            <div id="recetaMedicamentosList" class="receta-items-list">
              <p class="text-muted small mb-0">Seleccione primero el tipo de tratamiento.</p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="receta-items-card">
            <h6 class="mb-2"><i class="fa-solid fa-list-check me-2 text-primary"></i>Indicaciones</h6>
            <div id="recetaIndicacionesList" class="receta-items-list">
              <p class="text-muted small mb-0">Seleccione primero el tipo de tratamiento.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary btn-rounded" id="btnCancelarReceta2">Cancelar</button>
        <button type="button" class="btn btn-primary btn-rounded" id="btnGuardarReceta">
          <i class="fa-solid fa-floppy-disk me-1"></i>Guardar receta
        </button>
      </div>
    </div>
  `;
}

export async function bindRecetas(params = {}) {
  const { viewGen } = params;
  fechaInicio = localDateString();
  fechaFin = localDateString();
  filtroBusqueda = '';

  mountNuevoFab({
    id: 'btnNuevaRecetaPaciente',
    icon: 'fa-solid fa-plus',
    title: 'Nueva receta',
    onClick: () => openForm(),
  });

  bindPacienteSearch();

  document.getElementById('btnCancelarReceta')?.addEventListener('click', () => showPanel('list'));
  document.getElementById('btnCancelarReceta2')?.addEventListener('click', () => showPanel('list'));
  document.getElementById('btnGuardarReceta')?.addEventListener('click', saveReceta);

  document.getElementById('recetaCategoria')?.addEventListener('change', () => {
    refreshCategoriaItems();
  });

  document.getElementById('recetasSearch')?.addEventListener('input', (e) => {
    filtroBusqueda = e.target.value;
    renderTable();
  });

  const aplicarFiltro = async () => {
    fechaInicio = document.getElementById('filtroRecetaInicio')?.value || fechaInicio;
    fechaFin = document.getElementById('filtroRecetaFin')?.value || fechaFin;
    try {
      await loadRecetas(viewGen);
    } catch (error) {
      showAlert('recetasAlert', error.message);
    }
  };

  document.getElementById('filtroRecetaInicio')?.addEventListener('change', aplicarFiltro);
  document.getElementById('filtroRecetaFin')?.addEventListener('change', aplicarFiltro);

  document.getElementById('recetasTableBody')?.addEventListener('click', (e) => {
    const printBtn = e.target.closest('[data-print]');
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (printBtn) {
      handlePrint(printBtn.dataset.print);
      return;
    }
    if (editBtn) {
      const item = recetas.find((r) => r.ID == editBtn.dataset.edit);
      if (item) openForm(item);
    }
    if (deleteBtn) handleDelete(deleteBtn.dataset.delete, deleteBtn);
  });

  try {
    const [listaPacientes, listaConfig] = await Promise.all([
      api.pacientes.list(),
      api.configRecetas.list().catch(() => []),
    ]);
    if (viewGen && !isViewMounted(viewGen)) return;

    pacientes = listaPacientes || [];
    configRecetas = listaConfig || [];
    await loadRecetas(viewGen);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('recetasAlert', error.message);
    }
  }
}
