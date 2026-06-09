import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';

let codpacienteActual = null;
let pacienteActual = null;
let orders = [];
let productos = [];
let piezas = [];
let filtroEstado = 'PENDIENTES';

const D_FIELDS = [
  { key: 'D_ALERGIAS', label: 'Alergias' },
  { key: 'D_ASMA', label: 'Asma' },
  { key: 'D_HEPATITIS', label: 'Hepatitis' },
  { key: 'D_ANTIBIOTICOS', label: 'Antibióticos' },
  { key: 'D_VIH', label: 'VIH' },
  { key: 'D_HIPERTENSION', label: 'Hipertensión' },
  { key: 'D_HIPOTENSION', label: 'Hipotensión' },
  { key: 'D_TUBERCULOSIS', label: 'Tuberculosis' },
];

const E_FIELDS = [
  { key: 'E_MEDICAMENTOS', label: 'Medicamentos' },
  { key: 'E_SENSIBILIDAD_MEDICAMENTOS', label: 'Sensibilidad a medicamentos' },
  { key: 'E_DETALLES', label: 'Detalles' },
];

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatPrecio(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
  }).format(num);
}

function estadoBadge(realizado) {
  const finalizado = realizado === 'SI';
  return `<span class="badge-estado ${finalizado ? 'badge-estado-activo' : 'badge-estado-inactivo'}">
    ${finalizado ? 'Finalizado' : 'Pendiente'}
  </span>`;
}

function sortPiezas(list) {
  return [...list].sort((a, b) => {
    const aVal = String(a.PIEZA ?? '');
    const bVal = String(b.PIEZA ?? '');
    const aNum = /^\d+$/.test(aVal);
    const bNum = /^\d+$/.test(bVal);

    if (aNum && bNum) return Number(aVal) - Number(bVal);
    if (aNum) return -1;
    if (bNum) return 1;
    return aVal.localeCompare(bVal, 'es');
  });
}

function piezaOptionsHtml(selected = '') {
  return sortPiezas(piezas).map((p) => {
    const val = p.PIEZA;
    const sel = val === selected ? 'selected' : '';
    return `<option value="${val}" ${sel}>${val}</option>`;
  }).join('');
}

function filterProductos(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  return productos.filter((p) => {
    const cod = (p.CODPROD || '').toLowerCase();
    const des = (p.DESPROD || '').toLowerCase();
    return cod.includes(q) || des.includes(q);
  });
}

function addOrderFormHtml(producto) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Tratamiento</label>
        <input type="text" class="form-control" value="${producto.DESPROD || producto.CODPROD}" readonly>
      </div>
      <div class="mb-3">
        <label class="form-label">Pieza <span class="text-danger">*</span></label>
        <select id="swal-pieza" class="form-select">
          <option value="">— Seleccionar pieza —</option>
          ${piezaOptionsHtml()}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Precio <span class="text-danger">*</span></label>
        <input type="number" id="swal-precio" class="form-control" step="0.01" min="0" value="${producto.PRECIO ?? ''}">
      </div>
      <div class="mb-0">
        <label class="form-label">Observaciones</label>
        <textarea id="swal-obs" class="form-control" rows="2" maxlength="500" placeholder="Notas opcionales del tratamiento"></textarea>
      </div>
    </div>
  `;
}

function editOrderFormHtml(order) {
  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Tratamiento</label>
        <input type="text" class="form-control" value="${order.DESPROD || order.CODPROD}" readonly>
      </div>
      <div class="mb-3">
        <label class="form-label">Pieza <span class="text-danger">*</span></label>
        <select id="swal-pieza" class="form-select">
          <option value="">— Seleccionar pieza —</option>
          ${piezaOptionsHtml(order.PIEZA)}
        </select>
      </div>
      <div class="mb-0">
        <label class="form-label">Precio <span class="text-danger">*</span></label>
        <input type="number" id="swal-precio" class="form-control" step="0.01" min="0" value="${order.PRECIO ?? ''}">
      </div>
    </div>
  `;
}

function finalizarFormHtml(order, medicos, session) {
  const isMedico = session?.tipo === 'MEDICO';
  const medicoOptions = medicos.map((m) => `
    <option value="${m.CODEMP}">${m.EMPLEADO}</option>
  `).join('');

  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Empleado <span class="text-danger">*</span></label>
        <select id="swal-codemp" class="form-select" ${isMedico ? 'disabled' : ''}>
          <option value="">— Seleccionar médico —</option>
          ${medicoOptions}
        </select>
        ${isMedico ? `<input type="hidden" id="swal-codemp-locked" value="${session?.codemp || ''}">` : ''}
      </div>
      <div class="mb-3">
        <label class="form-label">Fecha de realización <span class="text-danger">*</span></label>
        <input type="date" id="swal-fecha-realizado" class="form-control" value="${todayInputDate()}">
      </div>
      <div class="mb-0">
        <label class="form-label">Precio final <span class="text-danger">*</span></label>
        <input type="number" id="swal-precio-final" class="form-control" step="0.01" min="0" value="${order.PRECIO ?? ''}">
      </div>
    </div>
  `;
}

function renderProductoSuggestions(items) {
  const list = document.getElementById('productoSuggestions');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = '<li class="paciente-suggestion-empty">No se encontraron tratamientos</li>';
    list.classList.add('open');
    return;
  }

  list.innerHTML = items.map((p) => `
    <li>
      <button type="button" class="paciente-suggestion-item producto-suggestion-item" data-id="${p.ID}">
        <span class="paciente-suggestion-nombre">${p.DESPROD || p.CODPROD}</span>
        <span class="paciente-suggestion-edad">${formatPrecio(p.PRECIO)}</span>
      </button>
    </li>
  `).join('');

  list.classList.add('open');
}

function hideProductoSuggestions() {
  document.getElementById('productoSuggestions')?.classList.remove('open');
}

function sortOrdersAsc(list) {
  return [...list].sort((a, b) => {
    const fechaA = String(a.FECHA || '');
    const fechaB = String(b.FECHA || '');
    if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
    return Number(a.ID) - Number(b.ID);
  });
}

function isOrderFinalizada(order) {
  return order.REALIZADO === 'SI' || Boolean(order.FECHA_REALIZADO);
}

function getOrdersFiltrados() {
  const sorted = sortOrdersAsc(orders);

  if (filtroEstado === 'PENDIENTES') {
    return sorted.filter((o) => !isOrderFinalizada(o));
  }

  if (filtroEstado === 'FINALIZADAS') {
    return sorted.filter((o) => isOrderFinalizada(o));
  }

  return sorted;
}

function getOrderMonto(order) {
  if (isOrderFinalizada(order)) {
    const final = Number(order.PRECIO_FINAL);
    return Number.isNaN(final) ? 0 : final;
  }

  const precio = Number(order.PRECIO);
  return Number.isNaN(precio) ? 0 : precio;
}

function calcularTotalFiltrado() {
  return getOrdersFiltrados().reduce((sum, order) => sum + getOrderMonto(order), 0);
}

function calcularTotalPrecio() {
  return getOrdersFiltrados().reduce((sum, order) => {
    const precio = Number(order.PRECIO);
    return sum + (Number.isNaN(precio) ? 0 : precio);
  }, 0);
}

function calcularTotalPrecioFinal() {
  return getOrdersFiltrados().reduce((sum, order) => {
    if (!isOrderFinalizada(order)) return sum;
    const final = Number(order.PRECIO_FINAL);
    return sum + (Number.isNaN(final) ? 0 : final);
  }, 0);
}

function updateTotalDisplay() {
  const totalEl = document.getElementById('ordersTotalMonto');
  if (totalEl) {
    totalEl.textContent = formatPrecio(calcularTotalFiltrado());
  }
}

function getFiltroLabel() {
  const labels = {
    TODAS: 'Todas',
    PENDIENTES: 'Pendientes',
    FINALIZADAS: 'Finalizadas',
  };
  return labels[filtroEstado] || filtroEstado;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printFieldValue(value) {
  const text = value?.toString().trim();
  return escapeHtml(text || '—');
}

function buildPrintPacienteSection(paciente) {
  if (!paciente) {
    return '<section class="paciente-info"><p class="paciente-empty">Sin datos del paciente</p></section>';
  }

  const datosBasicos = [
    { label: 'Nombre', value: paciente.NOMBRE },
    { label: 'Nacimiento', value: formatFecha(paciente.NACIMIENTO) },
    { label: 'Teléfonos', value: paciente.TELEFONOS },
    { label: 'Dirección', value: paciente.DIRECCION, wide: true },
  ].map(({ label, value, wide }) => `
    <div class="info-item${wide ? ' info-wide' : ''}">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${printFieldValue(value)}</span>
    </div>
  `).join('');

  const antecedentesSiNo = D_FIELDS.map(({ key, label }) => {
    const valor = paciente[key] === 'SI' ? 'SI' : 'NO';
    const clase = valor === 'SI' ? 'antecedente-si' : 'antecedente-no';
    return `
      <div class="antecedente-item ${clase}">
        <span class="antecedente-label">${escapeHtml(label)}</span>
        <span class="antecedente-valor">${valor}</span>
      </div>
    `;
  }).join('');

  const antecedentesTexto = E_FIELDS.map(({ key, label }) => `
    <div class="texto-item">
      <span class="texto-label">${escapeHtml(label)}</span>
      <span class="texto-value">${printFieldValue(paciente[key])}</span>
    </div>
  `).join('');

  return `
    <section class="paciente-info">
      <h2 class="section-title">Datos del paciente</h2>
      <div class="info-grid">${datosBasicos}</div>

      <h2 class="section-title">Antecedentes médicos</h2>
      <div class="antecedentes-grid">${antecedentesSiNo}</div>
      <div class="antecedentes-texto">${antecedentesTexto}</div>
    </section>
  `;
}

function mountPrintFab() {
  document.getElementById('btnPrintOrders')?.remove();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btnPrintOrders';
  btn.className = 'btn-print-fab';
  btn.setAttribute('aria-label', 'Imprimir tratamientos');
  btn.title = 'Imprimir lista';
  btn.innerHTML = '<i class="fa-solid fa-print"></i>';
  btn.addEventListener('click', () => printOrdersList());
  document.body.appendChild(btn);
}

function printOrdersList() {
  try {
    const filtrados = getOrdersFiltrados();
    const nombre = pacienteActual?.NOMBRE || `Paciente #${codpacienteActual}`;
    const totalInicial = formatPrecio(calcularTotalPrecio());
    const totalFinal = formatPrecio(calcularTotalPrecioFinal());
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const nombreSafe = escapeHtml(nombre);
    const filtroSafe = escapeHtml(getFiltroLabel());
    const logoUrl = escapeHtml(new URL('logo.jpeg', window.location.href).href);
    const pacienteSectionHtml = buildPrintPacienteSection(pacienteActual);

    const rowsHtml = filtrados.length === 0
      ? '<tr><td colspan="8" class="empty">No hay tratamientos para imprimir</td></tr>'
      : filtrados.map((o) => `
        <tr>
          <td class="nowrap">${escapeHtml(formatFecha(o.FECHA))}</td>
          <td class="center">${escapeHtml(o.PIEZA || '—')}</td>
          <td>${escapeHtml(o.DESPROD || '—')}</td>
          <td class="num">${escapeHtml(formatPrecio(o.PRECIO))}</td>
          <td class="center">${isOrderFinalizada(o) ? 'Finalizado' : 'Pendiente'}</td>
          <td class="nowrap">${escapeHtml(formatFecha(o.FECHA_REALIZADO))}</td>
          <td class="num">${isOrderFinalizada(o) ? escapeHtml(formatPrecio(o.PRECIO_FINAL)) : '—'}</td>
          <td class="obs">${escapeHtml(o.OBS || '—')}</td>
        </tr>
      `).join('');

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Tratamientos — ${nombreSafe}</title>
  <style>
    @page { size: letter; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 9pt;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.35;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #334155;
    }
    .header img {
      width: 72px;
      height: auto;
      object-fit: contain;
    }
    .header-text h1 {
      font-size: 11pt;
      font-weight: 700;
      margin: 0 0 3px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .header-text .subtitle {
      font-size: 9pt;
      margin: 0;
      color: #334155;
    }
    .meta {
      font-size: 8pt;
      color: #475569;
      margin-bottom: 10px;
    }
    .paciente-info {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .section-title {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e293b;
      margin: 0 0 6px;
    }
    .section-title + .info-grid,
    .section-title + .antecedentes-grid {
      margin-top: 0;
    }
    .paciente-info .section-title:not(:first-child) {
      margin-top: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px 10px;
      margin-bottom: 4px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .info-item.info-wide {
      grid-column: 1 / -1;
    }
    .info-label,
    .antecedente-label,
    .texto-label {
      font-size: 7pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .info-value,
    .texto-value {
      font-size: 8.5pt;
      font-weight: 600;
      color: #1e293b;
    }
    .antecedentes-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px 8px;
      margin-bottom: 8px;
    }
    .antecedente-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      font-size: 7.5pt;
    }
    .antecedente-item.antecedente-si {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .antecedente-valor {
      font-weight: 700;
    }
    .antecedentes-texto {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .texto-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .texto-value {
      font-weight: 500;
      white-space: pre-wrap;
    }
    .paciente-empty {
      font-size: 8pt;
      color: #64748b;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 4px 5px;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
    }
    th {
      background: #f1f5f9;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #1e293b;
    }
    td.empty {
      text-align: center;
      padding: 14px;
      color: #64748b;
    }
    td.center { text-align: center; }
    td.num { text-align: right; white-space: nowrap; }
    td.nowrap { white-space: nowrap; }
    td.obs { font-size: 7.5pt; color: #334155; }
    col.c-fecha { width: 9%; }
    col.c-pieza { width: 6%; }
    col.c-trat { width: 22%; }
    col.c-precio { width: 9%; }
    col.c-estado { width: 9%; }
    col.c-fecha-fin { width: 9%; }
    col.c-precio-fin { width: 9%; }
    col.c-obs { width: 27%; }
    .footer {
      margin-top: 36px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 8.5pt;
    }
    .footer-totals {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 48px;
    }
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .total {
      font-size: 10pt;
      font-weight: 700;
      color: #b91c1c;
    }
    .count {
      color: #475569;
      font-size: 8pt;
    }
    .firma-paciente {
      width: 280px;
      margin: 24px auto 0;
      text-align: center;
    }
    .firma-linea {
      height: 1px;
      background: #334155;
      margin-bottom: 6px;
    }
    .firma-label {
      margin: 0;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1e293b;
    }
    .firma-nombre {
      margin: 4px 0 0;
      font-size: 8.5pt;
      color: #475569;
    }
  </style>
</head>
<body>
  <header class="header">
    <img src="${logoUrl}" alt="Logo clínica">
    <div class="header-text">
      <h1>Tratamientos del paciente</h1>
      <p class="subtitle">${nombreSafe}</p>
    </div>
  </header>
  ${pacienteSectionHtml}
  <div class="meta">Filtro: ${filtroSafe} · Fecha de impresión: ${fechaImpresion}</div>
  <table>
    <colgroup>
      <col class="c-fecha"><col class="c-pieza"><col class="c-trat"><col class="c-precio">
      <col class="c-estado"><col class="c-fecha-fin"><col class="c-precio-fin"><col class="c-obs">
    </colgroup>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Pieza</th>
        <th>Tratamiento</th>
        <th>Precio</th>
        <th>Estado</th>
        <th>Fecha fin</th>
        <th>Precio final</th>
        <th>Observaciones</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <footer class="footer">
    <div class="footer-totals">
      <span class="count">${filtrados.length} tratamiento(s)</span>
      <div class="totals">
        <span class="total">Total Inicial: ${escapeHtml(totalInicial)}</span>
        <span class="total">Total Final: ${escapeHtml(totalFinal)}</span>
      </div>
    </div>
    <div class="firma-paciente">
      <div class="firma-linea"></div>
      <p class="firma-label">Firma del paciente</p>
      <p class="firma-nombre">${nombreSafe}</p>
    </div>
  </footer>
</body>
</html>`;

    let iframe = document.getElementById('ordersPrintFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ordersPrintFrame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      document.body.appendChild(iframe);
    }

    const printDoc = iframe.contentWindow?.document;
    if (!printDoc) {
      void alertError('No se pudo preparar la impresión');
      return;
    }

    printDoc.open();
    printDoc.write(printHtml);
    printDoc.close();

    const ejecutarPrint = () => {
      try {
        const logoImg = printDoc.querySelector('.header img');
        const lanzar = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        };

        if (logoImg && !logoImg.complete) {
          logoImg.onload = () => setTimeout(lanzar, 80);
          logoImg.onerror = () => setTimeout(lanzar, 80);
          return;
        }

        setTimeout(lanzar, 120);
      } catch (err) {
        void alertError(err.message || 'Error al imprimir');
      }
    };

    if (iframe.contentWindow?.document.readyState === 'complete') {
      ejecutarPrint();
    } else {
      iframe.onload = ejecutarPrint;
    }
  } catch (error) {
    void alertError(error.message || 'Error al imprimir');
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const filtrados = getOrdersFiltrados();

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted py-4">No hay tratamientos registrados para este paciente</td>
      </tr>
    `;
    updateTotalDisplay();
    return;
  }

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted py-4">No hay tratamientos con el filtro seleccionado</td>
      </tr>
    `;
    updateTotalDisplay();
    return;
  }

  tbody.innerHTML = filtrados.map((o) => {
    const pendiente = o.REALIZADO !== 'SI';

    return `
      <tr>
        <td>${formatFecha(o.FECHA)}</td>
        <td>${o.PIEZA || '—'}</td>
        <td>${o.CODPROD || '—'}</td>
        <td>${o.DESPROD || '—'}</td>
        <td>${formatPrecio(o.PRECIO)}</td>
        <td>${estadoBadge(o.REALIZADO)}</td>
        <td>${formatFecha(o.FECHA_REALIZADO)}</td>
        <td>${o.REALIZADO === 'SI' ? formatPrecio(o.PRECIO_FINAL) : '—'}</td>
        <td class="text-end orders-actions">
          ${pendiente ? `
            <button class="btn btn-sm btn-outline-success btn-action" data-finalizar="${o.ID}" title="Finalizar">
              Finalizar
            </button>
          ` : ''}
          ${pendiente ? `
            <button class="btn btn-sm btn-outline-primary btn-action" data-edit="${o.ID}" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
          ` : ''}
          <button class="btn btn-sm btn-outline-danger btn-action" data-delete="${o.ID}" title="Eliminar">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateTotalDisplay();
}

async function loadData(viewGen) {
  [pacienteActual, orders, productos, piezas] = await Promise.all([
    api.pacientes.get(codpacienteActual),
    api.orders.listByPaciente(codpacienteActual),
    api.productos.list(),
    api.piezas.list(),
  ]);

  if (viewGen && !isViewMounted(viewGen)) return;

  const nombreEl = document.getElementById('pacienteTratamientosNombre');
  if (nombreEl) {
    nombreEl.textContent = pacienteActual?.NOMBRE || `Paciente #${codpacienteActual}`;
  }

  orders = sortOrdersAsc(orders);
  renderOrdersTable();
  clearAlert('pacienteTratamientosAlert');
}

function bindProductoSearch() {
  const input = document.getElementById('productoSearch');
  const list = document.getElementById('productoSuggestions');

  if (!input || !list) return;

  input.addEventListener('input', () => {
    const query = input.value;
    if (query.trim().length < 3) {
      hideProductoSuggestions();
      return;
    }
    renderProductoSuggestions(filterProductos(query));
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 3) {
      renderProductoSuggestions(filterProductos(input.value));
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(hideProductoSuggestions, 150);
  });

  list.addEventListener('mousedown', async (e) => {
    const btn = e.target.closest('.producto-suggestion-item');
    if (!btn) return;

    const producto = productos.find((p) => p.ID == btn.dataset.id);
    if (!producto) return;

    input.value = '';
    hideProductoSuggestions();
    await openAddOrderForm(producto);
  });
}

async function openAddOrderForm(producto) {
  if (piezas.length === 0) {
    await alertError('No hay piezas registradas en el sistema');
    return;
  }

  const result = await openFormDialog({
    title: 'Agregar tratamiento',
    html: addOrderFormHtml(producto),
    width: '480px',
    preConfirm: async () => {
      const PIEZA = document.getElementById('swal-pieza').value;
      const PRECIO = document.getElementById('swal-precio').value;

      if (!PIEZA) {
        Swal.showValidationMessage('Debe seleccionar una pieza');
        return false;
      }

      if (!PRECIO && PRECIO !== 0) {
        Swal.showValidationMessage('El precio es requerido');
        return false;
      }

      try {
        const OBS = sanitizeText(document.getElementById('swal-obs')?.value, { maxLength: 500 });

        await api.orders.create({
          CODPACIENTE: Number(codpacienteActual),
          PIEZA,
          CODPROD: producto.CODPROD,
          DESPROD: producto.DESPROD,
          PRECIO: Number(PRECIO),
          FECHA: todayInputDate(),
          OBS: OBS || null,
        });
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  orders = sortOrdersAsc(await api.orders.listByPaciente(codpacienteActual));
  renderOrdersTable();
  await alertSuccess('Tratamiento agregado');
}

async function openEditOrderForm(order) {
  const result = await openFormDialog({
    title: 'Editar tratamiento',
    html: editOrderFormHtml(order),
    width: '480px',
    preConfirm: async () => {
      const PIEZA = document.getElementById('swal-pieza').value;
      const PRECIO = document.getElementById('swal-precio').value;

      if (!PIEZA) {
        Swal.showValidationMessage('Debe seleccionar una pieza');
        return false;
      }

      if (!PRECIO && PRECIO !== 0) {
        Swal.showValidationMessage('El precio es requerido');
        return false;
      }

      try {
        await api.orders.update(order.ID, {
          PIEZA,
          PRECIO: Number(PRECIO),
        });
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  orders = sortOrdersAsc(await api.orders.listByPaciente(codpacienteActual));
  renderOrdersTable();
  await alertSuccess('Tratamiento actualizado');
}

async function openFinalizarForm(order) {
  const session = getSession();
  let medicos = [];

  try {
    medicos = await api.empleados.medicos();
  } catch (error) {
    await alertError(error.message);
    return;
  }

  if (medicos.length === 0) {
    await alertError('No hay médicos habilitados registrados');
    return;
  }

  const result = await openFormDialog({
    title: 'Finalizar tratamiento',
    html: finalizarFormHtml(order, medicos, session),
    width: '480px',
    didOpen: () => {
      const lockedMedico = document.getElementById('swal-codemp-locked')?.value;
      if (lockedMedico) {
        document.getElementById('swal-codemp').value = lockedMedico;
      }
    },
    preConfirm: async () => {
      const CODEMP = document.getElementById('swal-codemp-locked')?.value
        || document.getElementById('swal-codemp').value;
      const FECHA_REALIZADO = document.getElementById('swal-fecha-realizado').value;
      const PRECIO_FINAL = document.getElementById('swal-precio-final').value;

      if (!CODEMP) {
        Swal.showValidationMessage('Debe seleccionar el médico');
        return false;
      }

      if (!FECHA_REALIZADO) {
        Swal.showValidationMessage('La fecha de realización es requerida');
        return false;
      }

      if (!PRECIO_FINAL && PRECIO_FINAL !== 0) {
        Swal.showValidationMessage('El precio final es requerido');
        return false;
      }

      try {
        await api.orders.finalizar(order.ID, {
          CODEMP: Number(CODEMP),
          FECHA_REALIZADO,
          PRECIO_FINAL: Number(PRECIO_FINAL),
        });
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  orders = sortOrdersAsc(await api.orders.listByPaciente(codpacienteActual));
  renderOrdersTable();
  await alertSuccess('Tratamiento finalizado');
}

async function handleDelete(id) {
  const order = orders.find((o) => o.ID == id);
  const nombre = order?.DESPROD || order?.CODPROD || id;

  const confirmed = await confirmAction({
    title: '¿Eliminar tratamiento?',
    text: `¿Desea eliminar "${nombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.orders.delete(id);
    orders = sortOrdersAsc(await api.orders.listByPaciente(codpacienteActual));
    renderOrdersTable();
    await alertSuccess('Tratamiento eliminado');
  } catch (error) {
    await alertError(error.message);
  }
}

export function renderPacienteTratamientos() {
  return `
    <div id="pacienteTratamientosAlert"></div>

    <div class="content-card view-paciente-tratamientos">
      <div class="content-card-header orders-card-header">
        <div class="orders-header-main">
          <button class="btn btn-sm btn-outline-secondary btn-rounded mb-2" id="btnVolverPacientes">
            <i class="fa-solid fa-arrow-left me-1"></i>Volver a pacientes
          </button>
          <div class="orders-title-row">
            <h5 class="mb-0">
              <i class="fa-solid fa-tooth me-2 text-primary"></i>
              Tratamientos de <span id="pacienteTratamientosNombre">...</span>
            </h5>
            <h3 class="orders-total-monto" id="ordersTotalMonto">Q 0.00</h3>
          </div>
        </div>
      </div>

      <div class="table-toolbar table-toolbar-split">
        <div class="producto-autocomplete table-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            type="search"
            id="productoSearch"
            class="form-control"
            placeholder="Buscar tratamiento para agregar (mín. 3 caracteres)..."
            autocomplete="off"
          >
          <ul class="paciente-suggestions" id="productoSuggestions"></ul>
        </div>
        <div class="toolbar-filtro">
          <label for="filtroEstadoOrders" class="toolbar-filtro-label">Estado</label>
          <select id="filtroEstadoOrders" class="form-select toolbar-filtro-select">
            <option value="TODAS">Todas</option>
            <option value="PENDIENTES" selected>Pendientes</option>
            <option value="FINALIZADAS">Finalizadas</option>
          </select>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Pieza</th>
              <th>Código</th>
              <th>Tratamiento</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Fecha fin</th>
              <th>Precio final</th>
              <th class="text-end" style="width: 220px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="ordersTableBody">
            <tr><td colspan="9" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindPacienteTratamientos(params = {}) {
  codpacienteActual = params.codpaciente;
  filtroEstado = 'PENDIENTES';

  if (!codpacienteActual) {
    window.location.hash = '#/pacientes';
    return;
  }

  document.getElementById('btnVolverPacientes')?.addEventListener('click', () => {
    window.location.hash = '#/pacientes';
  });

  bindProductoSearch();

  const filtroSelect = document.getElementById('filtroEstadoOrders');
  if (filtroSelect) filtroSelect.value = 'PENDIENTES';

  filtroSelect?.addEventListener('change', (e) => {
    filtroEstado = e.target.value;
    renderOrdersTable();
  });

  mountPrintFab();

  document.getElementById('ordersTableBody')?.addEventListener('click', (e) => {
    const finalizarBtn = e.target.closest('[data-finalizar]');
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (finalizarBtn) {
      const order = orders.find((o) => o.ID == finalizarBtn.dataset.finalizar);
      if (order) openFinalizarForm(order);
    }

    if (editBtn) {
      const order = orders.find((o) => o.ID == editBtn.dataset.edit);
      if (order) openEditOrderForm(order);
    }

    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.delete);
    }
  });

  try {
    await loadData(params.viewGen);
  } catch (error) {
    if (!params.viewGen || isViewMounted(params.viewGen)) {
      showAlert('pacienteTratamientosAlert', error.message);
    }
  }
}
