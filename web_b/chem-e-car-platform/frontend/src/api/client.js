import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const http = axios.create({ baseURL: API_URL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('chemcar_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('chemcar_token');
      localStorage.removeItem('chemcar_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }).then((r) => r.data),
  register: (payload) => http.post('/auth/register', payload).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
};

export const dashboardApi = {
  summary: () => http.get('/dashboard/summary').then((r) => r.data),
};

export const devicesApi = {
  list: () => http.get('/devices').then((r) => r.data),
  create: (payload) => http.post('/devices', payload).then((r) => r.data),
  update: (id, payload) => http.patch(`/devices/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/devices/${id}`).then((r) => r.data),
};

export const experimentsApi = {
  list: (params) => http.get('/experiments', { params }).then((r) => r.data),
  get: (id) => http.get(`/experiments/${id}`).then((r) => r.data),
  readings: (id) => http.get(`/experiments/${id}/readings`).then((r) => r.data),
  create: (payload) => http.post('/experiments', payload).then((r) => r.data),
  start: (id) => http.post(`/experiments/${id}/start`).then((r) => r.data),
  stop: (id) => http.post(`/experiments/${id}/stop`).then((r) => r.data),
  remove: (id) => http.delete(`/experiments/${id}`).then((r) => r.data),
};

export const reportsApi = {
  get: (experimentId) => http.get(`/reports/${experimentId}`).then((r) => r.data),
  compare: (ids) => http.get('/reports/compare/list', { params: { ids: ids.join(',') } }).then((r) => r.data),
};

export const alertsApi = {
  list: (params) => http.get('/alerts', { params }).then((r) => r.data),
  unreadCount: () => http.get('/alerts/unread-count').then((r) => r.data),
  markRead: (id) => http.patch(`/alerts/${id}/read`).then((r) => r.data),
  markAllRead: () => http.patch('/alerts/read-all').then((r) => r.data),
};

export const usersApi = {
  list: () => http.get('/users').then((r) => r.data),
  create: (payload) => http.post('/users', payload).then((r) => r.data),
  activate: (id) => http.patch(`/users/${id}/activate`).then((r) => r.data),
  deactivate: (id) => http.patch(`/users/${id}/deactivate`).then((r) => r.data),
  changeRole: (id, role) => http.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  remove: (id) => http.delete(`/users/${id}`).then((r) => r.data),
};

export const settingsApi = {
  get: () => http.get('/settings').then((r) => r.data),
  update: (payload) => http.patch('/settings', payload).then((r) => r.data),
};
