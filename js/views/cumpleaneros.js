import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { isViewMounted } from '../utils/view.js';
import { buildWaMeUrl } from '../utils/whatsapp.js';

let cumpleaneros = [];
let selectedFecha = '';
let mensajeCumpleTemplate = '';

function calcEdad(nacimiento, refDate) {
  if (!nacimiento || !refDate) return null;

  const birth = new Date(String(nacimiento).split('T')[0]);
  const ref = new Date(refDate);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;

  let edad = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    edad -= 1;
  }

  return edad >= 0 ? edad : null;
}

function formatFechaDisplay(fecha) {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

function aplicarNombrePaciente(template, nombre) {
  const nombrePaciente = nombre?.trim() || 'estimado paciente';
  return template.replace(/\bpaciente\b/gi, nombrePaciente);
}

function buildMensajeCumpleanos(nombre) {
  if (mensajeCumpleTemplate) {
    return aplicarNombrePaciente(mensajeCumpleTemplate, nombre);
  }

  const empresa = getSession()?.empresa?.trim() || 'nuestra clínica dental';
  const nombrePaciente = nombre?.trim() || 'estimado paciente';
  return `¡Feliz cumpleaños, ${nombrePaciente}! Te deseamos un excelente día de parte de ${empresa}.`;
}

function buildWhatsAppUrl(telefonos, nombre) {
  return buildWaMeUrl(telefonos, buildMensajeCumpleanos(nombre));
}

function renderTable() {
  const tbody = document.getElementById('cumpleanerosTableBody');
  if (!tbody) return;

  if (cumpleaneros.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted py-4">
          No hay cumpleañeros para el ${formatFechaDisplay(selectedFecha)}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cumpleaneros.map((p) => {
    const edad = calcEdad(p.NACIMIENTO, selectedFecha);
    const edadTexto = edad !== null ? `${edad} años` : '—';
    const waUrl = buildWhatsAppUrl(p.TELEFONOS, p.NOMBRE);

    const whatsappBtn = waUrl
      ? `<a
          href="${waUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm btn-whatsapp btn-rounded"
          title="Enviar felicitación por WhatsApp"
        >
          <i class="fa-brands fa-whatsapp me-1"></i>WhatsApp
        </a>`
      : `<button
          type="button"
          class="btn btn-sm btn-outline-secondary btn-rounded"
          disabled
          title="Sin teléfono registrado"
        >
          <i class="fa-brands fa-whatsapp me-1"></i>Sin teléfono
        </button>`;

    return `
      <tr>
        <td>${p.NOMBRE || '—'}</td>
        <td>${edadTexto}</td>
        <td class="text-end">${whatsappBtn}</td>
      </tr>
    `;
  }).join('');
}

async function loadMensajeCumpleConfig(viewGen) {
  try {
    const config = await api.config.get('CUMPLE');
    if (viewGen && !isViewMounted(viewGen)) return;
    mensajeCumpleTemplate = config.DETALLES?.trim() || '';
  } catch {
    if (viewGen && !isViewMounted(viewGen)) return;
    mensajeCumpleTemplate = '';
  }
}

async function loadCumpleaneros(viewGen) {
  cumpleaneros = await api.pacientes.cumpleanos(selectedFecha);

  if (viewGen && !isViewMounted(viewGen)) return;

  renderTable();
  clearAlert('cumpleanerosAlert');
}

export function renderCumpleaneros() {
  const hoy = new Date().toISOString().slice(0, 10);
  selectedFecha = hoy;

  return `
    <div id="cumpleanerosAlert"></div>

    <div class="content-card view-cumpleaneros">
      <div class="content-card-header cumpleaneros-header">
        <h5><i class="fa-solid fa-cake-candles me-2 text-primary"></i>Cumpleañeros</h5>
        <div class="cumpleaneros-fecha">
          <label for="cumpleanerosFecha" class="form-label">Fecha</label>
          <input type="date" id="cumpleanerosFecha" class="form-control" value="${hoy}">
        </div>
      </div>

      <p class="cumpleaneros-subtitle">
        Pacientes que cumplen años el <strong id="cumpleanerosFechaLabel">${formatFechaDisplay(hoy)}</strong>
      </p>

      <div class="table-responsive">
        <table class="table table-hover crud-table mb-0">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Edad</th>
              <th class="text-end" style="width: 160px;">Felicitación</th>
            </tr>
          </thead>
          <tbody id="cumpleanerosTableBody">
            <tr><td colspan="3" class="text-center text-muted py-4">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function bindCumpleaneros(params = {}) {
  const { viewGen } = params;
  const fechaInput = document.getElementById('cumpleanerosFecha');
  const fechaLabel = document.getElementById('cumpleanerosFechaLabel');

  const updateFechaLabel = () => {
    if (fechaLabel) {
      fechaLabel.textContent = formatFechaDisplay(selectedFecha);
    }
  };

  try {
    await loadMensajeCumpleConfig(viewGen);
    if (viewGen && !isViewMounted(viewGen)) return;

    await loadCumpleaneros(viewGen);
    if (viewGen && !isViewMounted(viewGen)) return;

    fechaInput?.addEventListener('change', async (e) => {
      selectedFecha = e.target.value;
      updateFechaLabel();

      try {
        await loadCumpleaneros(viewGen);
      } catch (error) {
        showAlert('cumpleanerosAlert', error.message);
      }
    });
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('cumpleanerosAlert', error.message);
    }
  }
}
