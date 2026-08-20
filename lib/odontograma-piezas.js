/** Numeración Universal: adulto 1-32, niño A-T */

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
    derecha: ['A', 'B', 'C', 'D', 'E'],
    izquierda: ['F', 'G', 'H', 'I', 'J'],
  },
  inferior: {
    derecha: ['T', 'S', 'R', 'Q', 'P'],
    izquierda: ['O', 'N', 'M', 'L', 'K'],
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
  isEstadoValido,
};
