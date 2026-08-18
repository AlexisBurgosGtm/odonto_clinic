import { api } from '../services/api.js';
import { showAlert, clearAlert } from '../utils/alerts.js';
import { alertError, alertSuccess } from '../utils/swal.js';
import { sanitizeText } from '../utils/sanitize.js';
import { isViewMounted } from '../utils/view.js';

const DEFAULT_URLS = {
  URL_FIRMA: 'https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml',
  URL_CERTIFICACION: 'https://certificador.feel.com.gt/fel/certificacion/v2/dte/',
  URL_ANULACION: 'https://certificador.feel.com.gt/fel/anulacion/v2/dte/',
  URL_PROCESO_UNIFICADO: 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml',
  URL_CONSULTA_NIT: 'https://consultareceptores.feel.com.gt/rest/action',
};

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function fill(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function applyCredenciales(data) {
  fill('felNitEmisor', data.NIT_EMISOR);
  fill('felNombreEmisor', data.NOMBRE_EMISOR);
  fill('felNombreComercial', data.NOMBRE_COMERCIAL);
  fill('felDireccion', data.DIRECCION);
  fill('felCodigoPostal', data.CODIGO_POSTAL || '01001');
  fill('felMunicipio', data.MUNICIPIO || 'GUATEMALA');
  fill('felDepartamento', data.DEPARTAMENTO || 'GUATEMALA');
  fill('felPais', data.PAIS || 'GT');
  fill('felEstablecimiento', data.CODIGO_ESTABLECIMIENTO || '1');
  fill('felCorreoCopia', data.CORREO_COPIA);
  fill('felUsuarioFirma', data.USUARIO_FIRMA);
  fill('felLlaveFirma', data.LLAVE_FIRMA);
  fill('felUsuarioApi', data.USUARIO_API);
  fill('felLlaveApi', data.LLAVE_API);
  fill('felUrlFirma', data.URL_FIRMA || DEFAULT_URLS.URL_FIRMA);
  fill('felUrlCertificacion', data.URL_CERTIFICACION || DEFAULT_URLS.URL_CERTIFICACION);
  fill('felUrlAnulacion', data.URL_ANULACION || DEFAULT_URLS.URL_ANULACION);
  fill('felUrlUnificado', data.URL_PROCESO_UNIFICADO || DEFAULT_URLS.URL_PROCESO_UNIFICADO);
  fill('felUrlConsultaNit', data.URL_CONSULTA_NIT || DEFAULT_URLS.URL_CONSULTA_NIT);
  fill('felTipoContribuyente', data.TIPO_CONTRIBUYENTE || 'GEN');
  fill('felTipoFrase', data.TIPO_FRASE ?? 1);
  fill('felCodigoEscenario', data.CODIGO_ESCENARIO ?? 1);
  fill('felUsarUnificado', data.USAR_UNIFICADO || 'SI');
}

function collectCredenciales() {
  return {
    NIT_EMISOR: sanitizeText(val('felNitEmisor'), { maxLength: 20 }),
    NOMBRE_EMISOR: sanitizeText(val('felNombreEmisor'), { maxLength: 300 }),
    NOMBRE_COMERCIAL: sanitizeText(val('felNombreComercial'), { maxLength: 300 }),
    DIRECCION: sanitizeText(val('felDireccion'), { maxLength: 500 }),
    CODIGO_POSTAL: sanitizeText(val('felCodigoPostal'), { maxLength: 10 }),
    MUNICIPIO: sanitizeText(val('felMunicipio'), { maxLength: 100 }),
    DEPARTAMENTO: sanitizeText(val('felDepartamento'), { maxLength: 100 }),
    PAIS: sanitizeText(val('felPais'), { maxLength: 5 }) || 'GT',
    CODIGO_ESTABLECIMIENTO: sanitizeText(val('felEstablecimiento'), { maxLength: 10 }) || '1',
    CORREO_COPIA: sanitizeText(val('felCorreoCopia'), { maxLength: 150 }),
    USUARIO_FIRMA: sanitizeText(val('felUsuarioFirma'), { maxLength: 120 }),
    LLAVE_FIRMA: sanitizeText(val('felLlaveFirma'), { maxLength: 255 }),
    USUARIO_API: sanitizeText(val('felUsuarioApi'), { maxLength: 120 }),
    LLAVE_API: sanitizeText(val('felLlaveApi'), { maxLength: 255 }),
    URL_FIRMA: sanitizeText(val('felUrlFirma'), { maxLength: 500 }),
    URL_CERTIFICACION: sanitizeText(val('felUrlCertificacion'), { maxLength: 500 }),
    URL_ANULACION: sanitizeText(val('felUrlAnulacion'), { maxLength: 500 }),
    URL_PROCESO_UNIFICADO: sanitizeText(val('felUrlUnificado'), { maxLength: 500 }),
    URL_CONSULTA_NIT: sanitizeText(val('felUrlConsultaNit'), { maxLength: 500 }),
    TIPO_CONTRIBUYENTE: val('felTipoContribuyente') || 'GEN',
    TIPO_FRASE: Number(val('felTipoFrase')) || 1,
    CODIGO_ESCENARIO: Number(val('felCodigoEscenario')) || 1,
    USAR_UNIFICADO: val('felUsarUnificado') || 'SI',
  };
}

export function renderCredencialesFel() {
  return `
    <div id="credencialesFelAlert"></div>

    <div class="content-card view-credenciales-fel">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-key me-2 text-primary"></i>Credenciales FEL (INFILE)</h5>
      </div>
      <p class="text-muted mb-4">
        Un solo registro por empresa. Aquí se configuran emisor, régimen (IVA normal o pequeño contribuyente)
        y las URL de los servicios de INFILE para firmar, certificar, anular y consultar NIT.
      </p>

      <form id="credencialesFelForm">
        <h6 class="fel-section-title">Datos del emisor</h6>
        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <label class="form-label" for="felNitEmisor">NIT emisor <span class="text-danger">*</span></label>
            <input id="felNitEmisor" class="form-control" maxlength="20" required>
          </div>
          <div class="col-md-8">
            <label class="form-label" for="felNombreEmisor">Nombre / razón social <span class="text-danger">*</span></label>
            <input id="felNombreEmisor" class="form-control" maxlength="300" required>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="felNombreComercial">Nombre comercial</label>
            <input id="felNombreComercial" class="form-control" maxlength="300">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felEstablecimiento">Establecimiento SAT</label>
            <input id="felEstablecimiento" class="form-control" maxlength="10" value="1">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felCorreoCopia">Correo copia FEL</label>
            <input id="felCorreoCopia" type="email" class="form-control" maxlength="150">
          </div>
          <div class="col-md-12">
            <label class="form-label" for="felDireccion">Dirección</label>
            <input id="felDireccion" class="form-control" maxlength="500">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felCodigoPostal">Código postal</label>
            <input id="felCodigoPostal" class="form-control" maxlength="10" value="01001">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felMunicipio">Municipio</label>
            <input id="felMunicipio" class="form-control" maxlength="100" value="GUATEMALA">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felDepartamento">Departamento</label>
            <input id="felDepartamento" class="form-control" maxlength="100" value="GUATEMALA">
          </div>
          <div class="col-md-3">
            <label class="form-label" for="felPais">País</label>
            <input id="felPais" class="form-control" maxlength="5" value="GT">
          </div>
        </div>

        <h6 class="fel-section-title">Régimen y frases SAT</h6>
        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <label class="form-label" for="felTipoContribuyente">Tipo de contribuyente</label>
            <select id="felTipoContribuyente" class="form-select">
              <option value="GEN">IVA normal (FACT)</option>
              <option value="PEQ">Pequeño contribuyente (FPEQ)</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label" for="felTipoFrase">Tipo de frase</label>
            <input id="felTipoFrase" type="number" min="1" class="form-control" value="1">
          </div>
          <div class="col-md-4">
            <label class="form-label" for="felCodigoEscenario">Código de escenario</label>
            <input id="felCodigoEscenario" type="number" min="1" class="form-control" value="1">
          </div>
        </div>

        <h6 class="fel-section-title">Credenciales INFILE</h6>
        <div class="row g-3 mb-4">
          <div class="col-md-6">
            <label class="form-label" for="felUsuarioApi">Usuario API</label>
            <input id="felUsuarioApi" class="form-control" maxlength="120" autocomplete="off">
          </div>
          <div class="col-md-6">
            <label class="form-label" for="felLlaveApi">Llave API</label>
            <input id="felLlaveApi" class="form-control" maxlength="255" autocomplete="off">
          </div>
          <div class="col-md-6">
            <label class="form-label" for="felUsuarioFirma">Usuario firma</label>
            <input id="felUsuarioFirma" class="form-control" maxlength="120" autocomplete="off">
          </div>
          <div class="col-md-6">
            <label class="form-label" for="felLlaveFirma">Llave firma</label>
            <input id="felLlaveFirma" class="form-control" maxlength="255" autocomplete="off">
          </div>
          <div class="col-md-4">
            <label class="form-label" for="felUsarUnificado">Proceso</label>
            <select id="felUsarUnificado" class="form-select">
              <option value="SI">Unificado (firmar + certificar)</option>
              <option value="NO">Separado (firma y luego certifica)</option>
            </select>
          </div>
        </div>

        <h6 class="fel-section-title">Endpoints INFILE</h6>
        <div class="row g-3 mb-4">
          <div class="col-12">
            <label class="form-label" for="felUrlUnificado">URL proceso unificado</label>
            <input id="felUrlUnificado" class="form-control" maxlength="500">
          </div>
          <div class="col-12">
            <label class="form-label" for="felUrlFirma">URL firma</label>
            <input id="felUrlFirma" class="form-control" maxlength="500">
          </div>
          <div class="col-12">
            <label class="form-label" for="felUrlCertificacion">URL certificación</label>
            <input id="felUrlCertificacion" class="form-control" maxlength="500">
          </div>
          <div class="col-12">
            <label class="form-label" for="felUrlAnulacion">URL anulación</label>
            <input id="felUrlAnulacion" class="form-control" maxlength="500">
          </div>
          <div class="col-12">
            <label class="form-label" for="felUrlConsultaNit">URL consulta NIT</label>
            <input id="felUrlConsultaNit" class="form-control" maxlength="500">
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <button type="submit" class="btn btn-primary btn-rounded" id="btnGuardarCredencialesFel">
            <i class="fa-solid fa-floppy-disk me-1"></i>Guardar credenciales
          </button>
        </div>
      </form>
    </div>
  `;
}

export async function bindCredencialesFel(params = {}) {
  const { viewGen } = params;
  const form = document.getElementById('credencialesFelForm');

  try {
    const data = await api.credencialesFel.get();
    if (viewGen && !isViewMounted(viewGen)) return;
    applyCredenciales(data);
    clearAlert('credencialesFelAlert');
  } catch (error) {
    if (!viewGen || isViewMounted(viewGen)) {
      showAlert('credencialesFelAlert', error.message);
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = collectCredenciales();

    if (!body.NIT_EMISOR) {
      showAlert('credencialesFelAlert', 'El NIT del emisor es requerido');
      return;
    }
    if (!body.NOMBRE_EMISOR) {
      showAlert('credencialesFelAlert', 'El nombre del emisor es requerido');
      return;
    }

    const btn = document.getElementById('btnGuardarCredencialesFel');
    btn?.setAttribute('disabled', 'disabled');

    try {
      const saved = await api.credencialesFel.save(body);
      if (viewGen && !isViewMounted(viewGen)) return;
      applyCredenciales(saved);
      clearAlert('credencialesFelAlert');
      await alertSuccess('Credenciales FEL guardadas');
    } catch (error) {
      if (!viewGen || isViewMounted(viewGen)) {
        showAlert('credencialesFelAlert', error.message);
      }
    } finally {
      if (!viewGen || isViewMounted(viewGen)) {
        btn?.removeAttribute('disabled');
      }
    }
  });

  document.getElementById('felTipoContribuyente')?.addEventListener('change', (e) => {
    const tipoFrase = document.getElementById('felTipoFrase');
    if (!tipoFrase) return;
    if (e.target.value === 'PEQ' && String(tipoFrase.value) === '1') tipoFrase.value = '4';
    if (e.target.value === 'GEN' && String(tipoFrase.value) === '4') tipoFrase.value = '1';
  });
}
