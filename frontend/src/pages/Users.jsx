import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import { Input, Select } from '../components/Field';
import { Async, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { clean, email as emailRule, required, dt } from '../validators';

export default function Users() {
  const users = useFetch('/api/auth/users');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ name: required(form.name, 'Name'), email: required(form.email, 'Email') || emailRule(form.email),
      password: required(form.password, 'Password') || (form.password.length < 6 ? 'Password must be at least 6 characters' : '') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try { await api('/api/auth/users', { method: 'POST', body: form }); toast('User created'); setOpen(false); setForm({ name: '', email: '', password: '', role: 'staff' }); users.reload(); }
    catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); }
  };

  return (
    <>
      <div className="page-head"><h2>Users & Roles</h2><button className="btn primary" onClick={() => setOpen(true)}>+ Add user</button></div>
      <div className="card table-card">
        <Async state={users} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No users" />}>
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>{(users.data || []).map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge gray">{u.role}</span></td><td>{dt(u.created_at)}</td></tr>)}</tbody></table></div>
        </Async>
      </div>
      {open && (
        <Modal title="Add user" onClose={() => setOpen(false)}>
          <form onSubmit={submit} noValidate className="form-grid">
            <Input label="Name *" value={form.name} onChange={set('name')} error={errors.name} />
            <Input label="Email *" type="email" value={form.email} onChange={set('email')} error={errors.email} />
            <Input label="Password *" type="password" value={form.password} onChange={set('password')} error={errors.password} />
            <Select label="Role *" value={form.role} onChange={set('role')} error={errors.role}><option value="staff">Staff</option><option value="manager">Warehouse Manager</option><option value="admin">Admin</option></Select>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary">Create user</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
