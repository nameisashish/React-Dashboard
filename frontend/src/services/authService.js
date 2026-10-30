import { api, setToken } from './api.js';
export const authService = {
  async signIn(email, password, requestedRole) {
    const result = await api('/auth/signin', { method: 'POST', body: JSON.stringify({ email: email.trim(), password, requestedRole }) });
    setToken(result.token);
    return result.user;
  },
  register: (fullName, email, password, requestedRole) => api('/auth/signup', { method: 'POST', body: JSON.stringify({ fullName, email: email.trim(), password, requestedRole }) }),
  requests: () => api('/users/requests'),
  decide: (id, decision, assignedRole = 'Viewer') => api(`/users/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, assignedRole }) }),
  me: () => api('/auth/me'),
  async logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { setToken(null); } },
};
