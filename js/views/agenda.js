import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { confirmAction, alertError, alertSuccess, openFormDialog, SwalTheme } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';

let calendar = null;
let medicos = [];
let pacientes = [];
let filtroMedico = '';
let bindAbort = null;
let selectedDate = new Date().toISOString().slice(0, 10);

const HORAS_INICIO = 7 * 60;
const HORAS_FIN = 18 * 60;
const HORAS_INTERVALO = 30;

function isAgendaMounted() {
  return Boolean(document.getElementById('calendar'));
}

export function cleanupAgenda() {
  bindAbort?.abort();
  bindAbort = null;

  if (calendar) {
    try {
      calendar.destroy();
    } catch (_) {
      /* el DOM ya pudo haberse eliminado */
    }
    calendar = null;
  }
}

function splitDatetime(fecha) {
  if (!fecha) return { date: '', time: '' };

  const str = String(fecha).trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) {
    const [date, timePart] = str.split(' ');
    return { date, time: timePart.slice(0, 5) };
  }

  const parsed = new Date(fecha);
  if (!Number.isNaN(parsed.getTime())) {
    const date = [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0'),
    ].join('-');
    const time = [
      String(parsed.getHours()).padStart(2, '0'),
      String(parsed.getMinutes()).padStart(2, '0'),
    ].join(':');
    return { date, time };
  }

  if (str.includes('T')) {
    return { date: str.slice(0, 10), time: str.slice(11, 16) };
  }

  const [date, time] = str.split(' ');
  return { date: date || '', time: (time || '').slice(0, 5) };
}

function toCalendarDatetime(fecha) {
  const { date, time } = splitDatetime(fecha);
  if (!date) return fecha;
  return time ? `${date}T${time}:00` : date;
}

function combineDatetime(date, time) {
  if (!date || !time) return null;
  return `${date} ${time}:00`;
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

function calcularHorariosDia(eventos, fecha) {
  const ocupados = eventos
    .map((e) => getEventoRangoMinutos(e, fecha))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const slots = [];

  for (let min = HORAS_INICIO; min < HORAS_FIN; min += HORAS_INTERVALO) {
    const finSlot = min + HORAS_INTERVALO;
    if (finSlot > HORAS_FIN) break;

    const solapa = ocupados.some((o) => min < o.end && finSlot > o.start);
    slots.push({
      label: `${minutesToTime(min)} – ${minutesToTime(finSlot)}`,
      ocupado: solapa,
    });
  }

  return slots;
}

function buildHorasDisponiblesContent(fecha, medicosLista, eventos) {
  if (medicosLista.length === 0) {
    return '<p class="text-muted mb-0">No hay médicos habilitados para consultar.</p>';
  }

  return medicosLista.map((medico) => {
    const eventosMedico = eventos.filter((e) => e.CODEMP == medico.CODEMP);
    const slots = calcularHorariosDia(eventosMedico, fecha);

    const items = slots.map((slot) => `
      <li class="${slot.ocupado ? 'horas-slot-ocupado' : 'horas-slot-libre'}">${slot.label}</li>
    `).join('');

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

    content.innerHTML = buildHorasDisponiblesContent(fecha, medicosLista, eventos);
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

  const fecha = new Date().toISOString().slice(0, 10);
  const medicosLista = getMedicosListaHoras();

  await SwalTheme.fire({
    title: 'Horas disponibles',
    html: buildHorasDisponiblesShell(fecha, medicosLista),
    width: '860px',
    customClass: {
      popup: 'swal-popup swal-popup-wide',
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
    return { initialView: 'timeGridDay', lockMedico: false, codemp: null };
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
  return document.getElementById('swal-fecha')?.value || new Date().toISOString().slice(0, 10);
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
  const title = evento.MOTIVO || evento.PACIENTE || 'Cita';

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

  const start = info?.startStr || null;
  const end = info?.endStr || null;
  const eventos = await api.agenda.list(start, end);

  if (!isAgendaMounted()) return [];
  const filtrados = filtroMedico
    ? eventos.filter((e) => e.CODEMP == filtroMedico)
    : eventos;
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

async function openEventoForm(mode, evento = null, fechaDefault = null) {
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
      } else {
        document.getElementById('swal-fecha').value = new Date().toISOString().slice(0, 10);
        setDefaultHoras('09:00');
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

  calendar?.refetchEvents();
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
    calendar?.refetchEvents();
    await alertSuccess('Cita eliminada');
  } catch (error) {
    await alertError(error.message);
  }
}

export function renderAgenda() {
  return `
    <div class="content-card">
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
      </div>
      <div id="calendar"></div>
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
      if (info.view.type === 'timeGridDay') {
        selectedDate = info.startStr.slice(0, 10);
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
      const props = { ...info.event.extendedProps };
      if (info.event.start) {
        const inicio = splitDatetime(info.event.start);
        if (inicio.date) selectedDate = inicio.date;
        props.FECHA = combineDatetime(inicio.date, inicio.time);
      }
      if (info.event.end) {
        const fin = splitDatetime(info.event.end);
        props.FECHA_FIN = combineDatetime(fin.date, fin.time);
      }
      openEventoForm('edit', props);
    },
  });

  calendar.render();
}

export async function bindAgenda(params = {}) {
  const { viewGen } = params;

  cleanupAgenda();
  bindAbort = new AbortController();
  const { signal } = bindAbort;
  selectedDate = new Date().toISOString().slice(0, 10);

  try {
    const roleConfig = getAgendaRoleConfig();
    await loadCatalogos();

    if (signal.aborted || !isAgendaMounted()) return;
    if (viewGen && !isViewMounted(viewGen)) return;

    const filtroContainer = document.querySelector('.agenda-filtros');

    if (roleConfig.lockMedico) {
      filtroMedico = String(roleConfig.codemp || '');
      filtroContainer?.classList.add('d-none');
    } else {
      filtroMedico = '';
      filtroContainer?.classList.remove('d-none');
      renderFiltroMedico();
    }

    initCalendar(roleConfig.initialView);

    if (signal.aborted || !isAgendaMounted()) return;
    if (viewGen && !isViewMounted(viewGen)) return;

    document.getElementById('filtroMedico')?.addEventListener('change', (e) => {
      filtroMedico = e.target.value;
      calendar?.refetchEvents();
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
