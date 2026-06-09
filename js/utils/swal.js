const SwalTheme = Swal.mixin({
  customClass: {
    popup: 'swal-popup',
    title: 'swal-title',
    htmlContainer: 'swal-html',
    confirmButton: 'btn btn-swal-confirm',
    cancelButton: 'btn btn-swal-cancel',
    actions: 'swal-actions',
    icon: 'swal-icon',
  },
  buttonsStyling: false,
  confirmButtonText: 'Aceptar',
  cancelButtonText: 'Cancelar',
  reverseButtons: false,
});

/**
 * Confirmación — Cancelar izquierda, Aceptar derecha
 */
export function confirmAction({
  title,
  text,
  html,
  icon = 'question',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  confirmColor,
}) {
  const options = {
    title,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: false,
  };

  if (html) options.html = html;
  else options.text = text;

  if (confirmColor === 'danger') {
    options.customClass = {
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-html',
      confirmButton: 'btn btn-swal-danger',
      cancelButton: 'btn btn-swal-cancel',
      actions: 'swal-actions',
      icon: 'swal-icon',
    };
  }

  return SwalTheme.fire(options).then((result) => result.isConfirmed);
}

export function alertError(message, title = 'Error') {
  return SwalTheme.fire({ title, text: message, icon: 'error' });
}

export function alertSuccess(message, title = 'Éxito') {
  return SwalTheme.fire({ title, text: message, icon: 'success', timer: 2000, showConfirmButton: false });
}

export function openFormDialog(options) {
  return SwalTheme.fire({
    showCancelButton: true,
    reverseButtons: false,
    focusConfirm: false,
    ...options,
  });
}

export { SwalTheme };
