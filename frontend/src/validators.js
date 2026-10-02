// Frontend validation mirrors the backend rules (backend remains the source of truth).
export const required = (v, label) => (String(v ?? '').trim() ? '' : `${label} is required`);
export const intMin = (v, min, label) => {
  if (String(v ?? '').trim() === '') return `${label} is required`;
  const n = Number(v);
  if (!Number.isInteger(n)) return `${label} must be a whole number`;
  return n < min ? `${label} must be at least ${min}` : '';
};
export const numMin = (v, min, label) => {
  if (String(v ?? '').trim() === '') return `${label} is required`;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  return n < min ? `${label} must be at least ${min}` : '';
};
export const email = (v, label = 'Email') => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `${label} must be a valid email` : '');
export const clean = (errs) => Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
export const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const dt = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '—');
