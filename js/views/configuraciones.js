import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError, alertSuccess } from '../utils/swal.js';
import { isViewMounted } from '../utils/view.js';

const TIPO_CUMPLE = 'CUMPLE';

async function loadMensajeCumple(viewGen) {
  try {
    const config = await api.config.get(TIPO_CUMPLE);
    if (viewGen && !isViewMounted(viewGen)) return;

    const textarea = document.getElementById('configCumpleMensaje');
    if (textarea) {
      textarea.value = config.DETALLES || '';
    }
    clearAlert('configuracionesAlert');
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('configuracionesAlert', error.message);
    }
  }
}

export function renderConfiguraciones() {
  return `
    <div id="configuracionesAlert"></div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-gear me-2 text-primary"></i>Configuración del sistema</h5>
      </div>
      <p class="text-muted mb-4">
        Ajustes generales de la clínica. Los cambios aplican para todos los usuarios.
      </p>

      <div class="content-card config-option-card">
        <div class="config-option-header">
          <div>
            <h6 class="mb-1">
              <i class="fa-solid fa-cake-candles me-2 text-primary"></i>
              Mensaje de cumpleaños (WhatsApp)
            </h6>
            <p class="text-muted small mb-0">
              Texto enviado al felicitar pacientes. La palabra <strong>paciente</strong> se reemplaza por el nombre del paciente.
            </p>
          </div>
        </div>

        <form id="configCumpleForm" class="mt-3">
          <div class="mb-3">
            <label for="configCumpleMensaje" class="form-label">Mensaje personalizado</label>
            <textarea
              id="configCumpleMensaje"
              class="form-control"
              rows="4"
              maxlength="700"
              placeholder="Ej: ¡Feliz cumpleaños, paciente! Te deseamos un excelente día."
            ></textarea>
            <div class="form-text">Máximo 700 caracteres. Use la palabra <em>paciente</em> donde quiera insertar el nombre.</div>
          </div>

          <div class="d-flex justify-content-end">
            <button type="submit" class="btn btn-primary btn-rounded" id="btnGuardarCumple">
              <i class="fa-solid fa-floppy-disk me-1"></i>Guardar mensaje
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export async function bindConfiguraciones(params = {}) {
  const { viewGen } = params;
  const form = document.getElementById('configCumpleForm');

  await loadMensajeCumple(viewGen);
  if (viewGen && !isViewMounted(viewGen)) return;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = document.getElementById('configCumpleMensaje');
    const detalles = textarea?.value?.trim() || '';

    if (!detalles) {
      showAlert('configuracionesAlert', 'El mensaje no puede estar vacío');
      return;
    }

    const btn = document.getElementById('btnGuardarCumple');
    btn?.setAttribute('disabled', 'disabled');

    try {
      await api.config.update(TIPO_CUMPLE, { DETALLES: detalles });
      if (viewGen && !isViewMounted(viewGen)) return;

      clearAlert('configuracionesAlert');
      await alertSuccess('Mensaje de cumpleaños guardado correctamente');
    } catch (error) {
      if (!viewGen || isViewMounted(viewGen)) {
        showAlert('configuracionesAlert', error.message);
      }
    } finally {
      if (!viewGen || isViewMounted(viewGen)) {
        btn?.removeAttribute('disabled');
      }
    }
  });
}
