import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import { Input } from '../components/Field';
import { Async, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { clean, intMin, required } from '../validators';

export default function Warehouses() {
  const { can } = useAuth();
  const toast = useToast();
  const wh = useFetch('/api/warehouses', { pollMs: 10000 });
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState(null);
  const stock = useFetch(view ? `/api/warehouses/${view.id}/stock` : null, { enabled: !!view });

  return (
    <>
      <div className="page-head"><h2>Warehouse Overview</h2>{can('admin') && <button className="btn primary" onClick={() => setEditing({ name: '', location: '', capacity: '' })}>+ Add warehouse</button>}</div>
      <Async state={wh} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No warehouses" hint="Add a warehouse location to track stock." />}>
        <div className="cards">
          {(wh.data || []).map((w) => (
            <div className="card wh-card" key={w.id}>
              <h3>🏭 {w.name}</h3>
              <p className="muted">📍 {w.location}</p>
              <div className="meter"><div className={w.utilization > 85 ? 'hot' : ''} style={{ width: `${Math.min(100, w.utilization)}%` }} /></div>
              <p><b>{w.total_units.toLocaleString()}</b> / {w.capacity.toLocaleString()} units · {w.utilization}% used · {w.product_count} products</p>
              <div className="row">
                <button className="btn sm" onClick={() => setView(w)}>View stock</button>
                {can('admin') && <button className="btn sm" onClick={() => setEditing({ ...w })}>Edit</button>}
              </div>
            </div>
          ))}
        </div>
      </Async>
      {editing && <WarehouseForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); wh.reload(); }} />}
      {view && (
        <Modal title={`${view.name} — stock`} onClose={() => setView(null)}>
          <Async state={stock} emptyWhen={(d) => !d || !d.length} empty={<Empty title="This warehouse is empty" />}>
            <table><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th className="num">Qty</th></tr></thead>
              <tbody>{(stock.data || []).map((s) => <tr key={s.product_id}><td>{s.sku}</td><td>{s.name}</td><td>{s.category}</td><td className="num">{s.quantity}</td></tr>)}</tbody></table>
          </Async>
        </Modal>
      )}
    </>
  );
}

function WarehouseForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ name: required(form.name, 'Name'), location: required(form.location, 'Location'), capacity: intMin(form.capacity, 0, 'Capacity') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (initial.id) await api(`/api/warehouses/${initial.id}`, { method: 'PUT', body: form }); else await api('/api/warehouses', { method: 'POST', body: form });
      toast('Warehouse saved'); onSaved();
    } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial.id ? 'Edit warehouse' : 'Add warehouse'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form-grid">
        <Input label="Name *" value={form.name} onChange={set('name')} error={errors.name} />
        <Input label="Location *" value={form.location} onChange={set('location')} error={errors.location} />
        <Input label="Capacity (units) *" type="number" min="0" step="1" value={form.capacity} onChange={set('capacity')} error={errors.capacity} />
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
