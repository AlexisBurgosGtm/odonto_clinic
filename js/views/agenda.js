import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { confirmAction, alertError, alertSuccess, openFormDialog, SwalTheme } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';
import {
  localDateString,
  splitDatetime,
  combineDatetime,
  toCalendarDatetime,
  toApiDatetime,
} from '../utils/datetime.js';
import { showPacienteDetalleByCod } from './pacientes.js';
import { showAgendaTratamientosBtn } from '../utils/roles.js';
import { buildWaMeUrl } from '../utils/whatsapp.js';

let calendar = null;
let medicos = [];
let pacientes = [];
let filtroMedico = '';
let bindAbort = null;
let selectedDate = localDateString();
let agendaEventosPorId = new Map();
let agendaMobileResizeHandler = null;
let agendaDesktopMode = 'calendar';

const HORAS_INICIO = 7 * 60;
const HORAS_FIN = 18 * 60;
const HORAS_INTERVALO = 30;
const AGENDA_MOBILE_MQ = window.matchMedia('(max-width: 575.98px)');

function isAgendaMobileLayout() {
  return AGENDA_MOBILE_MQ.matches;
}

function isAgendaMounted() {
  return Boolean(
    document.getElementById('calendar')
    || document.getElementById('agendaMobileList')
    || document.getElementById('agendaDesktopTableBody')
  );
}

function getAgendaDesktopFecha() {
  return document.getElementById('agendaDesktopFecha')?.value || localDateString();
}

function getAgendaMobileFecha() {
  return document.getElementById('agendaMobileFecha')?.value || selectedDate || localDateString();
}

function formatCitaHorario(evento) {
  const { time: inicio } = splitDatetime(evento.FECHA);
  const { time: fin } = splitDatetime(evento.FECHA_FIN);
  if (inicio && fin) return `${inicio} – ${fin}`;
  return inicio || '—';
}

function sortEventosPorHora(eventos) {
  return [...eventos].sort((a, b) => {
    const horaA = splitDatetime(a.FECHA).time || '';
    const horaB = splitDatetime(b.FECHA).time || '';
    return horaA.localeCompare(horaB);
  });
}

function filtrarEventosPorMedico(eventos) {
  return filtroMedico
    ? eventos.filter((e) => e.CODEMP == filtroMedico)
    : eventos;
}

function updateAgendaCitasCount(count) {
  const el = document.getElementById('agendaCitasCount');
  if (!el) return;

  const total = Number(count) || 0;
  el.textContent = total === 1 ? '1 cita' : `${total} citas`;
}

async function fetchAgendaDelDia(fecha) {
  const eventos = await api.agenda.list(`${fecha} 00:00:00`, `${fecha} 23:59:59`);
  indexAgendaEventos(eventos);
  return filtrarEventosPorMedico(eventos);
}

function handleAgendaListClick(e) {
  const perfilBtn = e.target.closest('[data-paciente-perfil]');
  if (perfilBtn) {
    e.stopPropagation();
    showPacienteDetalleByCod(perfilBtn.dataset.pacientePerfil);
    return;
  }

  const tratamientosBtn = e.target.closest('[data-tratamientos]');
  if (tratamientosBtn) {
    e.stopPropagation();
    window.location.hash = `#/pacientes/${tratamientosBtn.dataset.tratamientos}/detalle`;
    return;
  }

  if (e.target.closest('[data-whatsapp-recordatorio]')) {
    e.stopPropagation();
    return;
  }

  const detalleBtn = e.target.closest('[data-cita-detalle]');
  if (detalleBtn) {
    openCitaDetalleModal(detalleBtn.dataset.citaDetalle);
    return;
  }

  const row = e.target.closest('[data-event-id]');
  if (!row || e.target.closest('.agenda-table-actions, .agenda-mobile-card-actions')) return;
  openCitaDetalleModal(row.dataset.eventId);
}

function indexAgendaEventos(eventos) {
  agendaEventosPorId = new Map(eventos.map((evento) => [String(evento.ID), evento]));
}

function renderAgendaTableActionCell(evento) {
  const pacienteBtns = renderAgendaPacienteActionBtns(evento);

  return `
    <div class="agenda-table-actions">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary btn-action"
        data-cita-detalle="${evento.ID}"
        title="Ver detalle de la cita"
      >
        <i class="fa-solid fa-eye"></i>
      </button>
      ${pacienteBtns}
    </div>
  `;
}

function renderAgendaDesktopTable(eventos, { showMedico } = {}) {
  const colspan = showMedico ? 6 : 5;

  if (eventos.length === 0) {
    return `
      <tr>
        <td colspan="${colspan}" class="text-center text-muted py-4">No hay citas para esta fecha</td>
      </tr>
    `;
  }

  return sortEventosPorHora(eventos).map((evento) => {
    const color = evento.COLOR || '#0ea5e9';
    const medicoCell = showMedico
      ? `
        <td>
          <span class="agenda-table-medico">
            <span class="agenda-table-medico-color" style="background:${color}"></span>
            ${escapeHtml(evento.MEDICO || '—')}
          </span>
        </td>
      `
      : '';

    return `
      <tr class="agenda-table-row" data-event-id="${evento.ID}">
        <td class="nowrap fw-semibold">${escapeHtml(formatCitaHorario(evento))}</td>
        ${medicoCell}
        <td>${escapeHtml(evento.PACIENTE || 'Sin paciente')}</td>
        <td>${escapeHtml(evento.MOTIVO || '—')}</td>
        <td class="agenda-table-obs">${escapeHtml(evento.OBS || '—')}</td>
        <td class="text-end">${renderAgendaTableActionCell(evento)}</td>
      </tr>
    `;
  }).join('');
}

async function loadAgendaDesktopList(fecha = getAgendaDesktopFecha()) {
  const tbody = document.getElementById('agendaDesktopTableBody');
  const thead = document.getElementById('agendaDesktopTableHead');
  if (!tbody) return;

  selectedDate = fecha;
  const fechaInput = document.getElementById('agendaDesktopFecha');
  if (fechaInput && fechaInput.value !== fecha) {
    fechaInput.value = fecha;
  }

  const label = document.getElementById('agendaDesktopFechaLabel');
  if (label) label.textContent = formatFechaDisplay(fecha);

  const showMedico = !getAgendaRoleConfig().lockMedico;
  if (thead) {
    thead.innerHTML = showMedico
      ? `
        <tr>
          <th>Horario</th>
          <th>Médico</th>
          <th>Paciente</th>
          <th>Motivo</th>
          <th>Observaciones</th>
          <th class="text-end" style="width: 1%;">Acciones</th>
        </tr>
      `
      : `
        <tr>
          <th>Horario</th>
          <th>Paciente</th>
          <th>Motivo</th>
          <th>Observaciones</th>
          <th class="text-end" style="width: 1%;">Acciones</th>
        </tr>
      `;
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="${showMedico ? 6 : 5}" class="text-center text-muted py-4">Cargando...</td>
    </tr>
  `;

  try {
    const filtrados = await fetchAgendaDelDia(fecha);
    if (!document.getElementById('agendaDesktopTableBody')) return;
    updateAgendaCitasCount(filtrados.length);
    tbody.innerHTML = renderAgendaDesktopTable(filtrados, { showMedico });
  } catch (error) {
    if (document.getElementById('agendaDesktopTableBody')) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${showMedico ? 6 : 5}" class="text-center text-danger py-4">${escapeHtml(error.message)}</td>
        </tr>
      `;
    }
  }
}

function setAgendaDesktopMode(mode) {
  if (isAgendaMobileLayout()) return;

  agendaDesktopMode = mode;

  const calendarPanel = document.getElementById('agendaDesktopCalendar');
  const listPanel = document.getElementById('agendaDesktopList');

  document.querySelectorAll('[data-agenda-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.agendaMode === mode);
  });

  if (mode === 'list') {
    calendarPanel?.classList.add('d-none');
    listPanel?.classList.remove('d-none');

    const fechaInput = document.getElementById('agendaDesktopFecha');
    const hoy = localDateString();
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = hoy;
    }

    loadAgendaDesktopList(getAgendaDesktopFecha());
    return;
  }

  calendarPanel?.classList.remove('d-none');
  listPanel?.classList.add('d-none');

  if (!calendar) {
    initCalendar(getAgendaRoleConfig().initialView);
  } else {
    calendar.refetchEvents();
  }
}

function bindAgendaDesktopList() {
  const tbody = document.getElementById('agendaDesktopTableBody');
  const fechaInput = document.getElementById('agendaDesktopFecha');
  if (!tbody || tbody.dataset.desktopBound === '1') return;

  tbody.dataset.desktopBound = '1';

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = localDateString();
  }

  fechaInput?.addEventListener('change', () => {
    if (fechaInput.value) {
      selectedDate = fechaInput.value;
      loadAgendaDesktopList(fechaInput.value);
    }
  });

  tbody.addEventListener('click', handleAgendaListClick);
}

function bindAgendaDesktopModeToggle(signal) {
  document.querySelectorAll('[data-agenda-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setAgendaDesktopMode(btn.dataset.agendaMode);
    }, { signal });
  });
}

export function cleanupAgenda() {
  bindAbort?.abort();
  bindAbort = null;

  if (agendaMobileResizeHandler) {
    AGENDA_MOBILE_MQ.removeEventListener('change', agendaMobileResizeHandler);
    agendaMobileResizeHandler = null;
  }

  if (calendar) {
    try {
      calendar.destroy();
    } catch (_) {
      /* el DOM ya pudo haberse eliminado */
    }
    calendar = null;
  }
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatFechaDisplay(fecha) {
  const { date } = splitDatetime(fecha);
  if (!date) return fecha;
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function getMedicosListaHoras() {
  return filtroMedico
    ? medicos.filter((m) => m.CODEMP == filtroMedico)
    : medicos;
}

function getEventoRangoMinutos(evento, fecha) {
  const inicio = splitDatetime(evento.FECHA);
  if (inicio.date !== fecha) return null;

  const fin = splitDatetime(evento.FECHA_FIN);
  const startMin = Math.max(timeToMinutes(inicio.time), HORAS_INICIO);
  let endMin = fin.time ? timeToMinutes(fin.time) : startMin + HORAS_INTERVALO;

  if (fin.date && fin.date !== fecha) {
    endMin = HORAS_FIN;
  }

  endMin = Math.min(endMin, HORAS_FIN);
  if (endMin <= startMin) return null;

  return { start: startMin, end: endMin };
}

function findEventoEnSlot(eventos, fecha, slotStart, slotEnd) {
  return eventos.find((e) => {
    const rango = getEventoRangoMinutos(e, fecha);
    if (!rango) return false;
    return slotStart < rango.end && slotEnd > rango.start;
  }) || null;
}

function calcularHorariosDia(eventos, fecha) {
  const slots = [];

  for (let min = HORAS_INICIO; min < HORAS_FIN; min += HORAS_INTERVALO) {
    const finSlot = min + HORAS_INTERVALO;
    if (finSlot > HORAS_FIN) break;

    const evento = findEventoEnSlot(eventos, fecha, min, finSlot);
    slots.push({
      label: `${minutesToTime(min)} – ${minutesToTime(finSlot)}`,
      inicio: minutesToTime(min),
      fin: minutesToTime(finSlot),
      ocupado: Boolean(evento),
      evento,
    });
  }

  return slots;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHorasDisponiblesContent(fecha, medicosLista, eventos) {
  if (medicosLista.length === 0) {
    return '<p class="text-muted mb-0">No hay médicos habilitados para consultar.</p>';
  }

  return medicosLista.map((medico) => {
    const eventosMedico = eventos.filter((e) => e.CODEMP == medico.CODEMP);
    const slots = calcularHorariosDia(eventosMedico, fecha);

    const items = slots.map((slot) => {
      if (slot.ocupado && slot.evento) {
        return `
        <li
          class="horas-slot-ocupado horas-slot-ocupado-clickable"
          data-event-id="${slot.evento.ID}"
          role="button"
          tabindex="0"
          title="Ver detalle de la cita"
        >${slot.label}</li>
        `;
      }

      if (slot.ocupado) {
        return `<li class="horas-slot-ocupado">${slot.label}</li>`;
      }

      return `
        <li
          class="horas-slot-libre horas-slot-clickable"
          data-codemp="${medico.CODEMP}"
          data-fecha="${fecha}"
          data-hora="${slot.inicio}"
          role="button"
          tabindex="0"
          title="Clic para crear cita"
        >${slot.label}</li>
      `;
    }).join('');

    return `
      <div class="horas-disponibles-grupo">
        <h6 class="horas-disponibles-medico">
          <span class="color-swatch" style="background:${medico.COLOR || '#0ea5e9'}"></span>
          ${medico.EMPLEADO}
        </h6>
        <ul class="horas-disponibles-lista">${items}</ul>
      </div>
    `;
  }).join('');
}

function buildHorasDisponiblesShell(fecha, medicosLista) {
  const filtroLabel = medicosLista.length === 1
    ? medicosLista[0].EMPLEADO
    : 'Todos los médicos';

  return `
    <div class="horas-disponibles-modal">
      <div class="horas-disponibles-toolbar">
        <div class="horas-disponibles-fecha">
          <label for="horasDisponiblesFecha" class="form-label">Fecha</label>
          <input type="date" id="horasDisponiblesFecha" class="form-control" value="${fecha}">
        </div>
        <div class="horas-disponibles-info">
          <p class="horas-disponibles-meta mb-1">
            <span id="horasDisponiblesFechaLabel">${formatFechaDisplay(fecha)}</span>
            · ${filtroLabel} · 7:00 a.m. – 6:00 p.m.
          </p>
          <div class="horas-disponibles-leyenda">
            <span class="horas-leyenda-item horas-slot-libre">Disponible</span>
            <span class="horas-leyenda-item horas-slot-ocupado">Ocupado</span>
          </div>
        </div>
      </div>
      <div class="horas-disponibles-scroll" id="horasDisponiblesContent">
        <p class="text-muted mb-0 horas-disponibles-loading">Cargando horarios...</p>
      </div>
    </div>
  `;
}

function formatCitaStatus(status) {
  const value = String(status || 'PENDIENTE').toUpperCase();
  return value === 'FINALIZADO' ? 'Finalizado' : 'Pendiente';
}

function isCitaPendiente(evento) {
  return String(evento?.STATUS || 'PENDIENTE').toUpperCase() !== 'FINALIZADO';
}

function buildCitaDetalleHtml(evento) {
  const { time: horaInicio } = splitDatetime(evento.FECHA);
  const { time: horaFin } = splitDatetime(evento.FECHA_FIN);
  const horario = horaFin ? `${horaInicio} – ${horaFin}` : horaInicio || '—';
  const acciones = renderAgendaPacienteActionBtns(evento);
  const status = formatCitaStatus(evento.STATUS);
  const statusClass = isCitaPendiente(evento) ? 'cita-status-pendiente' : 'cita-status-finalizado';

  return `
    <div class="swal-form text-start cita-detalle-modal">
      <div class="mb-3">
        <label class="form-label text-muted small mb-1">Estado</label>
        <p class="mb-0"><span class="cita-status-badge ${statusClass}">${escapeHtml(status)}</span></p>
      </div>
      <div class="mb-3">
        <label class="form-label text-muted small mb-1">Horario</label>
        <p class="mb-0 fw-semibold">${escapeHtml(horario)}</p>
      </div>
      <div class="mb-3">
        <label class="form-label text-muted small mb-1">Paciente</label>
        <p class="mb-0 fw-semibold">${escapeHtml(evento.PACIENTE || 'Sin paciente')}</p>
      </div>
      <div class="mb-3">
        <label class="form-label text-muted small mb-1">Motivo</label>
        <p class="mb-0">${escapeHtml(evento.MOTIVO || '—')}</p>
      </div>
      <div class="mb-0">
        <label class="form-label text-muted small mb-1">Observaciones</label>
        <p class="mb-0 cita-detalle-obs">${escapeHtml(evento.OBS || '—')}</p>
      </div>
      ${acciones ? `<div class="cita-detalle-actions">${acciones}</div>` : ''}
    </div>
  `;
}

function bindCitaDetalleActions(evento) {
  const popup = Swal.getPopup();
  if (!popup) return;

  popup.querySelector('[data-paciente-perfil]')?.addEventListener('click', () => {
    Swal.close();
    showPacienteDetalleByCod(evento.CODPACIENTE);
  });

  popup.querySelector('[data-tratamientos]')?.addEventListener('click', () => {
    Swal.close();
    window.location.hash = `#/pacientes/${evento.CODPACIENTE}/detalle`;
  });
}

async function handleFinalizarCita(evento) {
  const paciente = evento.PACIENTE || 'Sin paciente';
  const horario = formatCitaHorario(evento);

  const confirmed = await confirmAction({
    title: '¿Finalizar cita?',
    text: `¿Desea marcar como finalizada la cita de ${paciente} (${horario})?`,
    icon: 'question',
    confirmText: 'Finalizar',
    cancelText: 'Cancelar',
    confirmColor: 'primary',
  });

  if (!confirmed) return;

  try {
    await api.agenda.finalizar(evento.ID);
    agendaEventosPorId.set(String(evento.ID), { ...evento, STATUS: 'FINALIZADO' });
    refreshAgendaViews();
    await alertSuccess('Cita finalizada');
  } catch (error) {
    await alertError(error.message);
  }
}

async function openCitaDetalleModal(eventIdOrEvento) {
  const evento = eventIdOrEvento && typeof eventIdOrEvento === 'object'
    ? eventIdOrEvento
    : agendaEventosPorId.get(String(eventIdOrEvento));
  if (!evento) {
    await alertError('No se encontró la información de la cita');
    return;
  }

  agendaEventosPorId.set(String(evento.ID), evento);
  const pendiente = isCitaPendiente(evento);

  const result = await SwalTheme.fire({
    title: 'Detalle de la cita',
    html: buildCitaDetalleHtml(evento),
    width: 'min(460px, 92vw)',
    confirmButtonText: 'Cerrar',
    showDenyButton: true,
    denyButtonText: '<i class="fa-solid fa-pen me-1"></i>Editar cita',
    showCancelButton: pendiente,
    cancelButtonText: '<i class="fa-solid fa-check me-1"></i>Finalizar cita',
    cancelButtonColor: '#15803d',
    didOpen: () => {
      bindCitaDetalleActions(evento);
    },
  });

  if (result.isDenied) {
    openEventoForm('edit', evento);
    return;
  }

  if (result.dismiss === Swal.DismissReason.cancel) {
    await handleFinalizarCita(evento);
  }
}

function handleHorasSlotClick(e) {
  const slotOcupado = e.target.closest('li.horas-slot-ocupado-clickable[data-event-id]');
  if (slotOcupado) {
    openCitaDetalleModal(slotOcupado.dataset.eventId);
    return;
  }

  const slot = e.target.closest('li.horas-slot-libre[data-codemp]');
  if (!slot) return;

  const fecha = slot.dataset.fecha || document.getElementById('horasDisponiblesFecha')?.value;
  const codemp = slot.dataset.codemp;
  const hora = slot.dataset.hora;

  if (!fecha || !codemp || !hora) return;

  Swal.close();
  openEventoForm('create', null, combineDatetime(fecha, hora), codemp);
}

function bindHorasDisponiblesSlots() {
  const content = document.getElementById('horasDisponiblesContent');
  if (!content || content.dataset.slotsBound === '1') return;

  content.dataset.slotsBound = '1';
  content.addEventListener('click', handleHorasSlotClick);
  content.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const slot = e.target.closest('li.horas-slot-libre[data-codemp], li.horas-slot-ocupado-clickable[data-event-id]');
    if (!slot) return;
    e.preventDefault();
    handleHorasSlotClick({ target: slot });
  });
}

async function renderHorasDisponiblesContent(fecha) {
  const content = document.getElementById('horasDisponiblesContent');
  const fechaLabel = document.getElementById('horasDisponiblesFechaLabel');
  if (!content) return;

  if (fechaLabel) {
    fechaLabel.textContent = formatFechaDisplay(fecha);
  }

  content.innerHTML = '<p class="text-muted mb-0 horas-disponibles-loading">Cargando horarios...</p>';

  try {
    const medicosLista = getMedicosListaHoras();
    const eventos = await api.agenda.list(`${fecha} 00:00:00`, `${fecha} 23:59:59`);

    if (!document.getElementById('horasDisponiblesContent')) return;

    indexAgendaEventos(eventos);
    content.innerHTML = buildHorasDisponiblesContent(fecha, medicosLista, eventos);
    bindHorasDisponiblesSlots();
  } catch (error) {
    if (document.getElementById('horasDisponiblesContent')) {
      content.innerHTML = `<p class="text-danger mb-0">${error.message}</p>`;
    }
  }
}

async function openHorasDisponiblesModal() {
  if (medicos.length === 0) {
    await alertError('No hay médicos habilitados registrados');
    return;
  }

  const fecha = localDateString();
  const medicosLista = getMedicosListaHoras();

  await SwalTheme.fire({
    title: 'Horas disponibles',
    html: buildHorasDisponiblesShell(fecha, medicosLista),
    width: 'min(860px, 96vw)',
    customClass: {
      popup: 'swal-popup swal-popup-wide swal-popup-horas',
      title: 'swal-title',
      htmlContainer: 'swal-html',
      confirmButton: 'btn btn-swal-confirm',
      actions: 'swal-actions',
      icon: 'swal-icon',
    },
    confirmButtonText: 'Cerrar',
    showCancelButton: false,
    didOpen: () => {
      const fechaInput = document.getElementById('horasDisponiblesFecha');
      bindHorasDisponiblesSlots();
      renderHorasDisponiblesContent(fecha);

      fechaInput?.addEventListener('change', () => {
        if (fechaInput.value) {
          renderHorasDisponiblesContent(fechaInput.value);
        }
      });
    },
  });
}

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

function formatPacienteLabel(paciente, refDate) {
  const edad = calcEdad(paciente.NACIMIENTO, refDate);
  const edadTexto = edad !== null ? `${edad} años` : 'Edad desconocida';
  return `${paciente.NOMBRE || 'Sin nombre'} — ${edadTexto}`;
}

function buildSelectOptions(items, valueKey, labelKey) {
  return items.map((item) => {
    const val = item[valueKey];
    const label = item[labelKey] || val;
    return `<option value="${val}">${label}</option>`;
  }).join('');
}

function getAgendaRoleConfig() {
  const session = getSession();
  const tipo = session?.tipo;

  if (tipo === 'MEDICO') {
    return {
      initialView: 'timeGridWeek',
      lockMedico: true,
      codemp: session?.codemp,
    };
  }

  if (tipo === 'SECRETARIA') {
    return { initialView: 'timeGridWeek', lockMedico: false, codemp: null };
  }

  return { initialView: 'dayGridMonth', lockMedico: false, codemp: null };
}

function eventFormHtml(isEdit) {
  const { lockMedico, codemp } = getAgendaRoleConfig();
  const medicoOptions = buildSelectOptions(medicos, 'CODEMP', 'EMPLEADO');
  const medicoDisabled = lockMedico ? 'disabled' : '';

  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Fecha y horario <span class="text-danger">*</span></label>
        <div class="row g-2">
          <div class="col-12">
            <input type="date" id="swal-fecha" class="form-control" title="Fecha">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Hora inicio</label>
            <input type="time" id="swal-hora" class="form-control" title="Hora inicio">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Hora final</label>
            <input type="time" id="swal-hora-fin" class="form-control" title="Hora final">
          </div>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Médico <span class="text-danger">*</span></label>
        <select id="swal-codemp" class="form-select" ${medicoDisabled}>
          <option value="">— Seleccionar médico —</option>
          ${medicoOptions}
        </select>
        ${lockMedico ? `<input type="hidden" id="swal-codemp-locked" value="${codemp || ''}">` : ''}
      </div>
      <div class="mb-3">
        <label class="form-label">Paciente</label>
        <div class="paciente-autocomplete">
          <input
            type="text"
            id="swal-paciente-buscar"
            class="form-control"
            placeholder="Buscar paciente (mín. 3 caracteres)"
            autocomplete="off"
          >
          <input type="hidden" id="swal-codpaciente" value="">
          <ul class="paciente-suggestions" id="swal-paciente-suggestions"></ul>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Motivo</label>
        <input type="text" id="swal-motivo" class="form-control" maxlength="300">
      </div>
      <div class="mb-0">
        <label class="form-label">Observaciones</label>
        <textarea id="swal-obs" class="form-control" rows="2" maxlength="300"></textarea>
      </div>
      ${isEdit ? `
        <div class="text-end mt-3">
          <button type="button" class="btn btn-link btn-sm text-danger p-0" id="swal-btn-eliminar">
            <i class="fa-solid fa-trash me-1"></i>Eliminar cita
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function getRefDate() {
  return document.getElementById('swal-fecha')?.value || localDateString();
}

function filterPacientes(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  return pacientes.filter((p) => {
    const nombre = (p.NOMBRE || '').toLowerCase();
    const telefono = (p.TELEFONOS || '').toLowerCase();
    const email = (p.EMAIL || '').toLowerCase();
    return nombre.includes(q) || telefono.includes(q) || email.includes(q);
  });
}

function renderPacienteSuggestions(items) {
  const list = document.getElementById('swal-paciente-suggestions');
  if (!list) return;

  const refDate = getRefDate();

  if (items.length === 0) {
    list.innerHTML = '<li class="paciente-suggestion-empty">No se encontraron pacientes</li>';
    list.classList.add('open');
    return;
  }

  list.innerHTML = items.map((p) => {
    const edad = calcEdad(p.NACIMIENTO, refDate);
    const edadTexto = edad !== null ? `${edad} años` : 'Edad desconocida';

    return `
      <li>
        <button type="button" class="paciente-suggestion-item" data-id="${p.CODPACIENTE}">
          <span class="paciente-suggestion-nombre">${p.NOMBRE || 'Sin nombre'}</span>
          <span class="paciente-suggestion-edad">${edadTexto}</span>
        </button>
      </li>
    `;
  }).join('');

  list.classList.add('open');
}

function hidePacienteSuggestions() {
  document.getElementById('swal-paciente-suggestions')?.classList.remove('open');
}

function setPacienteSeleccionado(paciente) {
  const input = document.getElementById('swal-paciente-buscar');
  const hidden = document.getElementById('swal-codpaciente');

  if (!paciente) {
    if (input) input.value = '';
    if (hidden) hidden.value = '';
    return;
  }

  if (input) input.value = formatPacienteLabel(paciente, getRefDate());
  if (hidden) hidden.value = paciente.CODPACIENTE;
}

function bindPacienteAutocomplete() {
  const input = document.getElementById('swal-paciente-buscar');
  const hidden = document.getElementById('swal-codpaciente');
  const list = document.getElementById('swal-paciente-suggestions');
  const fechaInput = document.getElementById('swal-fecha');

  if (!input || !hidden || !list) return;

  let selectedLabel = input.value;

  input.addEventListener('input', () => {
    if (input.value !== selectedLabel) {
      hidden.value = '';
      selectedLabel = '';
    }

    const query = input.value;
    if (query.trim().length < 3) {
      hidePacienteSuggestions();
      return;
    }

    renderPacienteSuggestions(filterPacientes(query));
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 3) {
      renderPacienteSuggestions(filterPacientes(input.value));
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(hidePacienteSuggestions, 150);
  });

  list.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.paciente-suggestion-item');
    if (!btn) return;

    const paciente = pacientes.find((p) => p.CODPACIENTE == btn.dataset.id);
    if (!paciente) return;

    setPacienteSeleccionado(paciente);
    selectedLabel = input.value;
    hidePacienteSuggestions();
  });

  fechaInput?.addEventListener('change', () => {
    if (hidden.value) {
      const paciente = pacientes.find((p) => p.CODPACIENTE == hidden.value);
      if (paciente) {
        setPacienteSeleccionado(paciente);
        selectedLabel = input.value;
      }
    } else if (input.value.trim().length >= 3) {
      renderPacienteSuggestions(filterPacientes(input.value));
    }
  });
}

function mapEventoToCalendar(evento) {
  const color = evento.COLOR || '#0ea5e9';
  const title = evento.PACIENTE || 'Sin paciente';

  return {
    id: evento.ID,
    title,
    start: toCalendarDatetime(evento.FECHA),
    end: evento.FECHA_FIN ? toCalendarDatetime(evento.FECHA_FIN) : undefined,
    extendedProps: { ...evento },
    borderColor: color,
    backgroundColor: `${color}18`,
    textColor: '#1e293b',
  };
}

async function loadCatalogos() {
  [medicos, pacientes] = await Promise.all([
    api.empleados.medicos(),
    api.pacientes.list(),
  ]);
}

async function fetchEventos(info) {
  if (!isAgendaMounted()) return [];

  const start = info?.start ? toApiDatetime(info.start) : null;
  const end = info?.end ? toApiDatetime(info.end) : null;
  const eventos = await api.agenda.list(start, end);

  if (!isAgendaMounted()) return [];
  const filtrados = filtrarEventosPorMedico(eventos);

  if (!isAgendaMobileLayout() && agendaDesktopMode === 'calendar') {
    updateAgendaCitasCount(filtrados.length);
  }

  return filtrados.map(mapEventoToCalendar);
}

function renderFiltroMedico() {
  const select = document.getElementById('filtroMedico');
  if (!select) return;

  const opciones = medicos.map((m) => {
    const color = m.COLOR || '#0ea5e9';
    return `<option value="${m.CODEMP}" data-color="${color}">${m.EMPLEADO}</option>`;
  }).join('');

  select.innerHTML = `
    <option value="">Todos los médicos</option>
    ${opciones}
  `;
  select.value = filtroMedico;
}

function setDefaultHoras(horaInicio = '09:00') {
  const hora = document.getElementById('swal-hora');
  const horaFin = document.getElementById('swal-hora-fin');
  if (!hora || !horaFin) return;
  hora.value = horaInicio;
  horaFin.value = addMinutesToTime(horaInicio, 30);
}

async function openEventoForm(mode, evento = null, fechaDefault = null, codempDefault = null) {
  const isEdit = mode === 'edit';

  if (medicos.length === 0) {
    await alertError('No hay médicos habilitados registrados');
    return;
  }

  const result = await openFormDialog({
    title: isEdit ? 'Editar cita' : 'Nueva cita',
    html: eventFormHtml(isEdit),
    width: '520px',
    didOpen: () => {
      bindPacienteAutocomplete();

      if (isEdit) {
        const { date, time } = splitDatetime(evento.FECHA);
        const fin = splitDatetime(evento.FECHA_FIN);

        document.getElementById('swal-fecha').value = date;
        document.getElementById('swal-hora').value = time;
        document.getElementById('swal-hora-fin').value = fin.time || addMinutesToTime(time || '09:00', 30);
        document.getElementById('swal-codemp').value = evento.CODEMP || '';
        document.getElementById('swal-motivo').value = evento.MOTIVO || '';
        document.getElementById('swal-obs').value = evento.OBS || '';

        if (evento.CODPACIENTE) {
          const paciente = pacientes.find((p) => p.CODPACIENTE == evento.CODPACIENTE) || {
            CODPACIENTE: evento.CODPACIENTE,
            NOMBRE: evento.PACIENTE,
            NACIMIENTO: evento.NACIMIENTO,
          };
          setPacienteSeleccionado(paciente);
        }

        document.getElementById('swal-btn-eliminar')?.addEventListener('click', async () => {
          Swal.close();
          await handleDelete(evento.ID);
        });
      } else if (fechaDefault) {
        const { date, time } = splitDatetime(fechaDefault);
        document.getElementById('swal-fecha').value = date;
        setDefaultHoras(time || '09:00');
        if (codempDefault) {
          document.getElementById('swal-codemp').value = codempDefault;
        }
      } else {
        document.getElementById('swal-fecha').value = localDateString();
        setDefaultHoras('09:00');
        if (codempDefault) {
          document.getElementById('swal-codemp').value = codempDefault;
        }
      }

      const lockedMedico = document.getElementById('swal-codemp-locked')?.value;
      if (lockedMedico) {
        document.getElementById('swal-codemp').value = lockedMedico;
      }
    },
    preConfirm: async () => {
      const fecha = document.getElementById('swal-fecha').value;
      const hora = document.getElementById('swal-hora').value;
      const horaFin = document.getElementById('swal-hora-fin').value;
      const FECHA = combineDatetime(fecha, hora);
      const FECHA_FIN = combineDatetime(fecha, horaFin);
      const CODEMP = document.getElementById('swal-codemp-locked')?.value
        || document.getElementById('swal-codemp').value;
      const CODPACIENTE = document.getElementById('swal-codpaciente').value;

      if (!fecha) {
        Swal.showValidationMessage('La fecha es requerida');
        return false;
      }

      if (!hora) {
        Swal.showValidationMessage('La hora de inicio es requerida');
        return false;
      }

      if (!horaFin) {
        Swal.showValidationMessage('La hora final es requerida');
        return false;
      }

      if (horaFin <= hora) {
        Swal.showValidationMessage('La hora final debe ser posterior a la hora de inicio');
        return false;
      }

      if (!CODEMP) {
        Swal.showValidationMessage('Debe seleccionar un médico');
        return false;
      }

      const body = {
        FECHA,
        FECHA_FIN,
        CODEMP: Number(CODEMP),
        CODPACIENTE: CODPACIENTE ? Number(CODPACIENTE) : null,
        MOTIVO: sanitizeText(document.getElementById('swal-motivo').value, { maxLength: 300 }),
        OBS: sanitizeText(document.getElementById('swal-obs').value, { maxLength: 300 }),
      };

      try {
        if (isEdit) {
          await api.agenda.update(evento.ID, body);
        } else {
          await api.agenda.create(body);
        }
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) return;

  refreshAgendaViews();
  await alertSuccess(isEdit ? 'Cita actualizada' : 'Cita creada');
}

async function handleDelete(id) {
  const confirmed = await confirmAction({
    title: '¿Eliminar cita?',
    text: '¿Desea eliminar esta cita? Esta acción no se puede deshacer.',
    icon: 'warning',
    confirmText: 'Eliminar',
    confirmColor: 'danger',
  });

  if (!confirmed) return;

  try {
    await api.agenda.delete(id);
    refreshAgendaViews();
    await alertSuccess('Cita eliminada');
  } catch (error) {
    await alertError(error.message);
  }
}

function buildRecordatorioMensaje(evento) {
  const nombre = evento.PACIENTE?.trim() || 'estimado paciente';
  const empresa = getSession()?.empresa?.trim() || 'nuestra clínica dental';
  const horario = formatCitaHorario(evento);
  const fecha = formatFechaDisplay(splitDatetime(evento.FECHA).date);

  return `Hola ${nombre}, le recordamos su cita dental el ${fecha} a las ${horario} en ${empresa}. ¡Le esperamos!`;
}

function renderAgendaWhatsappBtn(evento) {
  if (getSession()?.tipo !== 'SECRETARIA' || !evento.CODPACIENTE) return '';

  const waUrl = buildWaMeUrl(evento.TELEFONOS, buildRecordatorioMensaje(evento));

  if (waUrl) {
    return `
      <a
        href="${escapeHtml(waUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-sm btn-whatsapp btn-action btn-action-labeled"
        data-whatsapp-recordatorio
        title="Enviar recordatorio por WhatsApp"
      >
        <i class="fa-brands fa-whatsapp me-1"></i>Recordatorio
      </a>
    `;
  }

  return `
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary btn-action btn-action-labeled"
      disabled
      title="Sin teléfono registrado"
    >
      <i class="fa-brands fa-whatsapp me-1"></i>Sin teléfono
    </button>
  `;
}

function renderAgendaPacienteActionBtns(evento) {
  if (!evento?.CODPACIENTE) return '';

  const tipo = getSession()?.tipo;
  const isMedico = tipo === 'MEDICO';
  const showTratamientos = showAgendaTratamientosBtn(tipo);
  const isSecretaria = tipo === 'SECRETARIA';

  if (!isMedico && !showTratamientos && !isSecretaria) return '';

  const perfilBtn = isMedico
    ? `
      <button
        type="button"
        class="btn btn-sm btn-outline-primary btn-action btn-action-labeled"
        data-paciente-perfil="${evento.CODPACIENTE}"
        title="Ver perfil del paciente"
      >
        <i class="fa-solid fa-user me-1"></i>Perfil
      </button>
    `
    : '';

  const tratamientosBtn = showTratamientos
    ? `
      <button
        type="button"
        class="btn btn-sm btn-outline-info btn-action btn-action-labeled"
        data-tratamientos="${evento.CODPACIENTE}"
        title="Ver detalles del paciente"
      >
        <i class="fa-solid fa-folder-open me-1"></i>Detalles
      </button>
    `
    : '';

  const whatsappBtn = renderAgendaWhatsappBtn(evento);

  return `${perfilBtn}${tratamientosBtn}${whatsappBtn}`;
}

function renderAgendaMobileCards(eventos) {
  if (eventos.length === 0) {
    return '<p class="text-center text-muted py-4 mb-0">No hay citas para esta fecha</p>';
  }

  return sortEventosPorHora(eventos).map((evento) => {
    const color = evento.COLOR || '#0ea5e9';
    const pacienteBtns = renderAgendaPacienteActionBtns(evento);

    return `
      <article
        class="agenda-mobile-card"
        data-event-id="${evento.ID}"
        style="--agenda-medico-color: ${color}"
      >
        <div class="agenda-mobile-card-body">
          <div class="agenda-mobile-card-top">
            <span class="agenda-mobile-card-hora">
              <i class="fa-regular fa-clock me-1"></i>${escapeHtml(formatCitaHorario(evento))}
            </span>
          </div>
          <h6 class="agenda-mobile-card-paciente">${escapeHtml(evento.PACIENTE || 'Sin paciente')}</h6>
          <p class="agenda-mobile-card-motivo">
            <i class="fa-solid fa-notes-medical me-1"></i>${escapeHtml(evento.MOTIVO || 'Sin motivo')}
          </p>
          ${evento.OBS ? `
            <p class="agenda-mobile-card-obs">${escapeHtml(evento.OBS)}</p>
          ` : ''}
          <div class="agenda-mobile-card-actions">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary btn-action"
              data-cita-detalle="${evento.ID}"
              title="Ver detalle de la cita"
            >
              <i class="fa-solid fa-eye"></i>
            </button>
            ${pacienteBtns}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function loadAgendaMobileList(fecha = getAgendaMobileFecha()) {
  const list = document.getElementById('agendaMobileList');
  if (!list) return;

  selectedDate = fecha;
  list.innerHTML = '<p class="text-center text-muted py-4 mb-0">Cargando...</p>';

  try {
    const filtrados = await fetchAgendaDelDia(fecha);
    if (!document.getElementById('agendaMobileList')) return;
    updateAgendaCitasCount(filtrados.length);
    list.innerHTML = renderAgendaMobileCards(filtrados);
  } catch (error) {
    if (document.getElementById('agendaMobileList')) {
      list.innerHTML = `<p class="text-center text-danger py-4 mb-0">${escapeHtml(error.message)}</p>`;
    }
  }
}

function refreshAgendaViews() {
  if (isAgendaMobileLayout()) {
    loadAgendaMobileList(getAgendaMobileFecha());
    return;
  }

  if (agendaDesktopMode === 'list') {
    loadAgendaDesktopList(getAgendaDesktopFecha());
    return;
  }

  calendar?.refetchEvents();
}

function bindAgendaMobileList() {
  const list = document.getElementById('agendaMobileList');
  const fechaInput = document.getElementById('agendaMobileFecha');
  if (!list || list.dataset.mobileBound === '1') return;

  list.dataset.mobileBound = '1';

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = selectedDate || localDateString();
  }

  fechaInput?.addEventListener('change', () => {
    if (fechaInput.value) {
      selectedDate = fechaInput.value;
      loadAgendaMobileList(fechaInput.value);
    }
  });

  list.addEventListener('click', handleAgendaListClick);
}

function setupAgendaLayout(initialView = 'dayGridMonth') {
  if (!isAgendaMounted()) return;

  if (isAgendaMobileLayout()) {
    if (calendar) {
      try {
        calendar.destroy();
      } catch (_) {
        /* ignorar */
      }
      calendar = null;
    }
    loadAgendaMobileList(getAgendaMobileFecha());
    return;
  }

  bindAgendaDesktopList();
  setAgendaDesktopMode(agendaDesktopMode || 'calendar');
  if (agendaDesktopMode !== 'list' && !calendar) {
    initCalendar(initialView);
  }
}

export function renderAgenda() {
  const hoy = localDateString();

  return `
    <div class="content-card view-agenda">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-calendar-days me-2 text-primary"></i>Calendario de citas</h5>
        <div class="agenda-header-actions">
          <button class="btn btn-sm btn-outline-primary btn-rounded" id="btnHorasDisponibles" type="button">
            <i class="fa-solid fa-clock me-1"></i>Horas disponibles
          </button>
          <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevaCita" type="button">
            <i class="fa-solid fa-plus me-1"></i>Nueva cita
          </button>
        </div>
      </div>
      <div class="agenda-filtros">
        <label for="filtroMedico" class="agenda-filtro-label">
          <i class="fa-solid fa-user-doctor"></i>Filtrar por médico
        </label>
        <select id="filtroMedico" class="form-select agenda-filtro-select">
          <option value="">Todos los médicos</option>
        </select>
        <span id="agendaCitasCount" class="agenda-citas-count">—</span>
      </div>

      <div class="agenda-desktop-toolbar" id="agendaDesktopToolbar">
        <div class="agenda-view-toggle btn-group" role="group" aria-label="Vista de agenda">
          <button type="button" class="btn btn-sm btn-outline-primary active" data-agenda-mode="calendar">
            <i class="fa-solid fa-calendar me-1"></i>Calendario
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" data-agenda-mode="list">
            <i class="fa-solid fa-list me-1"></i>Listado del día
          </button>
        </div>
      </div>

      <div class="agenda-desktop" id="agendaDesktop">
        <div class="agenda-desktop-calendar" id="agendaDesktopCalendar">
          <div id="calendar"></div>
        </div>

        <div class="agenda-desktop-list d-none" id="agendaDesktopList">
          <div class="agenda-desktop-list-toolbar">
            <div class="agenda-desktop-list-fecha">
              <label for="agendaDesktopFecha" class="form-label">Fecha</label>
              <input type="date" id="agendaDesktopFecha" class="form-control" value="${hoy}">
            </div>
            <p class="agenda-desktop-list-meta mb-0">
              Citas del <strong id="agendaDesktopFechaLabel"></strong>
            </p>
          </div>
          <div class="table-responsive">
            <table class="table table-hover crud-table agenda-desktop-table mb-0">
              <thead id="agendaDesktopTableHead"></thead>
              <tbody id="agendaDesktopTableBody">
                <tr>
                  <td class="text-center text-muted py-4">Cargando...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="agenda-mobile" id="agendaMobile">
        <div class="agenda-mobile-toolbar">
          <label for="agendaMobileFecha" class="form-label">Fecha</label>
          <input type="date" id="agendaMobileFecha" class="form-control">
        </div>
        <div class="agenda-mobile-list" id="agendaMobileList">
          <p class="text-center text-muted py-4 mb-0">Cargando...</p>
        </div>
      </div>
    </div>
  `;
}

function initCalendar(initialView = 'dayGridMonth') {
  const el = document.getElementById('calendar');
  if (!el || typeof FullCalendar === 'undefined') {
    cleanupAgenda();
    return;
  }

  if (calendar) {
    try {
      calendar.destroy();
    } catch (_) {
      /* ignorar si el nodo ya no existe */
    }
    calendar = null;
  }

  calendar = new FullCalendar.Calendar(el, {
    initialView,
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
    },
    height: 'auto',
    selectable: true,
    editable: false,
    nowIndicator: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    events: fetchEventos,
    datesSet(info) {
      const fecha = info.startStr.slice(0, 10);
      selectedDate = fecha;

      if (agendaDesktopMode === 'list') {
        const desktopFecha = document.getElementById('agendaDesktopFecha');
        if (desktopFecha) desktopFecha.value = fecha;
        loadAgendaDesktopList(fecha);
      }
    },
    eventDidMount(info) {
      const color = info.event.extendedProps.COLOR || info.event.borderColor || '#0ea5e9';
      info.el.style.borderLeft = `4px solid ${color}`;
      info.el.style.borderColor = color;
      info.el.style.borderWidth = '2px';
      info.el.style.borderLeftWidth = '4px';
    },
    dateClick(info) {
      selectedDate = info.dateStr.slice(0, 10);
      const fecha = info.dateStr.length <= 10
        ? `${info.dateStr} 09:00:00`
        : info.dateStr.replace('T', ' ').slice(0, 19);
      openEventoForm('create', null, fecha);
    },
    eventClick(info) {
      const props = { ...info.event.extendedProps, ID: info.event.id };
      if (info.event.start) {
        const inicio = splitDatetime(info.event.start);
        if (inicio.date) selectedDate = inicio.date;
        props.FECHA = combineDatetime(inicio.date, inicio.time);
      }
      if (info.event.end) {
        const fin = splitDatetime(info.event.end);
        props.FECHA_FIN = combineDatetime(fin.date, fin.time);
      }
      openCitaDetalleModal(props);
    },
  });

  calendar.render();
}

export async function bindAgenda(params = {}) {
  const { viewGen } = params;

  cleanupAgenda();
  bindAbort = new AbortController();
  const { signal } = bindAbort;
  selectedDate = localDateString();

  try {
    const roleConfig = getAgendaRoleConfig();
    await loadCatalogos();

    if (signal.aborted || !isAgendaMounted()) return;
    if (viewGen && !isViewMounted(viewGen)) return;

    const filtroContainer = document.querySelector('.agenda-filtros');

    const agendaMobile = document.getElementById('agendaMobile');
    const showPacienteActions = roleConfig.lockMedico || getSession()?.tipo === 'SECRETARIA';

    if (roleConfig.lockMedico) {
      filtroMedico = String(roleConfig.codemp || '');
      filtroContainer?.classList.remove('d-none');
      filtroContainer?.classList.add('agenda-filtros-solo-conteo');
    } else {
      filtroMedico = '';
      filtroContainer?.classList.remove('d-none', 'agenda-filtros-solo-conteo');
      renderFiltroMedico();
    }

    agendaMobile?.classList.toggle('agenda-mobile-paciente-actions', showPacienteActions);

    const agendaDesktop = document.getElementById('agendaDesktop');
    agendaDesktop?.classList.toggle('agenda-desktop-paciente-actions', showPacienteActions);

    bindAgendaMobileList();
    bindAgendaDesktopList();
    bindAgendaDesktopModeToggle(signal);
    setupAgendaLayout(roleConfig.initialView);

    if (signal.aborted || !isAgendaMounted()) return;
    if (viewGen && !isViewMounted(viewGen)) return;

    agendaMobileResizeHandler = () => {
      if (!isAgendaMounted()) return;
      setupAgendaLayout(roleConfig.initialView);
    };
    AGENDA_MOBILE_MQ.addEventListener('change', agendaMobileResizeHandler);

    document.getElementById('filtroMedico')?.addEventListener('change', (e) => {
      filtroMedico = e.target.value;
      refreshAgendaViews();
    }, { signal });

    document.getElementById('btnHorasDisponibles')?.addEventListener('click', () => {
      openHorasDisponiblesModal();
    }, { signal });

    document.getElementById('btnNuevaCita')?.addEventListener('click', () => {
      openEventoForm('create');
    }, { signal });
  } catch (error) {
    if (signal.aborted) return;
    if (viewGen && !isViewMounted(viewGen)) return;
    await alertError(error.message);
  }
}
