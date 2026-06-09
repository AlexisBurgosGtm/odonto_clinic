/**
 * Limpia texto antes de enviarlo al API.
 * Elimina caracteres de control, invisibles y otros que pueden romper el esquema.
 */
export function sanitizeText(value, { maxLength } = {}) {
  if (value == null || value === '') return '';

  let text = String(value);

  text = text
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength);
  }

  return text;
}
