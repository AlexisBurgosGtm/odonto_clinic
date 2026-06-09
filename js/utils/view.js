let activeViewGeneration = 0;

export function bumpViewGeneration() {
  activeViewGeneration += 1;
  return activeViewGeneration;
}

export function getActiveViewGeneration() {
  return activeViewGeneration;
}

export function isViewCurrent(generation) {
  return generation === activeViewGeneration;
}

export function isViewMounted(generation) {
  if (!isViewCurrent(generation)) return false;
  const el = document.getElementById('viewContainer')?.firstElementChild;
  return el?.dataset.viewGen === String(generation);
}
