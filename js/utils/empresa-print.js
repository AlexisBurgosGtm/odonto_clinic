import { getSession } from '../services/session.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Datos de empresa para encabezados de impresión.
 * @param {string|{nombre?:string,direccion?:string,telefonos?:string}} [empresa]
 */
export function getEmpresaPrintData(empresa) {
  const session = getSession();
  const fromObject = empresa && typeof empresa === 'object';

  return {
    nombre: String(
      (fromObject ? empresa.nombre : empresa)
        || session?.empresa
        || 'Clínica Dental'
    ).trim() || 'Clínica Dental',
    direccion: String(
      (fromObject ? empresa.direccion : null)
        || session?.empresaDireccion
        || ''
    ).trim(),
    telefonos: String(
      (fromObject ? empresa.telefonos : null)
        || session?.empresaTelefonos
        || ''
    ).trim(),
  };
}

/** Líneas de dirección/teléfonos bajo el nombre de empresa (HTML escapado). */
export function empresaContactHtml({ direccion, telefonos } = {}, className = 'empresa-contact') {
  const lines = [];
  if (direccion) lines.push(escapeHtml(direccion));
  if (telefonos) lines.push(`Tel: ${escapeHtml(telefonos)}`);
  if (!lines.length) return '';
  return `<div class="${className}">${lines.join('<br>')}</div>`;
}

export function empresaContactCss(selector = '.empresa-contact') {
  return `
    ${selector} {
      margin-top: 3px;
      font-size: 9pt;
      color: #555;
      line-height: 1.35;
    }
  `;
}
