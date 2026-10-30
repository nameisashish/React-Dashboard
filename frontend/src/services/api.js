let token = sessionStorage.getItem('fines-token');
export const setToken = value => {
  token = value;
  if (value) sessionStorage.setItem('fines-token', value);
  else sessionStorage.removeItem('fines-token');
};
export async function api(path, options = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (response.ok && response.headers.get('content-type')?.includes('spreadsheetml')) return response.blob();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/signin') {
      setToken(null);
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || 'Request failed'));
  }
  return data;
}
