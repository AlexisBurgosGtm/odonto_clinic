export function mountNuevoFab({ id, icon, title, onClick }) {
  removeNuevoFab();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = id;
  btn.className = 'btn btn-nuevo-fab';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = `<i class="${icon}"></i>`;
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);

  return btn;
}

export function removeNuevoFab() {
  document.querySelector('.btn-nuevo-fab')?.remove();
}
