import { api } from '../services/api.js';
import { getSession } from '../services/session.js';
import { confirmAction, alertError, alertSuccess, openFormDialog } from '../utils/swal.js';

let calendar = null;
let medicos = [];
let pacientes = [];

function toMysqlDatetime(value) {
  if (!value) return null;
  return value.replace('T', ' ') + ':00';
}

function toInputDatetime(fecha) {
  if (!fecha) return '';
  const str = String(fecha);
  return str.replace(' ', 'T').slice(0, 16);
}

function buildSelectOptions(items, valueKey, labelKey, selected) {
  return items.map((item) => {
    const val = item[valueKey];
    const label = item[labelKey] || val;
    const sel = val == selected ? 'selected' : '';
    return `<option value="${val}" ${sel}>${label}</option>`;
  }).join('');
}

function eventFormHtml(isEdit) {
  const medicoOptions = buildSelectOptions(medicos, 'CODEMP', 'EMPLEADO');
  const pacienteOptions = buildSelectOptions(pacientes, 'CODPACIENTE', 'NOMBRE');

  return `
    <div class="swal-form text-start">
      <div class="mb-3">
        <label class="form-label">Fecha y hora <span class="text-danger">*</span></label>
        <input type="datetime-local" id="swal-fecha" class="form-control">
      </div>
      <div class="mb-3">
        <label class="form-label">Médico <span class="text-danger">*</span></label>
        <select id="swal-codemp" class="form-select">
          <option value="">— Seleccionar médico —</option>
          ${medicoOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Paciente</label>
        <select id="swal-codpaciente" class="form-select">
          <option value="">— Seleccionar paciente —</option>
          ${pacienteOptions}
        </select>
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

function mapEventoToCalendar(evento) {
  const color = evento.COLOR || '#0ea5e9';
  const title = evento.MOTIVO || evento.PACIENTE || 'Cita';

  return {
    id: evento.ID,
    title,
    start: evento.FECHA,
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
  const start = info?.startStr || null;
  const end = info?.endStr || null;
  const eventos = await api.agenda.list(start, end);
  return eventos.map(mapEventoToCalendar);
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
    width: '480px',
    confirmButtonText: 'Guardar',
    didOpen: () => {
      if (isEdit) {
        document.getElementById('swal-fecha').value = toInputDatetime(evento.FECHA);
        document.getElementById('swal-codemp').value = evento.CODEMP || '';
        document.getElementById('swal-codpaciente').value = evento.CODPACIENTE || '';
        document.getElementById('swal-motivo').value = evento.MOTIVO || '';
        document.getElementById('swal-obs').value = evento.OBS || '';

        document.getElementById('swal-btn-eliminar')?.addEventListener('click', async () => {
          Swal.close();
          await handleDelete(evento.ID);
        });
      } else {
        if (fechaDefault) {
          document.getElementById('swal-fecha').value = toInputDatetime(fechaDefault);
        }
      }
    },
    preConfirm: () => {
      const FECHA = toMysqlDatetime(document.getElementById('swal-fecha').value);
      const CODEMP = document.getElementById('swal-codemp').value;
      const CODPACIENTE = document.getElementById('swal-codpaciente').value;

      if (!FECHA) {
        Swal.showValidationMessage('La fecha es requerida');
        return false;
      }

      if (!CODEMP) {
        Swal.showValidationMessage('Debe seleccionar un médico');
        return false;
      }

      return {
        FECHA,
        CODEMP: Number(CODEMP),
        CODPACIENTE: CODPACIENTE ? Number(CODPACIENTE) : null,
        MOTIVO: document.getElementById('swal-motivo').value.trim(),
        OBS: document.getElementById('swal-obs').value.trim(),
      };
    },
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    if (isEdit) {
      await api.agenda.update(evento.ID, result.value);
    } else {
      await api.agenda.create(result.value);
    }

    calendar?.refetchEvents();
    await alertSuccess(isEdit ? 'Cita actualizada' : 'Cita creada');
  } catch (error) {
    await alertError(error.message);
  }
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
  const session = getSession();

  return `
    <div class="page-header">
      <h2>Agenda</h2>
      <p>Calendario de citas — <span class="badge-empnit">${session?.empnit || ''}</span></p>
    </div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-calendar-days me-2 text-primary"></i>Calendario de citas</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded" id="btnNuevaCita">
          <i class="fa-solid fa-plus me-1"></i>Nueva cita
        </button>
      </div>
      <div id="calendar"></div>
    </div>
  `;
}

function initCalendar() {
  const el = document.getElementById('calendar');
  if (!el || typeof FullCalendar === 'undefined') return;

  if (calendar) {
    calendar.destroy();
    calendar = null;
  }

  calendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
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
    eventDidMount(info) {
      const color = info.event.extendedProps.COLOR || info.event.borderColor || '#0ea5e9';
      info.el.style.borderLeft = `4px solid ${color}`;
      info.el.style.borderColor = color;
      info.el.style.borderWidth = '2px';
      info.el.style.borderLeftWidth = '4px';
    },
    dateClick(info) {
      const fecha = info.dateStr.length <= 10
        ? `${info.dateStr}T09:00`
        : toInputDatetime(info.dateStr);
      openEventoForm('create', null, fecha);
    },
    eventClick(info) {
      openEventoForm('edit', info.event.extendedProps);
    },
  });

  calendar.render();
}

export async function bindAgenda() {
  try {
    await loadCatalogos();
    initCalendar();
    document.getElementById('btnNuevaCita')?.addEventListener('click', () => openEventoForm('create'));
  } catch (error) {
    await alertError(error.message);
  }
}
