const BASE = import.meta.env.VITE_API_URL || '';

export const getToken = () => localStorage.getItem('wh_token');
export const setSession = (token, user) => { localStorage.setItem('wh_token', token); localStorage.setItem('wh_user', JSON.stringify(user)); };
export const clearSession = () => { localStorage.removeItem('wh_token'); localStorage.removeItem('wh_user'); };
export const getUser = () => { try { return JSON.parse(localStorage.getItem('wh_user')); } catch { return null; } };

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details || {}; }
}

export async function api(path, { method = 'GET', body, blob } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (blob && res.ok) return res.blob();
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && getToken()) { clearSession(); window.location.href = '/login'; }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

export async function downloadCsv(path, filename) {
  const blob = await api(path + (path.includes('?') ? '&' : '?') + 'format=csv', { blob: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
