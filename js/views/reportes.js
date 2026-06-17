import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError } from '../utils/swal.js';
import { isViewMounted } from '../utils/view.js';
import { printReporte } from '../utils/print-reporte.js';

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

const TIPOS_REPORTE = [
  { value: 'ABONOS', label: 'ABONOS CLIENTES' },
  { value: 'GASTOS', label: 'GASTOS' },
  { value: 'TRATAMIENTOS', label: 'TRATAMIENTOS FINALIZADOS' },
];

let reporteActual = null;
let filtroMes = new Date().getMonth() + 1;
let filtroAnio = new Date().getFullYear();
let filtroTipo = 'ABONOS';

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

function getTipoLabel() {
  return TIPOS_REPORTE.find((t) => t.value === filtroTipo)?.label || filtroTipo;
}

function renderPreviewTable() {
  const thead = document.getElementById('reportesTableHead');
  const tbody = document.getElementById('reportesTableBody');
  const totalEl = document.getElementById('reportesTotal');
  const periodoEl = document.getElementById('reportesPeriodoLabel');
  const tipoEl = document.getElementById('reportesTipoLabel');
  const btnPrint = document.getElementById('btnImprimirReporte');

  if (periodoEl) periodoEl.textContent = getPeriodoLabel();
  if (tipoEl) tipoEl.textContent = getTipoLabel();

  if (!thead || !tbody) return;

  if (!reporteActual) {
    thead.innerHTML = '';
    tbody.innerHTML = `
      <tr>
        <td class="text-center text-muted py-4">Seleccione mes, año y tipo de reporte</td>
      </tr>
    `;
    if (totalEl) totalEl.textContent = formatPrecio(0);
    if (btnPrint) btnPrint.disabled = true;
    return;
  }

  if (btnPrint) btnPrint.disabled = false;
  if (totalEl) totalEl.textContent = formatPrecio(reporteActual.total);

  const filas = reporteActual.filas || [];

  if (filtroTipo === 'ABONOS') {
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Paciente</th>
        <th>Observaciones</th>
        <th class="text-end">Monto</th>
      </tr>
    `;

    if (!filas.length) {
      tbody.innerHTML = `
        <tr><td colspan="4" class="text-center text-muted py-4">Sin registros en el periodo</td></tr>
      `;
      return;
    }

    tbody.innerHTML = filas.map((row) => `
      <tr>
        <td class="nowrap">${formatFecha(row.FECHA)}</td>
        <td>${row.PACIENTE || '—'}</td>
        <td>${row.OBS || '—'}</td>
        <td class="num text-danger fw-semibold">${formatPrecio(row.MONTO)}</td>
      </tr>
    `).join('');
    return;
  }

  if (filtroTipo === 'GASTOS') {
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Tipo</th>
        <th>Descripción</th>
        <th class="text-end">Importe</th>
      </tr>
    `;

    if (!filas.length) {
      tbody.innerHTML = `
        <tr><td colspan="4" class="text-center text-muted py-4">Sin registros en el periodo</td></tr>
      `;
      return;
    }

    tbody.innerHTML = filas.map((row) => `
      <tr>
        <td class="nowrap">${formatFecha(row.FECHA)}</td>
        <td>${row.TIPO || '—'}</td>
        <td>${row.DESCRIPCION || '—'}</td>
        <td class="num text-pago fw-semibold">${formatPrecio(row.IMPORTE)}</td>
      </tr>
    `).join('');
    return;
  }

  thead.innerHTML = `
    <tr>
      <th>Fecha</th>
      <th>Paciente</th>
      <th>Tratamiento</th>
      <th>Pieza</th>
      <th>Médico</th>
      <th class="text-end">Precio final</th>
    </tr>
  `;

  if (!filas.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted py-4">Sin registros en el periodo</td></tr>
    `;
    return;
  }

  tbody.innerHTML = filas.map((row) => `
    <tr>
      <td class="nowrap">${formatFecha(row.FECHA_REALIZADO)}</td>
      <td>${row.PACIENTE || '—'}</td>
      <td>${row.DESPROD || '—'}</td>
      <td>${row.PIEZA || '—'}</td>
      <td>${row.MEDICO || '—'}</td>
      <td class="num fw-semibold">${formatPrecio(row.PRECIO_FINAL)}</td>
    </tr>
  `).join('');
}

async function loadReporte(viewGen) {
  reporteActual = await api.reportes.get({
    mes: filtroMes,
    anio: filtroAnio,
    tipo: filtroTipo,
  });

  if (viewGen && !isViewMounted(viewGen)) return;

  renderPreviewTable();
  clearAlert('reportesAlert');
}

function renderFiltros() {
  const mesSelect = document.getElementById('filtroReportesMes');
  const anioInput = document.getElementById('filtroReportesAnio');
  const tipoSelect = document.getElementById('filtroReportesTipo');

  if (mesSelect) {
    mesSelect.innerHTML = MESES.map((m) => `
      <option value="${m.value}" ${m.value === filtroMes ? 'selected' : ''}>${m.label}</option>
    `).join('');
  }

  if (anioInput) anioInput.value = filtroAnio;

  if (tipoSelect) {
    tipoSelect.innerHTML = TIPOS_REPORTE.map((t) => `
      <option value="${t.value}" ${t.value === filtroTipo ? 'selected' : ''}>${t.label}</option>
    `).join('');
  }
}

export function renderReportes() {
  const anioActual = new Date().getFullYear();

  return `
    <div id="reportesAlert"></div>

    <div class="content-card view-reportes">
      <div class="content-card-header reportes-header">
        <div>
          <h5 class="mb-1"><i class="fa-solid fa-file-lines me-2 text-primary"></i>Reportes</h5>
          <p class="reportes-subtitle mb-0">
            <span id="reportesTipoLabel">${getTipoLabel()}</span>
            · <span id="reportesPeriodoLabel">${getPeriodoLabel()}</span>
            · Total: <strong class="text-danger" id="reportesTotal">Q 0.00</strong>
          </p>
        </div>
        <div class="reportes-filtros">
          <div class="reportes-filtro-item">
            <label for="filtroReportesMes" class="form-label">Mes</label>
            <select id="filtroReportesMes" class="form-select"></select>
          </div>
          <div class="reportes-filtro-item">
            <label for="filtroReportesAnio" class="form-label">Año</label>
            <input type="number" id="filtroReportesAnio" class="form-control" min="2000" max="2100" value="${anioActual}">
          </div>
          <div class="reportes-filtro-item reportes-filtro-tipo">
            <label for="filtroReportesTipo" class="form-label">Tipo de reporte</label>
            <select id="filtroReportesTipo" class="form-select"></select>
          </div>
          <div class="reportes-filtro-item reportes-filtro-action">
            <label class="form-label d-none d-md-block">&nbsp;</label>
            <button type="button" class="btn btn-primary btn-rounded w-100" id="btnImprimirReporte" disabled>
              <i class="fa-solid fa-print me-1"></i>Imprimir
            </button>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead id="reportesTableHead"></thead>
          <tbody id="reportesTableBody">
            <tr><td class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindReportes(params = {}) {
  const { viewGen } = params;
  const now = new Date();
  filtroMes = now.getMonth() + 1;
  filtroAnio = now.getFullYear();
  filtroTipo = 'ABONOS';

  renderFiltros();
  renderPreviewTable();

  const onFiltroChange = async () => {
    await loadReporte(viewGen);
  };

  document.getElementById('filtroReportesMes')?.addEventListener('change', async (e) => {
    filtroMes = Number(e.target.value);
    await onFiltroChange();
  });

  document.getElementById('filtroReportesAnio')?.addEventListener('change', async (e) => {
    filtroAnio = Number(e.target.value);
    if (filtroAnio) await onFiltroChange();
  });

  document.getElementById('filtroReportesTipo')?.addEventListener('change', async (e) => {
    filtroTipo = e.target.value;
    await onFiltroChange();
  });

  document.getElementById('btnImprimirReporte')?.addEventListener('click', () => {
    if (!reporteActual) return;
    printReporte(reporteActual, { empresa: getSession()?.empresa });
  });

  try {
    await loadReporte(viewGen);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('reportesAlert', error.message);
    }
  }
}
