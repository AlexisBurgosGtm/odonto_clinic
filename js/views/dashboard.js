import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { alertError } from '../utils/swal.js';
import { isViewMounted } from '../utils/view.js';
import { formatLocalTime, localDateString } from '../utils/datetime.js';

let empresas = [];
let selectedEmpnit = '';
let selectedFecha = '';

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

function renderStats(stats) {
  const statIngresos = document.getElementById('statIngresos');
  const statCitas = document.getElementById('statCitas');
  const statPacientes = document.getElementById('statPacientes');
  const statPendientes = document.getElementById('statPendientes');
  const statEmpleados = document.getElementById('statEmpleados');
  const fechaLabel = document.getElementById('dashboardFechaLabel');

  if (!statIngresos) return;

  statIngresos.textContent = formatPrecio(stats.ingresos_dia);
  if (statCitas) statCitas.textContent = stats.citas_hoy;
  if (statPacientes) statPacientes.textContent = stats.pacientes.toLocaleString('es-CO');
  if (statPendientes) statPendientes.textContent = stats.tratamientos_pendientes;
  if (statEmpleados) statEmpleados.textContent = stats.empleados_activos;
  if (fechaLabel) fechaLabel.textContent = stats.fecha;

  const citasBody = document.getElementById('citasDiaBody');
  if (citasBody) {
    if (!stats.citas?.length) {
      citasBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">No hay citas programadas para esta fecha</td>
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
          <td colspan="3" class="text-center text-muted py-4">Sin ingresos registrados para esta fecha</td>
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
    fecha: selectedFecha,
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
  selectedFecha = hoy;

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
          <label for="filtroFecha" class="form-label fw-semibold">
            <i class="fa-solid fa-calendar me-1 text-primary"></i>Fecha
          </label>
          <input type="date" id="filtroFecha" class="form-control" value="${hoy}">
        </div>
        <div class="col-md-5">
          <p class="dashboard-subtitle mb-0">
            Resumen del día <strong id="dashboardFechaLabel">${hoy}</strong>
          </p>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl">
        <div class="stat-card stat-card-highlight">
          <div class="stat-card-icon" style="background: #fee2e2;">
            <i class="fa-solid fa-sack-dollar" style="color: #dc2626;"></i>
          </div>
          <div class="stat-card-value text-danger" id="statIngresos">$0</div>
          <div class="stat-card-label">Ingresos del día</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #e0f2fe;">
            <i class="fa-solid fa-calendar-check" style="color: #0ea5e9;"></i>
          </div>
          <div class="stat-card-value" id="statCitas">0</div>
          <div class="stat-card-label">Citas del día</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #d1fae5;">
            <i class="fa-solid fa-users" style="color: #10b981;"></i>
          </div>
          <div class="stat-card-value" id="statPacientes">0</div>
          <div class="stat-card-label">Pacientes</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #fef3c7;">
            <i class="fa-solid fa-tooth" style="color: #f59e0b;"></i>
          </div>
          <div class="stat-card-value" id="statPendientes">0</div>
          <div class="stat-card-label">Tratamientos pendientes</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #ede9fe;">
            <i class="fa-solid fa-user-doctor" style="color: #8b5cf6;"></i>
          </div>
          <div class="stat-card-value" id="statEmpleados">0</div>
          <div class="stat-card-label">Empleados activos</div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="content-card">
          <div class="content-card-header">
            <h5><i class="fa-solid fa-calendar-days me-2 text-primary"></i>Citas del día</h5>
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
            <h5><i class="fa-solid fa-coins me-2 text-danger"></i>Ingresos del día</h5>
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

    document.getElementById('filtroFecha')?.addEventListener('change', async (e) => {
      selectedFecha = e.target.value;
      await loadDashboard(viewGen);
    });
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      await alertError(error.message);
    }
  }
}
