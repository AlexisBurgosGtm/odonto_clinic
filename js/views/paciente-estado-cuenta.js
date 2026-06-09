import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
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
            <span class="estado-cuenta-card-label">Total pagos</span>
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
        <span class="badge-tipo badge-tipo-pago">PAGO</span> reduce el saldo (salida)
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

  try {
    await loadEstadoCuenta(params.viewGen);
  } catch (error) {
    if (!params.viewGen || isViewMounted(params.viewGen)) {
      showAlert('estadoCuentaAlert', error.message);
    }
  }
}
