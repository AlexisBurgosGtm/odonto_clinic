/**
 * Sesión en memoria — se pierde al recargar (F5)
 */
let session = null;

export function setSession(data) {
  session = { ...data };
}

export function getSession() {
  return session;
}

export function getEmpnit() {
  return session?.empnit ?? null;
}

export function clearSession() {
  session = null;
}

export function isAuthenticated() {
  return session !== null;
}
