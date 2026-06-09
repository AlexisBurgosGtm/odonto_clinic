const MENU_ITEMS = [
  { path: '/dashboard',       label: 'Inicio',        icon: 'fa-solid fa-chart-line', roles: ['GERENTE'] },
  { path: '/agenda',          label: 'Agenda',        icon: 'fa-solid fa-calendar-days', roles: ['GERENTE', 'SECRETARIA', 'MEDICO'] },
  { path: '/pacientes',       label: 'Pacientes',     icon: 'fa-solid fa-users', roles: ['GERENTE', 'SECRETARIA', 'MEDICO'] },
  { path: '/tratamientos',    label: 'Tratamientos',  icon: 'fa-solid fa-tooth', roles: ['GERENTE', 'SECRETARIA'] },
  { path: '/empleados',       label: 'Empleados',     icon: 'fa-solid fa-user-doctor', roles: ['GERENTE'] },
  { path: '/empresas',        label: 'Empresas',      icon: 'fa-solid fa-building', roles: ['GERENTE'] },
  { path: '/configuraciones', label: 'Configuraciones', icon: 'fa-solid fa-gear', roles: ['GERENTE'] },
];

const ROLE_PATHS = {
  GERENTE: MENU_ITEMS.map((item) => item.path).concat(['/pacientes/:codpaciente/tratamientos']),
  SECRETARIA: ['/agenda', '/pacientes', '/tratamientos', '/pacientes/:codpaciente/tratamientos'],
  MEDICO: ['/agenda', '/pacientes', '/pacientes/:codpaciente/tratamientos'],
};

export function getMenuForRole(tipo) {
  const role = tipo || 'GERENTE';
  return MENU_ITEMS.filter((item) => item.roles.includes(role));
}

export function getDefaultRoute(tipo) {
  return tipo === 'GERENTE' ? '/dashboard' : '/agenda';
}

export function isRouteAllowed(tipo, path) {
  const role = tipo || 'GERENTE';
  const allowed = ROLE_PATHS[role] || ROLE_PATHS.GERENTE;

  if (allowed.some((pattern) => pattern.includes(':'))) {
    for (const pattern of allowed) {
      if (!pattern.includes(':')) continue;
      const regex = new RegExp(
        `^${pattern.replace(/:(\w+)/g, '([^/]+)')}$`
      );
      if (regex.test(path)) return true;
    }
  }

  const basePath = path.startsWith('/pacientes/') && path.includes('/tratamientos')
    ? '/pacientes/:codpaciente/tratamientos'
    : path.startsWith('/pacientes')
      ? '/pacientes'
      : path;

  return allowed.includes(basePath);
}
