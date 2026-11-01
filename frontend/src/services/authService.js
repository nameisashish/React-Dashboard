import { api, setToken } from './api.js';
export const authService = {
  async signIn(email) {
    const result = await api('/auth/signin', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
    setToken(result.token);
    return result.user;
  },
  register: (fullName, email, requestedRole) => api('/auth/signup', { method: 'POST', body: JSON.stringify({ fullName, email: email.trim(), requestedRole }) }),
  requests: () => api('/users/requests'),
  decide: (id, decision, assignedRole = 'Viewer') => api(`/users/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, assignedRole }) }),
  me: () => api('/auth/me'),
  async logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { setToken(null); } },
};
