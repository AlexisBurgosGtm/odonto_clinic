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
    create: (body) => request('/api/empresas', { method: 'POST', body: JSON.stringify(body) }),
    update: (empnit, body) =>
      request(`/api/empresas/${encodeURIComponent(empnit)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (empnit) =>
      request(`/api/empresas/${encodeURIComponent(empnit)}`, { method: 'DELETE' }),
  },

  empleados: {
    list: () => request('/api/empleados'),
    medicos: () => request('/api/empleados/medicos'),
    create: (body) => request('/api/empleados', { method: 'POST', body: JSON.stringify(body) }),
    update: (codemp, body) =>
      request(`/api/empleados/${codemp}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (codemp) => request(`/api/empleados/${codemp}`, { method: 'DELETE' }),
  },

  pacientes: {
    list: () => request('/api/pacientes'),
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
    stats: ({ empnit, fecha } = {}) => {
      const params = new URLSearchParams();
      if (empnit) params.set('empnit', empnit);
      if (fecha) params.set('fecha', fecha);
      const qs = params.toString();
      return request(`/api/dashboard/stats${qs ? `?${qs}` : ''}`);
    },
  },
};
