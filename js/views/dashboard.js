import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { alertError } from '../utils/swal.js';
import { isViewMounted } from '../utils/view.js';
import { formatLocalTime, localDateString, monthStartDate } from '../utils/datetime.js';

let empresas = [];
let selectedEmpnit = '';
let fechaInicio = '';
let fechaFin = '';

function formatPrecio(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Q\u00a00.00';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatFechaLabel(fecha) {
  if (!fecha) return '—';
  const partes = fecha.split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function renderStats(stats) {
  const statIngresos = document.getElementById('statIngresos');
  const statCitas = document.getElementById('statCitas');
  const statGastos = document.getElementById('statGastos');
  const periodoLabel = document.getElementById('dashboardPeriodoLabel');

  if (!statIngresos) return;

  statIngresos.textContent = formatPrecio(stats.ingresos_periodo);
  if (statCitas) statCitas.textContent = stats.citas_periodo;
  if (statGastos) statGastos.textContent = formatPrecio(stats.gastos_periodo);
  if (periodoLabel) {
    periodoLabel.textContent = `${formatFechaLabel(stats.fechaInicio)} – ${formatFechaLabel(stats.fechaFin)}`;
  }

  const citasBody = document.getElementById('citasDiaBody');
  if (citasBody) {
    if (!stats.citas?.length) {
      citasBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">No hay citas en el periodo seleccionado</td>
        </tr>
      `;
    } else {
      citasBody.innerHTML = stats.citas.map((c) => `
        <tr>
          <td class="nowrap">${formatLocalTime(c.FECHA)}${c.FECHA_FIN ? ` – ${formatLocalTime(c.FECHA_FIN)}` : ''}</td>
          <td>${c.PACIENTE || '—'}</td>
          <td>${c.MEDICO || '—'}</td>
          <td>${c.MOTIVO || '—'}</td>
        </tr>
      `).join('');
    }
  }

  const ingresosBody = document.getElementById('ingresosDiaBody');
  if (ingresosBody) {
    if (!stats.ingresos?.length) {
      ingresosBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center text-muted py-4">Sin ingresos en el periodo seleccionado</td>
        </tr>
      `;
    } else {
      ingresosBody.innerHTML = stats.ingresos.map((t) => `
        <tr>
          <td>${t.PACIENTE || '—'}</td>
          <td>${t.OBS || '—'}</td>
          <td class="num text-danger fw-semibold">${formatPrecio(t.MONTO)}</td>
        </tr>
      `).join('');
    }
  }
}

async function loadDashboard(viewGen) {
  const stats = await api.dashboard.stats({
    empnit: selectedEmpnit || getSession()?.empnit,
    fechaInicio,
    fechaFin,
  });
  if (viewGen && !isViewMounted(viewGen)) return;
  renderStats(stats);
}

function renderEmpresaFilter() {
  const select = document.getElementById('filtroEmpresa');
  if (!select) return;

  const session = getSession();
  select.innerHTML = empresas.map((e) => `
    <option value="${e.EMPNIT}">${e.EMPRESA || e.EMPNIT}</option>
  `).join('');

  selectedEmpnit = session?.empnit || empresas[0]?.EMPNIT || '';
  select.value = selectedEmpnit;
}

export function renderDashboard() {
  const hoy = localDateString();
  const inicioMes = monthStartDate();
  fechaInicio = inicioMes;
  fechaFin = hoy;

  return `
    <div class="dashboard-header mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label for="filtroEmpresa" class="form-label fw-semibold">
            <i class="fa-solid fa-building me-1 text-primary"></i>Empresa
          </label>
          <select id="filtroEmpresa" class="form-select"></select>
        </div>
        <div class="col-md-3">
          <label for="filtroFechaInicio" class="form-label fw-semibold">
            <i class="fa-solid fa-calendar me-1 text-primary"></i>Fecha inicial
          </label>
          <input type="date" id="filtroFechaInicio" class="form-control" value="${inicioMes}">
        </div>
        <div class="col-md-3">
          <label for="filtroFechaFin" class="form-label fw-semibold">
            <i class="fa-solid fa-calendar-check me-1 text-primary"></i>Fecha final
          </label>
          <input type="date" id="filtroFechaFin" class="form-control" value="${hoy}">
        </div>
        <div class="col-md-2">
          <p class="dashboard-subtitle mb-0">
            Periodo<br><strong id="dashboardPeriodoLabel">${formatFechaLabel(inicioMes)} – ${formatFechaLabel(hoy)}</strong>
          </p>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-4">
        <div class="stat-card stat-card-highlight">
          <div class="stat-card-icon" style="background: #fee2e2;">
            <i class="fa-solid fa-sack-dollar" style="color: #dc2626;"></i>
          </div>
          <div class="stat-card-value text-danger" id="statIngresos">$0</div>
          <div class="stat-card-label">Ingresos del periodo</div>
        </div>
      </div>
      <div class="col-sm-4">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #e0f2fe;">
            <i class="fa-solid fa-calendar-check" style="color: #0ea5e9;"></i>
          </div>
          <div class="stat-card-value" id="statCitas">0</div>
          <div class="stat-card-label">Citas del periodo</div>
        </div>
      </div>
      <div class="col-sm-4">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #ffedd5;">
            <i class="fa-solid fa-receipt" style="color: #ea580c;"></i>
          </div>
          <div class="stat-card-value text-pago" id="statGastos">$0</div>
          <div class="stat-card-label">Gastos del periodo</div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="content-card">
          <div class="content-card-header">
            <h5><i class="fa-solid fa-calendar-days me-2 text-primary"></i>Citas del periodo</h5>
          </div>
          <div class="table-responsive">
            <table class="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Horario</th>
                  <th>Paciente</th>
                  <th>Médico</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody id="citasDiaBody">
                <tr>
                  <td colspan="4" class="text-center text-muted py-4">Cargando…</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="content-card">
          <div class="content-card-header">
            <h5><i class="fa-solid fa-coins me-2 text-danger"></i>Ingresos del periodo</h5>
          </div>
          <div class="table-responsive">
            <table class="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Observaciones</th>
                  <th class="text-end">Monto</th>
                </tr>
              </thead>
              <tbody id="ingresosDiaBody">
                <tr>
                  <td colspan="3" class="text-center text-muted py-4">Cargando…</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindDashboard(params = {}) {
  const { viewGen } = params;

  try {
    empresas = await api.empresas.list();
    if (viewGen && !isViewMounted(viewGen)) return;

    renderEmpresaFilter();
    await loadDashboard(viewGen);
    if (viewGen && !isViewMounted(viewGen)) return;

    document.getElementById('filtroEmpresa')?.addEventListener('change', async (e) => {
      selectedEmpnit = e.target.value;
      await loadDashboard(viewGen);
    });

    const onFechaChange = async () => {
      const inicio = document.getElementById('filtroFechaInicio')?.value;
      const fin = document.getElementById('filtroFechaFin')?.value;

      if (!inicio || !fin) return;

      if (inicio > fin) {
        await alertError('La fecha inicial no puede ser posterior a la final');
        return;
      }

      fechaInicio = inicio;
      fechaFin = fin;
      await loadDashboard(viewGen);
    };

    document.getElementById('filtroFechaInicio')?.addEventListener('change', onFechaChange);
    document.getElementById('filtroFechaFin')?.addEventListener('change', onFechaChange);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      await alertError(error.message);
    }
  }
}
