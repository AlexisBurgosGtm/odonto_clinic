import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { confirmAction, alertError, alertSuccess, openFormDialog, SwalTheme } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';
import { canAddPacienteTratamiento } from '../utils/roles.js';
import { localDateString } from '../utils/datetime.js';

let codpacienteActual = null;
let odontogramaData = null;
let productos = [];
let piezaActiva = null;

const ESTADO_COLORS = {
  SANO: '#e2e8f0',
  CARIES: '#f87171',
  OBTURADO: '#60a5fa',
  EXTRAIDO: '#94a3b8',
  CORONA: '#fbbf24',
  ENDODONCIA: '#a78bfa',
  AUSENTE: '#cbd5e1',
  IMPLANTE: '#34d399',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function chartMap() {
  const map = {};
  (odontogramaData?.chart || []).forEach((item) => {
    map[String(item.PIEZA)] = item;
  });
  return map;
}

function tipoLabel(tipo) {
  return tipo === 'NINO' ? 'Niño' : 'Adulto';
}

function renderArc(piezas, map) {
  return piezas.map((pieza) => {
    const info = map[pieza] || { PIEZA: pieza, ESTADO: 'SANO', pendientes: 0, finalizados: 0 };
    const color = ESTADO_COLORS[info.ESTADO] || ESTADO_COLORS.SANO;
    const badge = Number(info.pendientes) > 0
      ? `<span class="odo-tooth-badge">${info.pendientes}</span>`
      : '';
    const done = Number(info.finalizados) > 0 ? ' has-done' : '';

    return `
      <button
        type="button"
        class="odo-tooth${done}"
        data-pieza="${escapeHtml(pieza)}"
        style="--odo-color:${color}"
        title="Pieza ${escapeHtml(pieza)} · ${escapeHtml(info.ESTADO)}"
      >
        <span class="odo-tooth-num">${escapeHtml(pieza)}</span>
        ${badge}
      </button>
    `;
  }).join('');
}

function renderChart() {
  const host = document.getElementById('odontogramaChart');
  if (!host || !odontogramaData) return;

  const layout = odontogramaData.layout;
  const map = chartMap();

  host.innerHTML = `
    <div class="odo-arc">
      <div class="odo-arc-label">Superior</div>
      <div class="odo-arc-row">
        <div class="odo-arc-side">${renderArc(layout.superior.derecha, map)}</div>
        <div class="odo-arc-mid"></div>
        <div class="odo-arc-side">${renderArc(layout.superior.izquierda, map)}</div>
      </div>
    </div>
    <div class="odo-arc">
      <div class="odo-arc-label">Inferior</div>
      <div class="odo-arc-row">
        <div class="odo-arc-side">${renderArc(layout.inferior.derecha, map)}</div>
        <div class="odo-arc-mid"></div>
        <div class="odo-arc-side">${renderArc(layout.inferior.izquierda, map)}</div>
      </div>
    </div>
  `;
}

function renderLeyenda() {
  const host = document.getElementById('odontogramaLeyenda');
  if (!host) return;
  const estados = odontogramaData?.estadosCatalogo || [];
  host.innerHTML = estados.map((e) => `
    <span class="odo-legend-item">
      <span class="odo-legend-swatch" style="background:${e.color}"></span>
      ${escapeHtml(e.label)}
    </span>
  `).join('');
}

function renderDetallePieza(pieza) {
  const panel = document.getElementById('odontogramaDetalle');
  if (!panel) return;

  if (!pieza) {
    panel.innerHTML = `
      <p class="text-muted mb-0">Seleccione una pieza del odontograma para cargar tratamientos o actualizar su estado.</p>
    `;
    return;
  }

  const info = chartMap()[pieza] || { PIEZA: pieza, ESTADO: 'SANO', tratamientos: [], pendientes: 0 };
  const canAdd = canAddPacienteTratamiento(getSession()?.tipo);
  const tratamientos = info.tratamientos || [];

  const lista = tratamientos.length
    ? `<ul class="odo-trat-list">${tratamientos.map((t) => `
        <li>
          <div>
            <strong>${escapeHtml(t.DESPROD || t.CODPROD)}</strong>
            <div class="small text-muted">${escapeHtml(t.FECHA || '')} · ${formatPrecio(t.PRECIO_FINAL ?? t.PRECIO)}</div>
          </div>
          <span class="badge-estado ${t.REALIZADO === 'SI' ? 'badge-estado-activo' : 'badge-estado-pendiente'}">
            ${t.REALIZADO === 'SI' ? 'Finalizado' : 'Pendiente'}
          </span>
        </li>
      `).join('')}</ul>`
    : '<p class="text-muted small mb-0">Sin tratamientos en esta pieza.</p>';

  panel.innerHTML = `
    <div class="odo-detalle-head mb-3">
      <div class="odo-detalle-title">
        <h6 class="mb-1">Pieza ${escapeHtml(pieza)}</h6>
        <div class="text-muted small">Estado: <strong>${escapeHtml(info.ESTADO || 'SANO')}</strong></div>
        ${info.NOTA ? `<div class="small mt-1">${escapeHtml(info.NOTA)}</div>` : ''}
      </div>
      <div class="odo-detalle-actions">
        <button type="button" class="btn btn-sm btn-outline-secondary btn-rounded" id="btnOdoEstado">
          <i class="fa-solid fa-palette me-1"></i>Estado
        </button>
        ${canAdd ? `
          <button type="button" class="btn btn-sm btn-nuevo btn-rounded" id="btnOdoTratamiento">
            <i class="fa-solid fa-plus me-1"></i>Agregar tratamiento
          </button>
        ` : ''}
      </div>
    </div>
    ${lista}
  `;

  document.getElementById('btnOdoEstado')?.addEventListener('click', () => openEstadoForm(pieza, info));
  document.getElementById('btnOdoTratamiento')?.addEventListener('click', () => openAddTratamiento(pieza));
}

async function reloadOdontograma(viewGen) {
  odontogramaData = await api.odontograma.getByPaciente(codpacienteActual);
  if (viewGen && !isViewMounted(viewGen)) return;

  const nombreEl = document.getElementById('odontogramaPacienteNombre');
  const tipoEl = document.getElementById('odontogramaTipo');
  if (nombreEl) nombreEl.textContent = odontogramaData.paciente?.NOMBRE || `Paciente #${codpacienteActual}`;
  if (tipoEl) tipoEl.textContent = tipoLabel(odontogramaData.paciente?.TIPO_PACIENTE);

  renderLeyenda();
  renderChart();
  renderDetallePieza(piezaActiva);
  clearAlert('odontogramaAlert');
}

async function openEstadoForm(pieza, info) {
  const opciones = (odontogramaData?.estadosCatalogo || []).map((e) => `
    <option value="${e.value}" ${e.value === info.ESTADO ? 'selected' : ''}>${e.label}</option>
  `).join('');

  const result = await openFormDialog({
    title: `Estado pieza ${pieza}`,
    html: `
      <div class="swal-form text-start">
        <div class="mb-3">
          <label class="form-label">Estado</label>
          <select id="swal-odo-estado" class="form-select">${opciones}</select>
        </div>
        <div class="mb-0">
          <label class="form-label">Nota</label>
          <input type="text" id="swal-odo-nota" class="form-control" maxlength="500" value="${escapeHtml(info.NOTA || '')}">
        </div>
      </div>
    `,
    preConfirm: async () => {
      const ESTADO = document.getElementById('swal-odo-estado')?.value;
      const NOTA = sanitizeText(document.getElementById('swal-odo-nota')?.value, { maxLength: 500 });
      try {
        await api.odontograma.updatePieza(codpacienteActual, pieza, { ESTADO, NOTA });
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;
  await reloadOdontograma();
  await alertSuccess('Estado actualizado');
}

function filterProductos(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return productos.filter((p) => {
    return (p.CODPROD || '').toLowerCase().includes(q)
      || (p.DESPROD || '').toLowerCase().includes(q);
  }).slice(0, 12);
}

async function openAddTratamiento(pieza) {
  if (!canAddPacienteTratamiento(getSession()?.tipo)) {
    await alertError('No tiene permiso para agregar tratamientos');
    return;
  }
  if (productos.length === 0) {
    await alertError('No hay tratamientos en el catálogo');
    return;
  }

  let agregado = false;

  await openFormDialog({
    title: `Agregar tratamiento · Pieza ${pieza}`,
    width: '480px',
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: true,
    html: `
      <div class="swal-form text-start">
        <p class="text-muted small mb-3">Pieza <strong>${escapeHtml(pieza)}</strong> ya seleccionada. Busque y elija el tratamiento.</p>
        <label class="form-label">Buscar tratamiento</label>
        <div class="paciente-autocomplete">
          <input type="search" id="swal-odo-prod-buscar" class="form-control" placeholder="Mín. 2 caracteres..." autocomplete="off">
          <ul class="paciente-suggestions" id="swal-odo-prod-suggestions"></ul>
        </div>
        <div class="text-danger small mt-2" id="swal-odo-prod-error" hidden></div>
      </div>
    `,
    didOpen: () => {
      const input = document.getElementById('swal-odo-prod-buscar');
      const list = document.getElementById('swal-odo-prod-suggestions');
      const errEl = document.getElementById('swal-odo-prod-error');

      const hide = () => list?.classList.remove('open');
      const render = (items) => {
        if (!items.length) {
          list.innerHTML = '<li class="paciente-suggestion-empty">Sin resultados</li>';
          list.classList.add('open');
          return;
        }
        list.innerHTML = items.map((p) => `
          <li>
            <button type="button" class="paciente-suggestion-item" data-id="${p.ID}">
              <span class="paciente-suggestion-nombre">${escapeHtml(p.DESPROD || p.CODPROD)}</span>
              <span class="paciente-suggestion-edad">${formatPrecio(p.PRECIO)}</span>
            </button>
          </li>
        `).join('');
        list.classList.add('open');
      };

      input?.addEventListener('input', () => {
        if (errEl) {
          errEl.hidden = true;
          errEl.textContent = '';
        }
        const q = input.value.trim();
        if (q.length < 2) {
          hide();
          return;
        }
        render(filterProductos(q));
      });

      list?.addEventListener('mousedown', async (e) => {
        const btn = e.target.closest('.paciente-suggestion-item');
        if (!btn) return;
        e.preventDefault();

        const prod = productos.find((p) => p.ID == btn.dataset.id);
        if (!prod) return;

        list.querySelectorAll('button').forEach((el) => { el.disabled = true; });
        if (input) input.disabled = true;
        if (errEl) {
          errEl.hidden = true;
          errEl.textContent = '';
        }

        try {
          await api.orders.create({
            CODPACIENTE: Number(codpacienteActual),
            PIEZA: pieza,
            CODPROD: prod.CODPROD,
            DESPROD: prod.DESPROD,
            PRECIO: Number(prod.PRECIO ?? 0),
            FECHA: localDateString(),
            OBS: null,
          });
          agregado = true;
          SwalTheme.close();
        } catch (error) {
          list.querySelectorAll('button').forEach((el) => { el.disabled = false; });
          if (input) input.disabled = false;
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = error.message || 'No se pudo agregar el tratamiento';
          }
        }
      });

      setTimeout(() => input?.focus(), 80);
    },
  });

  if (!agregado) return;
  await reloadOdontograma();
  await alertSuccess('Tratamiento agregado a la pieza');
}

export function renderPacienteOdontograma() {
  return `
    <div id="odontogramaAlert"></div>

    <div class="content-card view-odontograma">
      <div class="content-card-header orders-card-header">
        <div class="orders-header-main">
          <button class="btn btn-sm btn-outline-secondary btn-rounded mb-2" id="btnVolverPacientesOdo">
            <i class="fa-solid fa-arrow-left me-1"></i>Volver a pacientes
          </button>
          <div class="orders-title-row">
            <h5 class="mb-0">
              <i class="fa-solid fa-teeth me-2 text-primary"></i>
              Odontograma de <span id="odontogramaPacienteNombre">...</span>
            </h5>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge-tipo badge-tipo-default" id="odontogramaTipo">—</span>
              <a class="btn btn-sm btn-outline-info btn-rounded" id="btnIrTratamientosOdo" href="#">
                <i class="fa-solid fa-list me-1"></i>Ver listado
              </a>
            </div>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Adulto: Universal 1–32 · Niño: FDI 5.1–8.5. Seleccione una pieza para cargar tratamientos o marcar su estado clínico.
          </p>
        </div>
      </div>

      <div class="odo-legend" id="odontogramaLeyenda"></div>

      <div class="row g-3 odo-layout-row">
        <div class="col-12 col-lg-8">
          <div class="odo-chart" id="odontogramaChart">
            <p class="text-center text-muted py-4 mb-0">Cargando odontograma...</p>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="odo-detalle odo-detalle-side" id="odontogramaDetalle">
            <p class="text-muted mb-0">Seleccione una pieza del odontograma para cargar tratamientos o actualizar su estado.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindPacienteOdontograma(params = {}) {
  const { viewGen } = params;
  codpacienteActual = params.codpaciente;
  piezaActiva = null;
  odontogramaData = null;

  if (!codpacienteActual) {
    window.location.hash = '#/pacientes';
    return;
  }

  document.getElementById('btnVolverPacientesOdo')?.addEventListener('click', () => {
    window.location.hash = '#/pacientes';
  });

  const linkListado = document.getElementById('btnIrTratamientosOdo');
  if (linkListado) {
    linkListado.href = `#/pacientes/${codpacienteActual}/tratamientos`;
  }

  document.getElementById('odontogramaChart')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pieza]');
    if (!btn) return;
    piezaActiva = btn.dataset.pieza;
    document.querySelectorAll('.odo-tooth').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.pieza === piezaActiva);
    });
    renderDetallePieza(piezaActiva);
  });

  try {
    productos = await api.productos.list().catch(() => []);
    await reloadOdontograma(viewGen);
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('odontogramaAlert', error.message);
    }
  }
}
