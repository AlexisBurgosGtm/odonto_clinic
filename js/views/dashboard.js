import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { alertError } from '../utils/swal.js';

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

function formatHora(fecha) {
  if (!fecha) return '—';
  const str = String(fecha);
  if (str.includes('T')) return str.slice(11, 16);
  const part = str.split(' ')[1];
  return part ? part.slice(0, 5) : '—';
}

function renderStats(stats) {
  document.getElementById('statIngresos').textContent = formatPrecio(stats.ingresos_dia);
  document.getElementById('statCitas').textContent = stats.citas_hoy;
  document.getElementById('statPacientes').textContent = stats.pacientes.toLocaleString('es-CO');
  document.getElementById('statPendientes').textContent = stats.tratamientos_pendientes;
  document.getElementById('statEmpleados').textContent = stats.empleados_activos;
  document.getElementById('dashboardFechaLabel').textContent = stats.fecha;

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
          <td class="nowrap">${formatHora(c.FECHA)}${c.FECHA_FIN ? ` – ${formatHora(c.FECHA_FIN)}` : ''}</td>
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
      ingresosBody.innerHTML = stats.ingresos.map((o) => `
        <tr>
          <td>${o.PACIENTE || '—'}</td>
          <td>${o.DESPROD || '—'}</td>
          <td class="num text-danger fw-semibold">${formatPrecio(o.PRECIO_FINAL)}</td>
        </tr>
      `).join('');
    }
  }
}

async function loadDashboard() {
  const stats = await api.dashboard.stats({
    empnit: selectedEmpnit || getSession()?.empnit,
    fecha: selectedFecha,
  });
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
  const hoy = new Date().toISOString().slice(0, 10);
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
                  <th>Tratamiento</th>
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

export async function bindDashboard() {
  try {
    empresas = await api.empresas.list();
    renderEmpresaFilter();
    await loadDashboard();

    document.getElementById('filtroEmpresa')?.addEventListener('change', async (e) => {
      selectedEmpnit = e.target.value;
      await loadDashboard();
    });

    document.getElementById('filtroFecha')?.addEventListener('change', async (e) => {
      selectedFecha = e.target.value;
      await loadDashboard();
    });
  } catch (error) {
    await alertError(error.message);
  }
}
