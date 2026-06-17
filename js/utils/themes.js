const THEME_STORAGE_KEY = 'dental-state-theme';

export const THEMES = [
  { id: 'default', label: 'Clínica', hint: 'Predeterminado', icon: 'fa-tooth', color: '#0ea5e9' },
  { id: 'verano', label: 'Verano', hint: 'Sol y calor', icon: 'fa-sun', color: '#f59e0b' },
  { id: 'invierno', label: 'Invierno', hint: 'Frío y nieve', icon: 'fa-snowflake', color: '#38bdf8' },
  { id: 'otono', label: 'Otoño', hint: 'Hojas y tierra', icon: 'fa-leaf', color: '#d97706' },
  { id: 'primavera', label: 'Primavera', hint: 'Flores y vida', icon: 'fa-seedling', color: '#22c55e' },
  { id: 'naturaleza', label: 'Naturaleza', hint: 'Bosque y calma', icon: 'fa-tree', color: '#15803d' },
  { id: 'cariño', label: 'Día del cariño', hint: 'Amor y cariño', icon: 'fa-heart', color: '#e11d48' },
];

const THEME_META_COLORS = {
  default: '#0ea5e9',
  verano: '#f59e0b',
  invierno: '#38bdf8',
  otono: '#d97706',
  primavera: '#22c55e',
  naturaleza: '#15803d',
  cariño: '#e11d48',
};

let themeMenuOpen = false;
let outsideClickBound = false;

function updateThemeMetaColor(themeId) {
  const color = THEME_META_COLORS[themeId] || THEME_META_COLORS.default;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

function updateActiveThemeOptions(themeId) {
  document.querySelectorAll('[data-theme-option]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeOption === themeId);
  });
}

export function applyTheme(themeId = 'default') {
  const id = THEMES.some((theme) => theme.id === themeId) ? themeId : 'default';

  if (id === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }

  localStorage.setItem(THEME_STORAGE_KEY, id);
  updateThemeMetaColor(id);
  updateActiveThemeOptions(id);
}

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.some((theme) => theme.id === stored) ? stored : 'default';
}

function closeThemeMenu() {
  themeMenuOpen = false;
  document.getElementById('themeSelectorMenu')?.classList.remove('open');
}

function toggleThemeMenu() {
  themeMenuOpen = !themeMenuOpen;
  document.getElementById('themeSelectorMenu')?.classList.toggle('open', themeMenuOpen);
}

function bindOutsideClick() {
  if (outsideClickBound) return;
  outsideClickBound = true;

  document.addEventListener('click', (e) => {
    const root = document.getElementById('themeSelector');
    if (!root || root.contains(e.target)) return;
    closeThemeMenu();
  });
}

function renderThemeMenuItems() {
  const current = getStoredTheme();

  return THEMES.map((theme) => `
    <button
      type="button"
      class="theme-option${current === theme.id ? ' active' : ''}"
      data-theme-option="${theme.id}"
      title="${theme.hint}"
    >
      <span class="theme-option-swatch" style="background:${theme.color}"></span>
      <span class="theme-option-text">
        <span class="theme-option-label">${theme.label}</span>
        <span class="theme-option-hint">${theme.hint}</span>
      </span>
      <i class="fa-solid ${theme.icon} theme-option-icon"></i>
    </button>
  `).join('');
}

export function unmountThemeSelector() {
  document.getElementById('themeSelector')?.remove();
}

export function mountThemeSelector(container = document.getElementById('themeSelectorMount')) {
  if (!container) return;

  unmountThemeSelector();

  const root = document.createElement('div');
  root.id = 'themeSelector';
  root.className = 'theme-selector';
  root.innerHTML = `
    <button type="button" class="btn-theme-toggle" id="btnThemeToggle" title="Cambiar tema" aria-label="Cambiar tema">
      <i class="fa-solid fa-palette"></i>
    </button>
    <div class="theme-selector-menu" id="themeSelectorMenu">
      <p class="theme-selector-title">Tema visual</p>
      ${renderThemeMenuItems()}
    </div>
  `;

  container.appendChild(root);

  document.getElementById('btnThemeToggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleThemeMenu();
  });

  root.querySelectorAll('[data-theme-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeOption);
      closeThemeMenu();
    });
  });

  bindOutsideClick();
}

export function initThemeSystem() {
  applyTheme(getStoredTheme());
}
