/** Nomenclatura FDI (ISO 3950): adulto 1.1–4.8, niño 5.1–8.5 */

const ESTADOS_ODONTOGRAMA = [
  { value: 'SANO', label: 'Sano', color: '#e2e8f0' },
  { value: 'CARIES', label: 'Caries', color: '#f87171' },
  { value: 'OBTURADO', label: 'Obturado', color: '#60a5fa' },
  { value: 'EXTRAIDO', label: 'Extraído', color: '#94a3b8' },
  { value: 'CORONA', label: 'Corona', color: '#fbbf24' },
  { value: 'ENDODONCIA', label: 'Endodoncia', color: '#a78bfa' },
  { value: 'AUSENTE', label: 'Ausente', color: '#cbd5e1' },
  { value: 'IMPLANTE', label: 'Implante', color: '#34d399' },
];

/** Vista frente al paciente: izquierda UI = derecha del paciente */
const ADULTO_LAYOUT = {
  superior: {
    derecha: ['1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1'],
    izquierda: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'],
  },
  inferior: {
    derecha: ['4.8', '4.7', '4.6', '4.5', '4.4', '4.3', '4.2', '4.1'],
    izquierda: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'],
  },
};

const NINO_LAYOUT = {
  superior: {
    derecha: ['5.5', '5.4', '5.3', '5.2', '5.1'],
    izquierda: ['6.1', '6.2', '6.3', '6.4', '6.5'],
  },
  inferior: {
    derecha: ['8.5', '8.4', '8.3', '8.2', '8.1'],
    izquierda: ['7.1', '7.2', '7.3', '7.4', '7.5'],
  },
};

function normalizeTipoPaciente(value) {
  const v = String(value || 'ADULTO').trim().toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return v === 'NINO' ? 'NINO' : 'ADULTO';
}

function getLayout(tipoPaciente) {
  return normalizeTipoPaciente(tipoPaciente) === 'NINO' ? NINO_LAYOUT : ADULTO_LAYOUT;
}

function getPiezasSet(tipoPaciente) {
  const layout = getLayout(tipoPaciente);
  return [
    ...layout.superior.derecha,
    ...layout.superior.izquierda,
    ...layout.inferior.derecha,
    ...layout.inferior.izquierda,
  ];
}

function getAllPiezasFdi() {
  return [...getPiezasSet('ADULTO'), ...getPiezasSet('NINO')];
}

/** Normaliza "12", "1.2", "1,2" → "1.2" */
function normalizePiezaFdi(value) {
  const raw = String(value || '').trim().replace(',', '.');
  if (!raw) return '';

  if (/^\d\.\d$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 2) {
    return `${digits[0]}.${digits[1]}`;
  }

  return raw.toUpperCase();
}

function isEstadoValido(estado) {
  return ESTADOS_ODONTOGRAMA.some((e) => e.value === String(estado || '').toUpperCase());
}

module.exports = {
  ESTADOS_ODONTOGRAMA,
  ADULTO_LAYOUT,
  NINO_LAYOUT,
  normalizeTipoPaciente,
  getLayout,
  getPiezasSet,
  getAllPiezasFdi,
  normalizePiezaFdi,
  isEstadoValido,
};
