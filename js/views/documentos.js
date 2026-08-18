import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';
import { mountNuevoFab } from '../utils/nuevo-fab.js';
import { localDateString } from '../utils/datetime.js';
import { printFactura } from '../utils/print-factura.js';

let documentos = [];
let productos = [];
let pacientes = [];
let credenciales = null;
let itemsFactura = [];
let documentoEditando = null;
let fechaInicio = '';
let fechaFin = '';
let filtroEstado = '';

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

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tipoDteLabel(tipo) {
  return tipo === 'FPEQ' ? 'Pequeño contribuyente' : 'IVA normal';
}

function estadoBadge(estado) {
  const map = {
    CERTIFICADO: 'badge-estado-activo',
    PENDIENTE: 'badge-estado-pendiente',
    ERROR: 'badge-estado-inactivo',
    ANULADO: 'badge-estado-anulado',
  };
  return `<span class="badge-estado ${map[estado] || 'badge-tipo-default'}">${escapeHtml(estado || '—')}</span>`;
}

function importeItems() {
  return round2(itemsFactura.reduce((sum, item) => sum + (Number(item.TOTAL) || 0), 0));
}

function showPanel(panel) {
  document.getElementById('documentosListPanel')?.classList.toggle('d-none', panel !== 'list');
  document.getElementById('documentosFormPanel')?.classList.toggle('d-none', panel !== 'form');
  const fab = document.getElementById('btnNuevoDocumento');
  if (fab) fab.style.display = panel === 'list' ? '' : 'none';
}

function renderItemsTable() {
  const tbody = document.getElementById('docItemsBody');
  const totalEl = document.getElementById('docImporteTotal');
  if (totalEl) totalEl.textContent = formatPrecio(importeItems());
  if (!tbody) return;

  if (itemsFactura.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-3">Agregue tratamientos a la factura</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = itemsFactura.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.CODPROD)}</td>
      <td>${escapeHtml(item.DESPROD)}</td>
      <td class="num">${escapeHtml(item.CANTIDAD)}</td>
      <td class="num">${escapeHtml(formatPrecio(item.COSTO))}</td>
      <td class="num">${escapeHtml(formatPrecio(item.PRECIO))}</td>
      <td class="num">${escapeHtml(formatPrecio(item.TOTAL))}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger btn-action" data-remove-item="${index}" title="Quitar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function addItem(item) {
  const CANTIDAD = round2(Number(item.CANTIDAD) || 1);
  const PRECIO = round2(Number(item.PRECIO) || 0);
  const COSTO = round2(Number(item.COSTO) || 0);

  itemsFactura.push({
    CODPROD: String(item.CODPROD || '').trim(),
    DESPROD: String(item.DESPROD || '').trim(),
    CANTIDAD,
    COSTO,
    PRECIO,
    TOTAL: round2(CANTIDAD * PRECIO),
    ORDER_ID: item.ORDER_ID || null,
  });
  renderItemsTable();
}

function fillClienteFromPaciente(paciente) {
  document.getElementById('docNombre').value = paciente?.NOMBRE || '';
  document.getElementById('docDireccion').value = paciente?.DIRECCION || '';
  document.getElementById('docEmail').value = paciente?.EMAIL || '';
  document.getElementById('docCodpaciente').value = paciente?.CODPACIENTE || '';
}

function resetForm() {
  documentoEditando = null;
  itemsFactura = [];
  const hoy = localDateString();
  document.getElementById('docFormTitle').textContent = 'Nueva factura';
  document.getElementById('docFecha').value = hoy;
  document.getElementById('docNit').value = 'CF';
  document.getElementById('docNombre').value = '';
  document.getElementById('docDireccion').value = '';
  document.getElementById('docEmail').value = '';
  document.getElementById('docCodpaciente').value = '';
  document.getElementById('docPacienteBuscar').value = '';
  document.getElementById('docConcre').value = 'CONTADO';
  document.getElementById('docObs').value = '';
  document.getElementById('docTipoDte').value = tipoDteLabel(credenciales?.TIPO_CONTRIBUYENTE === 'PEQ' ? 'FPEQ' : 'FACT');
  renderItemsTable();
}

async function openForm(documento = null) {
  resetForm();

  if (documento) {
    const detalle = documento.items ? documento : await api.documentos.get(documento.ID);
    documentoEditando = detalle;
    itemsFactura = [...(detalle.items || [])];
    document.getElementById('docFormTitle').textContent = `Editar factura #${detalle.NUMERO}`;
    document.getElementById('docFecha').value = String(detalle.FECHA || '').split('T')[0];
    document.getElementById('docNit').value = detalle.NIT || 'CF';
    document.getElementById('docNombre').value = detalle.NOMBRE || '';
    document.getElementById('docDireccion').value = detalle.DIRECCION || '';
    document.getElementById('docEmail').value = detalle.EMAIL || '';
    document.getElementById('docCodpaciente').value = detalle.CODPACIENTE || '';
    document.getElementById('docConcre').value = detalle.CONCRE || 'CONTADO';
    document.getElementById('docObs').value = detalle.OBS || '';
    document.getElementById('docTipoDte').value = tipoDteLabel(detalle.TIPO_DTE);
    const paciente = pacientes.find((p) => p.CODPACIENTE == detalle.CODPACIENTE);
    if (paciente) document.getElementById('docPacienteBuscar').value = paciente.NOMBRE || '';
    renderItemsTable();
  }

  showPanel('form');
}

function collectDocumento() {
  return {
    FECHA: document.getElementById('docFecha').value,
    NIT: sanitizeText(document.getElementById('docNit').value, { maxLength: 20 }) || 'CF',
    NOMBRE: sanitizeText(document.getElementById('docNombre').value, { maxLength: 300 }),
    DIRECCION: sanitizeText(document.getElementById('docDireccion').value, { maxLength: 500 }),
    EMAIL: sanitizeText(document.getElementById('docEmail').value, { maxLength: 150 }),
    CODPACIENTE: document.getElementById('docCodpaciente').value || null,
    CONCRE: document.getElementById('docConcre').value,
    OBS: sanitizeText(document.getElementById('docObs').value, { maxLength: 500 }),
    items: itemsFactura,
  };
}

function renderTable() {
  const tbody = document.getElementById('documentosTableBody');
  if (!tbody) return;

  if (documentos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted py-4">
          No hay documentos del ${formatFecha(fechaInicio)} al ${formatFecha(fechaFin)}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = documentos.map((d) => `
    <tr>
      <td class="nowrap">${formatFecha(d.FECHA)}</td>
      <td>${escapeHtml(d.NUMERO)}</td>
      <td>${escapeHtml(d.NIT)}</td>
      <td>${escapeHtml(d.NOMBRE)}</td>
      <td>${escapeHtml(tipoDteLabel(d.TIPO_DTE))}</td>
      <td>${escapeHtml(d.CONCRE)}</td>
      <td class="num fw-semibold">${formatPrecio(d.IMPORTE)}</td>
      <td>${estadoBadge(d.ESTADO)}
        ${d.SERIE_FEL ? `<div class="fel-mini">${escapeHtml(d.SERIE_FEL)}-${escapeHtml(d.NUMERO_FEL)}</div>` : ''}
      </td>
      <td class="text-end transacciones-actions">
        <button class="btn btn-sm btn-outline-secondary btn-action" data-print="${d.ID}" title="Imprimir">
          <i class="fa-solid fa-print"></i>
        </button>
        ${['PENDIENTE', 'ERROR'].includes(d.ESTADO) ? `
          <button class="btn btn-sm btn-outline-success btn-action" data-certificar="${d.ID}" title="Certificar FEL">
            <i class="fa-solid fa-file-circle-check"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${d.ID}" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${d.ID}" title="Eliminar">
            <i class="fa-solid fa-trash"></i>
          </button>
        ` : ''}
        ${d.ESTADO === 'CERTIFICADO' ? `
          <button class="btn btn-sm btn-outline-danger btn-action" data-anular="${d.ID}" title="Anular FEL">
            <i class="fa-solid fa-ban"></i>
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadDocumentos(viewGen) {
  documentos = await api.documentos.list({ fechaInicio, fechaFin, estado: filtroEstado });
  if (viewGen && !isViewMounted(viewGen)) return;
  renderTable();
  clearAlert('documentosAlert');
}

async function saveDocumento(certificar) {
  const body = collectDocumento();

  if (!body.FECHA) {
    showAlert('documentosFormAlert', 'La fecha es requerida');
    return;
  }
  if (!body.NOMBRE) {
    showAlert('documentosFormAlert', 'El nombre del cliente es requerido');
    return;
  }
  if (!body.items.length) {
    showAlert('documentosFormAlert', 'Agregue al menos un tratamiento');
    return;
  }

  try {
    if (documentoEditando) {
      await api.documentos.update(documentoEditando.ID, body);
      if (certificar) await api.documentos.certificar(documentoEditando.ID);
    } else {
      await api.documentos.create({ ...body, certificar });
    }

    await loadDocumentos();
    showPanel('list');
    await alertSuccess(certificar ? 'Factura certificada' : 'Factura guardada');
  } catch (error) {
    showAlert('documentosFormAlert', error.message);
    if (certificar) {
      try {
        await loadDocumentos();
        showPanel('list');
      } catch (_) { /* keep form */ }
    }
  }
}

async function handlePrint(id) {
  try {
    const detalle = await api.documentos.get(id);
    printFactura(detalle, {
      empresa: getSession()?.empresa,
      emisor: credenciales,
    });
  } catch (error) {
    await alertError(error.message);
  }
}

async function handleCertificar(id) {
  const confirmed = await confirmAction({
    title: '¿Certificar ante SAT?',
    text: 'Se enviará el DTE a INFILE para firma y certificación FEL.',
    icon: 'question',
    confirmText: 'Certificar',
  });
  if (!confirmed) return;

  try {
    await api.documentos.certificar(id);
    await loadDocumentos();
    await alertSuccess('Documento certificado');
  } catch (error) {
    await alertError(error.message);
    await loadDocumentos();
  }
}

async function handleAnular(id) {
  const result = await openFormDialog({
    title: 'Anular factura FEL',
    html: `
      <div class="swal-form text-start">
        <label class="form-label">Motivo de anulación <span class="text-danger">*</span></label>
        <textarea id="swal-motivo" class="form-control" rows="3" maxlength="200" placeholder="Motivo requerido por SAT"></textarea>
      </div>
    `,
    preConfirm: async () => {
      const motivo = sanitizeText(document.getElementById('swal-motivo')?.value, { maxLength: 200 });
      if (!motivo) {
        Swal.showValidationMessage('El motivo es requerido');
        return false;
      }
      try {
        await api.documentos.anular(id, motivo);
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;
  await loadDocumentos();
  await alertSuccess('Documento anulado');
}

async function handleDelete(id) {
  const item = documentos.find((d) => d.ID == id);
  const confirmed = await confirmAction({
    title: '¿Eliminar factura?',
    text: `¿Desea eliminar el documento #${item?.NUMERO || id}?`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });
  if (!confirmed) return;

  try {
    await api.documentos.delete(id);
    await loadDocumentos();
    await alertSuccess('Documento eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

function bindPacienteSearch() {
  const input = document.getElementById('docPacienteBuscar');
  const list = document.getElementById('docPacienteSuggestions');
  if (!input || !list) return;

  const render = (items) => {
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
    const q = input.value.trim().toLowerCase();
    if (q.length < 3) {
      list.classList.remove('open');
      return;
    }
    render(pacientes.filter((p) => (p.NOMBRE || '').toLowerCase().includes(q)));
  });

  list.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.paciente-suggestion-item');
    if (!btn) return;
    const paciente = pacientes.find((p) => p.CODPACIENTE == btn.dataset.id);
    if (!paciente) return;
    input.value = paciente.NOMBRE || '';
    fillClienteFromPaciente(paciente);
    list.classList.remove('open');
  });
}

function bindProductoSearch() {
  const input = document.getElementById('docProductoBuscar');
  const list = document.getElementById('docProductoSuggestions');
  if (!input || !list) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      list.classList.remove('open');
      return;
    }
    const items = productos.filter((p) => {
      return (p.CODPROD || '').toLowerCase().includes(q) || (p.DESPROD || '').toLowerCase().includes(q);
    }).slice(0, 12);

    if (!items.length) {
      list.innerHTML = '<li class="paciente-suggestion-empty">No se encontraron tratamientos</li>';
    } else {
      list.innerHTML = items.map((p) => `
        <li>
          <button type="button" class="paciente-suggestion-item" data-id="${p.ID}">
            <span class="paciente-suggestion-nombre">${escapeHtml(p.DESPROD || p.CODPROD)}</span>
            <span class="paciente-suggestion-edad">${formatPrecio(p.PRECIO)}</span>
          </button>
        </li>
      `).join('');
    }
    list.classList.add('open');
  });

  list.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.paciente-suggestion-item');
    if (!btn) return;
    const producto = productos.find((p) => p.ID == btn.dataset.id);
    if (!producto) return;
    document.getElementById('docItemCod').value = producto.CODPROD || '';
    document.getElementById('docItemDes').value = producto.DESPROD || '';
    document.getElementById('docItemPrecio').value = producto.PRECIO ?? '';
    document.getElementById('docItemCosto').value = '0';
    document.getElementById('docItemCantidad').value = '1';
    input.value = '';
    list.classList.remove('open');
  });
}

async function consultarNit() {
  const nit = document.getElementById('docNit').value;
  if (!nit || nit.toUpperCase() === 'CF') {
    await alertError('Ingrese un NIT distinto de CF para consultar');
    return;
  }

  try {
    const data = await api.credencialesFel.consultarNit(nit);
    if (data.nombre) document.getElementById('docNombre').value = data.nombre;
    await alertSuccess(data.nombre ? `Cliente: ${data.nombre}` : (data.mensaje || 'Consulta realizada'));
  } catch (error) {
    await alertError(error.message);
  }
}

async function agregarDeTratamientos() {
  const codpaciente = document.getElementById('docCodpaciente').value;
  if (!codpaciente) {
    await alertError('Seleccione un paciente para cargar sus tratamientos');
    return;
  }

  try {
    const orders = await api.orders.listByPaciente(codpaciente);
    const pendientes = (orders || []).filter((o) => o.REALIZADO === 'SI' || o.PRECIO);
    if (!pendientes.length) {
      await alertError('El paciente no tiene tratamientos para facturar');
      return;
    }

    const options = pendientes.map((o) => `
      <label class="d-flex align-items-start gap-2 mb-2">
        <input type="checkbox" class="mt-1" value="${o.ID}">
        <span>${escapeHtml(o.DESPROD || o.CODPROD)} · Pieza ${escapeHtml(o.PIEZA || '—')} · ${formatPrecio(o.PRECIO_FINAL || o.PRECIO)}</span>
      </label>
    `).join('');

    const result = await openFormDialog({
      title: 'Tratamientos del paciente',
      html: `<div class="swal-form text-start" id="swal-orders-list">${options}</div>`,
      preConfirm: () => {
        const ids = [...document.querySelectorAll('#swal-orders-list input:checked')].map((el) => el.value);
        if (!ids.length) {
          Swal.showValidationMessage('Seleccione al menos un tratamiento');
          return false;
        }
        return ids;
      },
    });

    if (!result.isConfirmed) return;
    result.value.forEach((id) => {
      const order = pendientes.find((o) => String(o.ID) === String(id));
      if (!order) return;
      addItem({
        CODPROD: order.CODPROD,
        DESPROD: order.DESPROD || order.CODPROD,
        CANTIDAD: 1,
        COSTO: 0,
        PRECIO: order.PRECIO_FINAL || order.PRECIO,
        ORDER_ID: order.ID,
      });
    });
  } catch (error) {
    await alertError(error.message);
  }
}

export function renderDocumentos() {
  const hoy = localDateString();

  return `
    <div id="documentosAlert"></div>

    <div class="content-card view-documentos" id="documentosListPanel">
      <div class="content-card-header transacciones-header">
        <h5><i class="fa-solid fa-file-invoice me-2 text-primary"></i>Documentos FEL</h5>
      </div>

      <div class="transacciones-filtros">
        <div>
          <label for="filtroDocInicio" class="form-label">Fecha inicial</label>
          <input type="date" id="filtroDocInicio" class="form-control" value="${hoy}">
        </div>
        <div>
          <label for="filtroDocFin" class="form-label">Fecha final</label>
          <input type="date" id="filtroDocFin" class="form-control" value="${hoy}">
        </div>
        <div>
          <label for="filtroDocEstado" class="form-label">Estado</label>
          <select id="filtroDocEstado" class="form-select">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="CERTIFICADO">Certificados</option>
            <option value="ERROR">Con error</option>
            <option value="ANULADO">Anulados</option>
          </select>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>No.</th>
              <th>NIT</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Pago</th>
              <th class="text-end">Importe</th>
              <th>FEL</th>
              <th class="text-end" style="width: 210px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="documentosTableBody">
            <tr><td colspan="9" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="content-card view-documentos d-none" id="documentosFormPanel">
      <div class="content-card-header">
        <h5 id="docFormTitle">Nueva factura</h5>
        <button type="button" class="btn btn-sm btn-outline-secondary btn-rounded" id="btnCancelarDocumento">
          <i class="fa-solid fa-arrow-left me-1"></i>Volver
        </button>
      </div>

      <div id="documentosFormAlert"></div>

      <div class="row g-3 mb-3">
        <div class="col-md-3">
          <label class="form-label" for="docFecha">Fecha <span class="text-danger">*</span></label>
          <input type="date" id="docFecha" class="form-control">
        </div>
        <div class="col-md-3">
          <label class="form-label" for="docTipoDte">Tipo de factura</label>
          <input type="text" id="docTipoDte" class="form-control" readonly>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="docConcre">Pago (CONCRE)</label>
          <select id="docConcre" class="form-select">
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Paciente (opcional)</label>
          <div class="paciente-autocomplete">
            <input type="search" id="docPacienteBuscar" class="form-control" placeholder="Buscar paciente..." autocomplete="off">
            <input type="hidden" id="docCodpaciente">
            <ul class="paciente-suggestions" id="docPacienteSuggestions"></ul>
          </div>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="docNit">NIT cliente <span class="text-danger">*</span></label>
          <div class="input-group">
            <input type="text" id="docNit" class="form-control" maxlength="20" value="CF">
            <button class="btn btn-outline-primary" type="button" id="btnConsultarNit" title="Consultar NIT en INFILE">
              <i class="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>
        </div>
        <div class="col-md-5">
          <label class="form-label" for="docNombre">Nombre <span class="text-danger">*</span></label>
          <input type="text" id="docNombre" class="form-control" maxlength="300">
        </div>
        <div class="col-md-4">
          <label class="form-label" for="docEmail">Correo</label>
          <input type="email" id="docEmail" class="form-control" maxlength="150">
        </div>
        <div class="col-md-8">
          <label class="form-label" for="docDireccion">Dirección</label>
          <input type="text" id="docDireccion" class="form-control" maxlength="500">
        </div>
        <div class="col-md-4">
          <label class="form-label" for="docObs">Observaciones</label>
          <input type="text" id="docObs" class="form-control" maxlength="500">
        </div>
      </div>

      <h6 class="fel-section-title">Ítems a facturar</h6>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-md-4">
          <label class="form-label">Buscar tratamiento</label>
          <div class="paciente-autocomplete">
            <input type="search" id="docProductoBuscar" class="form-control" placeholder="Código o nombre..." autocomplete="off">
            <ul class="paciente-suggestions" id="docProductoSuggestions"></ul>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label">Código</label>
          <input id="docItemCod" class="form-control" maxlength="150">
        </div>
        <div class="col-md-3">
          <label class="form-label">Descripción</label>
          <input id="docItemDes" class="form-control" maxlength="300">
        </div>
        <div class="col-md-1">
          <label class="form-label">Cant.</label>
          <input id="docItemCantidad" type="number" class="form-control" min="0.01" step="0.01" value="1">
        </div>
        <div class="col-md-1">
          <label class="form-label">Costo</label>
          <input id="docItemCosto" type="number" class="form-control" min="0" step="0.01" value="0">
        </div>
        <div class="col-md-1">
          <label class="form-label">Precio</label>
          <input id="docItemPrecio" type="number" class="form-control" min="0" step="0.01">
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button type="button" class="btn btn-sm btn-outline-primary btn-rounded" id="btnAgregarItem">
          <i class="fa-solid fa-plus me-1"></i>Agregar ítem
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary btn-rounded" id="btnItemsPaciente">
          <i class="fa-solid fa-tooth me-1"></i>Cargar tratamientos del paciente
        </button>
      </div>

      <div class="table-responsive mb-3">
        <table class="table table-sm table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tratamiento</th>
              <th class="text-end">Cant.</th>
              <th class="text-end">Costo</th>
              <th class="text-end">Precio</th>
              <th class="text-end">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="docItemsBody"></tbody>
        </table>
      </div>

      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h4 class="mb-0">Total: <span id="docImporteTotal">Q 0.00</span></h4>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-outline-secondary btn-rounded" id="btnGuardarDocumento">
            Guardar
          </button>
          <button type="button" class="btn btn-primary btn-rounded" id="btnGuardarCertificar">
            <i class="fa-solid fa-file-circle-check me-1"></i>Guardar y certificar
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function bindDocumentos(params = {}) {
  const { viewGen } = params;
  fechaInicio = localDateString();
  fechaFin = localDateString();
  filtroEstado = '';

  mountNuevoFab({
    id: 'btnNuevoDocumento',
    icon: 'fa-solid fa-plus',
    title: 'Nueva factura',
    onClick: () => openForm(),
  });

  bindPacienteSearch();
  bindProductoSearch();

  document.getElementById('btnCancelarDocumento')?.addEventListener('click', () => showPanel('list'));
  document.getElementById('btnConsultarNit')?.addEventListener('click', consultarNit);
  document.getElementById('btnItemsPaciente')?.addEventListener('click', agregarDeTratamientos);
  document.getElementById('btnGuardarDocumento')?.addEventListener('click', () => saveDocumento(false));
  document.getElementById('btnGuardarCertificar')?.addEventListener('click', () => saveDocumento(true));

  document.getElementById('btnAgregarItem')?.addEventListener('click', () => {
    const CODPROD = document.getElementById('docItemCod').value.trim();
    const DESPROD = document.getElementById('docItemDes').value.trim();
    const CANTIDAD = document.getElementById('docItemCantidad').value;
    const COSTO = document.getElementById('docItemCosto').value;
    const PRECIO = document.getElementById('docItemPrecio').value;

    if (!CODPROD || !DESPROD) {
      showAlert('documentosFormAlert', 'Indique código y descripción del tratamiento');
      return;
    }
    if (!PRECIO || Number(PRECIO) < 0) {
      showAlert('documentosFormAlert', 'El precio es requerido');
      return;
    }

    addItem({ CODPROD, DESPROD, CANTIDAD, COSTO, PRECIO });
    document.getElementById('docItemCod').value = '';
    document.getElementById('docItemDes').value = '';
    document.getElementById('docItemCantidad').value = '1';
    document.getElementById('docItemCosto').value = '0';
    document.getElementById('docItemPrecio').value = '';
    clearAlert('documentosFormAlert');
  });

  document.getElementById('docItemsBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-item]');
    if (!btn) return;
    itemsFactura.splice(Number(btn.dataset.removeItem), 1);
    renderItemsTable();
  });

  const aplicarFiltro = async () => {
    fechaInicio = document.getElementById('filtroDocInicio')?.value || fechaInicio;
    fechaFin = document.getElementById('filtroDocFin')?.value || fechaFin;
    filtroEstado = document.getElementById('filtroDocEstado')?.value || '';
    try {
      await loadDocumentos(viewGen);
    } catch (error) {
      showAlert('documentosAlert', error.message);
    }
  };

  document.getElementById('filtroDocInicio')?.addEventListener('change', aplicarFiltro);
  document.getElementById('filtroDocFin')?.addEventListener('change', aplicarFiltro);
  document.getElementById('filtroDocEstado')?.addEventListener('change', aplicarFiltro);

  document.getElementById('documentosTableBody')?.addEventListener('click', async (e) => {
    const printBtn = e.target.closest('[data-print]');
    const certBtn = e.target.closest('[data-certificar]');
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const anularBtn = e.target.closest('[data-anular]');

    if (printBtn) return handlePrint(printBtn.dataset.print);
    if (certBtn) return handleCertificar(certBtn.dataset.certificar);
    if (anularBtn) return handleAnular(anularBtn.dataset.anular);
    if (deleteBtn) return handleDelete(deleteBtn.dataset.delete);
    if (editBtn) {
      const item = documentos.find((d) => d.ID == editBtn.dataset.edit);
      if (item) openForm(item);
    }
  });

  try {
    const [docsCred, docsPacientes, docsProductos] = await Promise.all([
      api.credencialesFel.emisor().catch(() => null),
      api.pacientes.list().catch(() => []),
      api.productos.list().catch(() => []),
    ]);
    if (viewGen && !isViewMounted(viewGen)) return;

    credenciales = docsCred;
    pacientes = docsPacientes || [];
    productos = docsProductos || [];

    await loadDocumentos(viewGen);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('documentosAlert', error.message);
    }
  }
}
