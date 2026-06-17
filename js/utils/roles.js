const MENU_ITEMS = [

  { path: '/dashboard',       label: 'Inicio',        icon: 'fa-solid fa-chart-line', roles: ['GERENTE'] },

  { path: '/agenda',          label: 'Agenda',        icon: 'fa-solid fa-calendar-days', roles: ['GERENTE', 'SECRETARIA', 'MEDICO'] },

  { path: '/pacientes',       label: 'Pacientes',     icon: 'fa-solid fa-users', roles: ['GERENTE', 'SECRETARIA', 'MEDICO'] },

  { path: '/cumpleaneros',    label: 'Cumpleañeros',  icon: 'fa-solid fa-cake-candles', roles: ['GERENTE', 'SECRETARIA', 'MEDICO'] },

  { path: '/transacciones',   label: 'Transacciones', icon: 'fa-solid fa-money-bill-transfer', roles: ['GERENTE', 'SECRETARIA'] },

  { path: '/gastos',          label: 'Gastos',        icon: 'fa-solid fa-receipt', roles: ['GERENTE'] },

  { path: '/reportes',        label: 'Reportes',      icon: 'fa-solid fa-file-lines', roles: ['GERENTE'] },

  { path: '/tratamientos',    label: 'Tratamientos',  icon: 'fa-solid fa-tooth', roles: ['GERENTE', 'SECRETARIA'] },

  { path: '/empleados',       label: 'Empleados',     icon: 'fa-solid fa-user-doctor', roles: ['GERENTE'] },

  { path: '/empresas',        label: 'Empresas',      icon: 'fa-solid fa-building', roles: ['GERENTE'] },

  { path: '/configuraciones', label: 'Configuraciones', icon: 'fa-solid fa-gear', roles: ['GERENTE'] },

];



const PACIENTE_SUBROUTES = [

  '/pacientes/:codpaciente/tratamientos',

  '/pacientes/:codpaciente/estado-cuenta',

];



const ROLE_PATHS = {

  GERENTE: MENU_ITEMS.map((item) => item.path).concat(PACIENTE_SUBROUTES),

  SECRETARIA: ['/agenda', '/pacientes', '/cumpleaneros', '/transacciones', '/tratamientos', ...PACIENTE_SUBROUTES],

  MEDICO: ['/agenda', '/pacientes', '/cumpleaneros', '/pacientes/:codpaciente/tratamientos', '/pacientes/:codpaciente/estado-cuenta'],

};



function resolvePacienteSubPath(path) {

  if (!path.startsWith('/pacientes/')) return null;

  if (path.includes('/tratamientos')) return '/pacientes/:codpaciente/tratamientos';

  if (path.includes('/estado-cuenta')) return '/pacientes/:codpaciente/estado-cuenta';

  return null;

}



export function getMenuForRole(tipo) {

  const role = tipo || 'GERENTE';

  return MENU_ITEMS.filter((item) => item.roles.includes(role));

}



export function getDefaultRoute(tipo) {

  return tipo === 'GERENTE' ? '/dashboard' : '/agenda';

}



export function canManagePacientes(tipo) {
  return tipo === 'GERENTE' || tipo === 'SECRETARIA';
}

export function canAddPacienteTratamiento(tipo) {
  return tipo === 'MEDICO' || tipo === 'SECRETARIA';
}

export function showAgendaTratamientosBtn(tipo) {
  return canAddPacienteTratamiento(tipo);
}

export function isRouteAllowed(tipo, path) {

  const role = tipo || 'GERENTE';

  const allowed = ROLE_PATHS[role] || ROLE_PATHS.GERENTE;



  const subPath = resolvePacienteSubPath(path);

  if (subPath) {

    return allowed.includes(subPath);

  }



  if (allowed.some((pattern) => pattern.includes(':'))) {

    for (const pattern of allowed) {

      if (!pattern.includes(':')) continue;

      const regex = new RegExp(

        `^${pattern.replace(/:(\w+)/g, '([^/]+)')}$`

      );

      if (regex.test(path)) return true;

    }

  }



  const basePath = path.startsWith('/pacientes') ? '/pacientes' : path;



  return allowed.includes(basePath);

}


