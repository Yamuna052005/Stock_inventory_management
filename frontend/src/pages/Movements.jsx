import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../hooks';
import { Input, Select, Field } from '../components/Field';
import { Async, Badge, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { clean, intMin, required, dt } from '../validators';

export default function Movements() {
  const { can } = useAuth();
  const toast = useToast();
  const products = useFetch('/api/products');
  const warehouses = useFetch('/api/warehouses');
  const [filters, setFilters] = useState({ type: '', product_id: '', warehouse_id: '' });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const history = useFetch(`/api/stock/movements${qs ? '?' + qs : ''}`, { pollMs: 8000 });
  const logs = useFetch('/api/stock/logs', { enabled: can('admin', 'manager') });
  const [tab, setTab] = useState('history');

  const [form, setForm] = useState({ type: 'IN', product_id: '', warehouse_id: '', quantity: '', reference: '', note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scanned, setScanned] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Barcode scanning simulation: type/paste a barcode or SKU and press Enter / Scan
  const scan = async () => {
    if (!barcode.trim()) return;
    try {
      const p = await api(`/api/products/barcode/${encodeURIComponent(barcode.trim())}`);
      setForm((f) => ({ ...f, product_id: String(p.id) }));
      setScanned(p);
      toast(`Scanned: ${p.name}`);
    } catch (e) { setScanned(null); toast(e.message, 'error'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ product_id: required(form.product_id, 'Product'), warehouse_id: required(form.warehouse_id, 'Warehouse'), quantity: intMin(form.quantity, 1, 'Quantity') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await api(`/api/stock/${form.type.toLowerCase()}`, { method: 'POST', body: form });
      toast(`Stock ${form.type} recorded. New balance in warehouse: ${r.balance_after}`);
      setForm({ ...form, quantity: '', reference: '', note: '' });
      setScanned(null); setBarcode('');
      history.reload(); products.reload(); logs.reload();
    } catch (err) {
      setErrors(err.details || {});
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head"><h2>Stock Movements</h2></div>
      <div className="grid2 top">
        <form className="card" onSubmit={submit} noValidate>
          <h3>Record stock transaction</h3>
          <div className="segmented">
            {['IN', 'OUT'].map((t) => <button type="button" key={t} className={form.type === t ? `on ${t}` : ''} onClick={() => setForm({ ...form, type: t })}>Stock {t}</button>)}
          </div>
          <Field label="Scan barcode / SKU (simulation)" hint="Try 8901000000011 or ELEC-002">
            <div className="row"><input value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), scan())} placeholder="Scan or type…" />
              <button type="button" className="btn" onClick={scan}>Scan</button></div>
          </Field>
          {scanned && <div className="alert info">Matched <b>{scanned.name}</b> — {scanned.total_stock} units on hand</div>}
          <Select label="Product *" value={form.product_id} onChange={set('product_id')} error={errors.product_id}>
            <option value="">Select product…</option>{(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.total_stock} on hand</option>)}
          </Select>
          <Select label="Warehouse *" value={form.warehouse_id} onChange={set('warehouse_id')} error={errors.warehouse_id}>
            <option value="">Select warehouse…</option>{(warehouses.data || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Input label="Quantity *" type="number" min="1" step="1" value={form.quantity} onChange={set('quantity')} error={errors.quantity} />
          <Input label="Reference" value={form.reference} onChange={set('reference')} error={errors.reference} placeholder="e.g. invoice / order no." />
          <Input label="Note" value={form.note} onChange={set('note')} error={errors.note} />
          <button className={`btn block ${form.type === 'IN' ? 'primary' : 'danger-solid'}`} disabled={busy}>{busy ? 'Saving…' : `Record stock ${form.type}`}</button>
        </form>

        <section className="card table-card">
          <div className="tabs">
            <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Movement history</button>
            {can('admin', 'manager') && <button className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>Audit log</button>}
          </div>
          {tab === 'history' ? (
            <>
              <div className="filters inline">
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} aria-label="Type"><option value="">IN & OUT</option><option>IN</option><option>OUT</option></select>
                <select value={filters.product_id} onChange={(e) => setFilters({ ...filters, product_id: e.target.value })} aria-label="Product"><option value="">All products</option>{(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select value={filters.warehouse_id} onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })} aria-label="Warehouse"><option value="">All warehouses</option>{(warehouses.data || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </div>
              <Async state={history} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No movements found" hint="Record a stock IN or OUT to see it here." />}>
                <div className="table-wrap"><table>
                  <thead><tr><th>Date</th><th>Product</th><th>Warehouse</th><th>Type</th><th className="num">Qty</th><th className="num">Balance</th><th>Ref</th><th>By</th></tr></thead>
                  <tbody>{(history.data || []).map((m) => (
                    <tr key={m.id}><td>{dt(m.created_at)}</td><td>{m.product_name}</td><td>{m.warehouse_name}</td><td><Badge status={m.type} /></td>
                      <td className="num">{m.quantity}</td><td className="num">{m.balance_after}</td><td>{m.reference || '—'}</td><td>{m.user_name || '—'}</td></tr>
                  ))}</tbody></table></div>
              </Async>
            </>
          ) : (
            <Async state={logs} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No audit entries" />}>
              <div className="table-wrap"><table>
                <thead><tr><th>Date</th><th>Entity</th><th>Action</th><th>User</th><th>Details</th></tr></thead>
                <tbody>{(logs.data || []).map((l) => (
                  <tr key={l.id}><td>{dt(l.created_at)}</td><td>{l.entity} #{l.entity_id}</td><td><span className="badge gray">{l.action}</span></td><td>{l.user_name || '—'}</td><td className="mono">{l.details ? l.details.slice(0, 80) : ''}</td></tr>
                ))}</tbody></table></div>
            </Async>
          )}
        </section>
      </div>
    </>
  );
}
