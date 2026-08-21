/**
 * Adulto: Universal 1–32
 * Niño: FDI 5.1–8.5
 */

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
    derecha: ['1', '2', '3', '4', '5', '6', '7', '8'],
    izquierda: ['9', '10', '11', '12', '13', '14', '15', '16'],
  },
  inferior: {
    derecha: ['32', '31', '30', '29', '28', '27', '26', '25'],
    izquierda: ['24', '23', '22', '21', '20', '19', '18', '17'],
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

function getAllPiezasCatalog() {
  return [...getPiezasSet('ADULTO'), ...getPiezasSet('NINO')];
}

/** Normaliza pieza sin convertir Universal 12 → 1.2 */
function normalizePieza(value) {
  return String(value || '').trim().replace(',', '.');
}

/** @deprecated alias */
function normalizePiezaFdi(value) {
  return normalizePieza(value);
}

function getAllPiezasFdi() {
  return getAllPiezasCatalog();
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
  getAllPiezasCatalog,
  getAllPiezasFdi,
  normalizePieza,
  normalizePiezaFdi,
  isEstadoValido,
};
