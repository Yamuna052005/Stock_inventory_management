import { useState } from 'react';
import { useAuth } from '../auth';
import { Input } from '../components/Field';
import { email as emailRule, required, clean } from '../validators';

const demo = [['Admin', 'admin@warehouse.com', 'admin123'], ['Manager', 'manager@warehouse.com', 'manager123'], ['Staff', 'staff@warehouse.com', 'staff123']];

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ email: required(form.email, 'Email') || emailRule(form.email), password: required(form.password, 'Password') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerError('');
    try { await login(form.email, form.password); } catch (err) { setServerError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit} noValidate>
        <div className="login-logo">📦</div>
        <h1>Smart Inventory & Warehouse</h1>
        <p className="muted">Sign in to continue</p>
        <Input label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="username" />
        <Input label="Password" type="password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        {serverError && <div className="alert error">{serverError}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="demo">
          <span className="muted">Demo accounts (click to fill):</span>
          <div className="demo-btns">
            {demo.map(([r, e, p]) => <button type="button" key={r} className="chip" onClick={() => setForm({ email: e, password: p })}>{r}</button>)}
          </div>
        </div>
      </form>
    </div>
  );
}
