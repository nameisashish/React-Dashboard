import { api } from './api.js';
export const finesService = {
  list(filters = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'reasons') { if (value?.length) query.set('reason', value[0]); }
      else if (value) query.set(key, value);
    }
    return api(`/fines?${query}`);
  },
  refresh: () => api('/fines'),
  createRequest: request => api('/fines', { method: 'POST', body: JSON.stringify(request) }),
  reviews: id => api(`/fines/${id}/reviews`),
  review: (id, request) => api(`/fines/${id}/reviews`, { method: 'POST', body: JSON.stringify(request) }),
  export: ids => api('/exports/fines', { method: 'POST', body: JSON.stringify({ ids }) }),
  summary: () => api('/dashboard'),
  import(file, commit = false) {
    const body = new FormData(); body.append('file', file);
    return api(`/imports/validate?commit=${commit}`, { method: 'POST', body });
  },
};
