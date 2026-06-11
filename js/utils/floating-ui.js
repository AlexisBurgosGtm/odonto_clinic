export function removeNuevoFab() {
  document.querySelectorAll('.btn-nuevo-fab').forEach((el) => el.remove());
}

export function removePrintFab() {
  document.getElementById('btnPrintOrders')?.remove();
  document.getElementById('btnPrintEstadoCuenta')?.remove();
  document.querySelectorAll('.btn-print-fab').forEach((el) => el.remove());
}

export function cleanupFloatingUi() {
  removeNuevoFab();
  removePrintFab();
}
