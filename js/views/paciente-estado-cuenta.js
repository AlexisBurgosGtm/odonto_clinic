import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError } from '../utils/swal.js';
import { removePrintFab } from '../utils/floating-ui.js';
import { getPrintLogoUrl } from '../utils/empresa-logo.js';
import { getEmpresaPrintData, empresaContactHtml, empresaContactCss } from '../utils/empresa-print.js';
import { isViewMounted } from '../utils/view.js';

let codpacienteActual = null;
let estadoCuenta = null;

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

function tipoBadge(tipo) {
  if (tipo === 'ABONO') {
    return '<span class="badge-tipo badge-tipo-abono">ABONO</span>';
  }
  return '<span class="badge-tipo badge-tipo-pago">PAGO</span>';
}

function montoCelda(tipo, monto) {
  const valor = formatPrecio(monto);
  if (tipo === 'PAGO') {
    return `<span class="text-pago">-${valor}</span>`;
  }
  return `<span class="text-abono">+${valor}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printMontoCelda(tipo, monto) {
  const valor = escapeHtml(formatPrecio(monto));
  if (tipo === 'PAGO') {
    return `<span class="monto-pago">-${valor}</span>`;
  }
  return `<span class="monto-abono">+${valor}</span>`;
}

function printTipoLabel(tipo) {
  if (tipo === 'ABONO') return 'ABONO';
  return 'PAGO';
}

function mountPrintFab() {
  removePrintFab();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btnPrintEstadoCuenta';
  btn.className = 'btn-print-fab';
  btn.setAttribute('aria-label', 'Imprimir estado de cuenta');
  btn.title = 'Imprimir estado de cuenta';
  btn.innerHTML = '<i class="fa-solid fa-print"></i>';
  btn.addEventListener('click', () => printEstadoCuenta());
  document.body.appendChild(btn);
}

function printEstadoCuenta() {
  try {
    if (!estadoCuenta) {
      void alertError('No hay datos del estado de cuenta para imprimir');
      return;
    }

    const nombre = estadoCuenta.paciente || `Paciente #${codpacienteActual}`;
    const nombreSafe = escapeHtml(nombre);
    const empresaInfo = getEmpresaPrintData(getSession()?.empresa);
    const empresaSafe = escapeHtml(empresaInfo.nombre);
    const contactoHtml = empresaContactHtml(empresaInfo);
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const logoUrl = escapeHtml(getPrintLogoUrl());

    const totalAbonos = escapeHtml(formatPrecio(estadoCuenta.totalAbonos || 0));
    const totalPagos = escapeHtml(formatPrecio(estadoCuenta.totalPagos || 0));
    const saldo = Number(estadoCuenta.saldo) || 0;
    const saldoSafe = escapeHtml(formatPrecio(saldo));
    const saldoClase = saldo >= 0 ? 'resumen-abono' : 'resumen-pago';

    const historial = estadoCuenta.historial || [];
    const rowsHtml = historial.length === 0
      ? '<tr><td colspan="5" class="empty">No hay movimientos registrados</td></tr>'
      : historial.map((t) => {
        const saldoRow = Number(t.SALDO) || 0;
        const saldoRowClase = saldoRow >= 0 ? 'monto-abono' : 'monto-pago';

        return `
          <tr>
            <td class="nowrap">${escapeHtml(formatFecha(t.FECHA))}</td>
            <td class="center tipo-${t.TIPO === 'ABONO' ? 'abono' : 'pago'}">${printTipoLabel(t.TIPO)}</td>
            <td class="num">${printMontoCelda(t.TIPO, t.MONTO)}</td>
            <td class="obs">${escapeHtml(t.OBS || '—')}</td>
            <td class="num ${saldoRowClase}">${escapeHtml(formatPrecio(t.SALDO))}</td>
          </tr>
        `;
      }).join('');

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de cuenta — ${nombreSafe}</title>
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
    .header-text .empresa {
      font-size: 8pt;
      margin: 2px 0 0;
      color: #64748b;
    }
    ${empresaContactCss()}
    .meta {
      font-size: 8pt;
      color: #475569;
      margin-bottom: 12px;
    }
    .resumen {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .resumen-item {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .resumen-label {
      display: block;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      margin-bottom: 3px;
    }
    .resumen-value {
      font-size: 10pt;
      font-weight: 700;
    }
    .resumen-abono { color: #059669; }
    .resumen-pago { color: #dc2626; }
    .resumen-saldo { color: #1d4ed8; }
    .leyenda {
      font-size: 7.5pt;
      color: #64748b;
      margin: 0 0 10px;
      padding: 6px 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
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
    .tipo-abono { color: #059669; font-weight: 700; }
    .tipo-pago { color: #dc2626; font-weight: 700; }
    .monto-abono { color: #059669; font-weight: 600; }
    .monto-pago { color: #dc2626; font-weight: 600; }
    col.c-fecha { width: 12%; }
    col.c-tipo { width: 10%; }
    col.c-monto { width: 14%; }
    col.c-obs { width: 44%; }
    col.c-saldo { width: 20%; }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      color: #64748b;
      text-align: center;
    }
    .saldo-final {
      margin-top: 14px;
      text-align: right;
      font-size: 10pt;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <header class="header">
    <img src="${logoUrl}" alt="Logo clínica">
    <div class="header-text">
      <h1>Estado de cuenta</h1>
      <p class="subtitle">${nombreSafe}</p>
      <p class="empresa">${empresaSafe}</p>
      ${contactoHtml}
    </div>
  </header>
  <div class="meta">Fecha de impresión: ${fechaImpresion}</div>
  <div class="resumen">
    <div class="resumen-item">
      <span class="resumen-label">Total abonos</span>
      <span class="resumen-value resumen-abono">${totalAbonos}</span>
    </div>
    <div class="resumen-item">
      <span class="resumen-label">Total tratamientos</span>
      <span class="resumen-value resumen-pago">${totalPagos}</span>
    </div>
    <div class="resumen-item">
      <span class="resumen-label">Saldo a favor</span>
      <span class="resumen-value ${saldoClase}">${saldoSafe}</span>
    </div>
  </div>
  <p class="leyenda">
    ABONO aumenta el saldo a favor · PAGO corresponde a tratamientos finalizados (precio final)
  </p>
  <table>
    <colgroup>
      <col class="c-fecha"><col class="c-tipo"><col class="c-monto"><col class="c-obs"><col class="c-saldo">
    </colgroup>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Tipo</th>
        <th>Monto</th>
        <th>Observaciones</th>
        <th>Saldo</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="saldo-final ${saldoClase}">Saldo a favor: ${saldoSafe}</div>
  <footer class="footer">
    Documento generado para consulta del paciente · ${empresaSafe}
  </footer>
</body>
</html>`;

    let iframe = document.getElementById('estadoCuentaPrintFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'estadoCuentaPrintFrame';
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

function renderEstadoCuenta() {
  const nombreEl = document.getElementById('estadoCuentaNombre');
  const saldoEl = document.getElementById('estadoCuentaSaldo');
  const abonosEl = document.getElementById('estadoCuentaAbonos');
  const pagosEl = document.getElementById('estadoCuentaPagos');
  const tbody = document.getElementById('estadoCuentaTableBody');

  if (!tbody) return;

  const nombre = estadoCuenta?.paciente || `Paciente #${codpacienteActual}`;
  if (nombreEl) nombreEl.textContent = nombre;

  const saldo = Number(estadoCuenta?.saldo) || 0;
  if (saldoEl) {
    saldoEl.textContent = formatPrecio(saldo);
    saldoEl.classList.toggle('text-abono', saldo >= 0);
    saldoEl.classList.toggle('text-pago', saldo < 0);
  }

  if (abonosEl) abonosEl.textContent = formatPrecio(estadoCuenta?.totalAbonos || 0);
  if (pagosEl) pagosEl.textContent = formatPrecio(estadoCuenta?.totalPagos || 0);

  const historial = estadoCuenta?.historial || [];

  if (historial.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">No hay movimientos registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = historial.map((t) => `
    <tr>
      <td class="nowrap">${formatFecha(t.FECHA)}</td>
      <td>${tipoBadge(t.TIPO)}</td>
      <td class="num">${montoCelda(t.TIPO, t.MONTO)}</td>
      <td>${t.OBS || '—'}</td>
      <td class="num fw-semibold ${Number(t.SALDO) >= 0 ? 'text-abono' : 'text-pago'}">${formatPrecio(t.SALDO)}</td>
    </tr>
  `).join('');
}

async function loadEstadoCuenta(viewGen) {
  estadoCuenta = await api.transacciones.estadoCuenta(codpacienteActual);
  if (viewGen && !isViewMounted(viewGen)) return;
  renderEstadoCuenta();
  clearAlert('estadoCuentaAlert');
}

export function renderPacienteEstadoCuenta() {
  return `
    <div id="estadoCuentaAlert"></div>

    <div class="content-card view-estado-cuenta">
      <div class="content-card-header">
        <div>
          <button class="btn btn-sm btn-outline-secondary btn-rounded mb-2" id="btnVolverPacientes" type="button">
            <i class="fa-solid fa-arrow-left me-1"></i>Volver a pacientes
          </button>
          <h5 class="mb-0">
            <i class="fa-solid fa-file-invoice-dollar me-2 text-primary"></i>
            Estado de cuenta — <span id="estadoCuentaNombre">...</span>
          </h5>
        </div>
      </div>

      <div class="estado-cuenta-resumen row g-3 mb-4">
        <div class="col-md-4">
          <div class="estado-cuenta-card estado-cuenta-card-abono">
            <span class="estado-cuenta-card-label">Total abonos</span>
            <span class="estado-cuenta-card-value" id="estadoCuentaAbonos">Q 0.00</span>
          </div>
        </div>
        <div class="col-md-4">
          <div class="estado-cuenta-card estado-cuenta-card-pago">
            <span class="estado-cuenta-card-label">Total tratamientos</span>
            <span class="estado-cuenta-card-value" id="estadoCuentaPagos">Q 0.00</span>
          </div>
        </div>
        <div class="col-md-4">
          <div class="estado-cuenta-card estado-cuenta-card-saldo">
            <span class="estado-cuenta-card-label">Saldo a favor</span>
            <span class="estado-cuenta-card-value" id="estadoCuentaSaldo">Q 0.00</span>
          </div>
        </div>
      </div>

      <p class="estado-cuenta-leyenda">
        <span class="badge-tipo badge-tipo-abono">ABONO</span> aumenta el saldo a favor ·
        <span class="badge-tipo badge-tipo-pago">PAGO</span> corresponde a tratamientos finalizados (precio final)
      </p>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Observaciones</th>
              <th class="text-end">Saldo</th>
            </tr>
          </thead>
          <tbody id="estadoCuentaTableBody">
            <tr><td colspan="5" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindPacienteEstadoCuenta(params = {}) {
  codpacienteActual = params.codpaciente;

  if (!codpacienteActual) {
    window.location.hash = '#/pacientes';
    return;
  }

  document.getElementById('btnVolverPacientes')?.addEventListener('click', () => {
    window.location.hash = '#/pacientes';
  });

  mountPrintFab();

  try {
    await loadEstadoCuenta(params.viewGen);
  } catch (error) {
    if (!params.viewGen || isViewMounted(params.viewGen)) {
      showAlert('estadoCuentaAlert', error.message);
    }
  }
}
