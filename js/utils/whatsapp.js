export function normalizarTelefonoWhatsApp(telefonos) {
  if (!telefonos) return null;

  const digits = String(telefonos).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 8) return `502${digits}`;
  return digits;
}

export function buildWaMeUrl(telefonos, mensaje) {
  const phone = normalizarTelefonoWhatsApp(telefonos);
  if (!phone) return null;

  const text = encodeURIComponent(mensaje);
  return `https://wa.me/${phone}?text=${text}`;
}
