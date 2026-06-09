/**
 * Fechas/horas en zona horaria local del dispositivo (sin depender del host).
 */

export function localDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function splitDatetime(value) {
  if (!value) return { date: '', time: '' };

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      date: localDateString(value),
      time: [
        String(value.getHours()).padStart(2, '0'),
        String(value.getMinutes()).padStart(2, '0'),
      ].join(':'),
    };
  }

  const str = String(value).trim();

  const sqlMatch = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (sqlMatch) {
    return { date: sqlMatch[1], time: sqlMatch[2] };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { date: str, time: '' };
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: localDateString(parsed),
      time: [
        String(parsed.getHours()).padStart(2, '0'),
        String(parsed.getMinutes()).padStart(2, '0'),
      ].join(':'),
    };
  }

  return { date: '', time: '' };
}

export function combineDatetime(date, time) {
  if (!date || !time) return null;
  return `${date} ${time}:00`;
}

export function toCalendarDatetime(value) {
  const { date, time } = splitDatetime(value);
  if (!date) return value;
  return time ? `${date}T${time}:00` : date;
}

export function toApiDatetime(value) {
  const { date, time } = splitDatetime(value);
  if (!date) return null;
  return combineDatetime(date, time || '00:00');
}

export function localNowDatetime() {
  const now = new Date();
  return combineDatetime(
    localDateString(now),
    [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join(':')
  );
}

export function formatLocalTime(value) {
  const { time } = splitDatetime(value);
  return time || '—';
}

export function formatLocalDateTime(value) {
  const { date, time } = splitDatetime(value);
  if (!date) return '—';

  const [y, m, d] = date.split('-');
  const fecha = `${d}/${m}/${y}`;
  return time ? `${fecha} ${time}` : fecha;
}
