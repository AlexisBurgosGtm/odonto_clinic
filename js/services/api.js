import { getEmpnit } from './session.js';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const empnit = getEmpnit();
  if (empnit) {
    headers['X-EMPNIT'] = empnit;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

export const api = {
  login: (usuario, clave) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario, clave }),
    }),

  empresas: {
    list: () => request('/api/empresas'),
    get: (empnit) => request(`/api/empresas/${encodeURIComponent(empnit)}`),
    getLogo: (empnit) => request(`/api/empresas/${encodeURIComponent(empnit)}/logo`),
    create: (body) => request('/api/empresas', { method: 'POST', body: JSON.stringify(body) }),
    update: (empnit, body) =>
      request(`/api/empresas/${encodeURIComponent(empnit)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updateLogo: (empnit, LOGO) =>
      request(`/api/empresas/${encodeURIComponent(empnit)}/logo`, {
        method: 'PUT',
        body: JSON.stringify({ LOGO }),
      }),
    delete: (empnit) =>
      request(`/api/empresas/${encodeURIComponent(empnit)}`, { method: 'DELETE' }),
  },

  empleados: {
    list: ({ empnit } = {}) => {
      const params = new URLSearchParams();
      if (empnit) params.set('empnit', empnit);
      const qs = params.toString();
      return request(`/api/empleados${qs ? `?${qs}` : ''}`);
    },
    medicos: () => request('/api/empleados/medicos'),
    create: (body) => request('/api/empleados', { method: 'POST', body: JSON.stringify(body) }),
    update: (codemp, body, { empnit } = {}) => {
      const params = new URLSearchParams();
      if (empnit) params.set('empnit', empnit);
      const qs = params.toString();
      return request(`/api/empleados/${codemp}${qs ? `?${qs}` : ''}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    delete: (codemp, { empnit } = {}) => {
      const params = new URLSearchParams();
      if (empnit) params.set('empnit', empnit);
      const qs = params.toString();
      return request(`/api/empleados/${codemp}${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
    },
  },

  pacientes: {
    list: () => request('/api/pacientes'),
    cumpleanos: (fecha) => {
      const params = new URLSearchParams();
      if (fecha) params.set('fecha', fecha);
      const qs = params.toString();
      return request(`/api/pacientes/cumpleanos${qs ? `?${qs}` : ''}`);
    },
    get: (codpaciente) => request(`/api/pacientes/${codpaciente}`),
    create: (body) => request('/api/pacientes', { method: 'POST', body: JSON.stringify(body) }),
    update: (codpaciente, body) =>
      request(`/api/pacientes/${codpaciente}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (codpaciente) => request(`/api/pacientes/${codpaciente}`, { method: 'DELETE' }),
  },

  agenda: {
    list: (start, end) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const qs = params.toString();
      return request(`/api/agenda${qs ? `?${qs}` : ''}`);
    },
    proximaCita: (codpaciente, { desde } = {}) => {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      const qs = params.toString();
      return request(`/api/agenda/paciente/${codpaciente}/proxima${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/api/agenda', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/agenda/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/agenda/${id}`, { method: 'DELETE' }),
  },

  productos: {
    list: () => request('/api/productos'),
    create: (body) => request('/api/productos', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/productos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/productos/${id}`, { method: 'DELETE' }),
  },

  piezas: {
    list: () => request('/api/piezas'),
  },

  transacciones: {
    list: ({ fechaInicio, fechaFin } = {}) => {
      const params = new URLSearchParams();
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      const qs = params.toString();
      return request(`/api/transacciones${qs ? `?${qs}` : ''}`);
    },
    estadoCuenta: (codpaciente) =>
      request(`/api/transacciones/paciente/${codpaciente}`),
    create: (body) =>
      request('/api/transacciones', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/transacciones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/transacciones/${id}`, { method: 'DELETE' }),
  },

  orders: {
    listByPaciente: (codpaciente) => request(`/api/orders/paciente/${codpaciente}`),
    create: (body) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    finalizar: (id, body) =>
      request(`/api/orders/${id}/finalizar`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),
  },

  dashboard: {
    stats: ({ empnit, fechaInicio, fechaFin } = {}) => {
      const params = new URLSearchParams();
      if (empnit) params.set('empnit', empnit);
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      const qs = params.toString();
      return request(`/api/dashboard/stats${qs ? `?${qs}` : ''}`);
    },
  },

  reportes: {
    get: ({ mes, anio, tipo } = {}) => {
      const params = new URLSearchParams();
      if (mes) params.set('mes', mes);
      if (anio) params.set('anio', anio);
      if (tipo) params.set('tipo', tipo);
      const qs = params.toString();
      return request(`/api/reportes${qs ? `?${qs}` : ''}`);
    },
  },

  config: {
    get: (tipo) => request(`/api/config/${encodeURIComponent(tipo)}`),
    update: (tipo, body) =>
      request(`/api/config/${encodeURIComponent(tipo)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  gastos: {
    list: ({ mes, anio } = {}) => {
      const params = new URLSearchParams();
      if (mes) params.set('mes', mes);
      if (anio) params.set('anio', anio);
      const qs = params.toString();
      return request(`/api/gastos${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/api/gastos', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/gastos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/gastos/${id}`, { method: 'DELETE' }),
  },

  gastosTipos: {
    list: () => request('/api/gastos-tipos'),
    create: (body) => request('/api/gastos-tipos', { method: 'POST', body: JSON.stringify(body) }),
    update: (codtipo, body) =>
      request(`/api/gastos-tipos/${codtipo}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (codtipo) => request(`/api/gastos-tipos/${codtipo}`, { method: 'DELETE' }),
  },
};
