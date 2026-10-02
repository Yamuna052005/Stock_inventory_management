class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Minimal schema validator. rules: { field: { type, required, min, max, enum, maxLen } }
function validate(body, rules) {
  const errors = {};
  const out = {};
  for (const [field, r] of Object.entries(rules)) {
    let v = body ? body[field] : undefined;
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (r.required) errors[field] = `${r.label || field} is required`;
      else out[field] = null;
      continue;
    }
    if (r.type === 'int' || r.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) { errors[field] = `${r.label || field} must be a number`; continue; }
      if (r.type === 'int' && !Number.isInteger(n)) { errors[field] = `${r.label || field} must be a whole number`; continue; }
      if (r.min !== undefined && n < r.min) { errors[field] = `${r.label || field} must be at least ${r.min}`; continue; }
      if (r.max !== undefined && n > r.max) { errors[field] = `${r.label || field} must be at most ${r.max}`; continue; }
      out[field] = n;
    } else {
      v = String(v);
      if (r.maxLen && v.length > r.maxLen) { errors[field] = `${r.label || field} is too long`; continue; }
      if (r.enum && !r.enum.includes(v)) { errors[field] = `${r.label || field} must be one of: ${r.enum.join(', ')}`; continue; }
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { errors[field] = `${r.label || field} must be a valid email`; continue; }
      out[field] = v;
    }
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}

const wrap = (fn) => (req, res, next) => {
  try { fn(req, res, next); } catch (e) { next(e); }
};

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

module.exports = { HttpError, validate, wrap, toCsv };
