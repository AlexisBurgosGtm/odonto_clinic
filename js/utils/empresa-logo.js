const DEFAULT_LOGO_PATH = 'logonuevo.jpeg';
const MAX_LOGO_BYTES = 256 * 1024;

let sessionLogoDataUrl = null;

function detectImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 4
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export function isValidLogoHex(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const normalized = hex.trim();
  return normalized.length > 0
    && normalized.length % 2 === 0
    && /^[0-9a-fA-F]+$/.test(normalized);
}

export function hexToDataUrl(hex) {
  if (!isValidLogoHex(hex)) return null;

  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map((pair) => parseInt(pair, 16)));
  const mime = detectImageMime(bytes);
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const base64 = btoa(binary);
  return `data:${mime};base64,${base64}`;
}

export function fileToHex(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('Solo se permiten archivos de imagen'));
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error('La imagen no puede superar 256 KB'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      resolve(hex);
    };

    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsArrayBuffer(file);
  });
}

export function getDefaultLogoUrl() {
  return new URL(DEFAULT_LOGO_PATH, window.location.href).href;
}

export function setSessionLogoFromHex(hex) {
  clearSessionLogo();
  sessionLogoDataUrl = hexToDataUrl(hex);
}

export function hasSessionLogo() {
  return Boolean(sessionLogoDataUrl);
}

export function getSessionLogoDataUrl() {
  return sessionLogoDataUrl;
}

export function getPrintLogoUrl() {
  return sessionLogoDataUrl || getDefaultLogoUrl();
}

export function clearSessionLogo() {
  sessionLogoDataUrl = null;
}
