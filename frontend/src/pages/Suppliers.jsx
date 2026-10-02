import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import { Input, Select, Field } from '../components/Field';
import { Async, Badge, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { clean, email as emailRule, intMin, numMin, required, money, dt } from '../validators';

export default function Suppliers() {
  const { can } = useAuth();
  const manage = can('admin', 'manager');
  const suppliers = useFetch('/api/suppliers');
  const pos = useFetch('/api/purchase-orders', { pollMs: 10000 });
  const [tab, setTab] = useState('suppliers');
  const [editing, setEditing] = useState(null);
  const [creatingPO, setCreatingPO] = useState(false);
  const toast = useToast();

  const remove = async (s) => {
    if (!window.confirm(`Delete supplier "${s.name}"?`)) return;
    try { await api(`/api/suppliers/${s.id}`, { method: 'DELETE' }); toast('Supplier deleted'); suppliers.reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const poAction = async (po, action) => {
    try { await api(`/api/purchase-orders/${po.id}/${action}`, { method: 'POST' }); toast(action === 'receive' ? `${po.po_number} received — stock updated` : `${po.po_number} cancelled`); pos.reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <div className="page-head"><h2>Suppliers & Purchase Orders</h2>
        {manage && (tab === 'suppliers'
          ? <button className="btn primary" onClick={() => setEditing({ name: '', email: '', phone: '', address: '' })}>+ Add supplier</button>
          : <button className="btn primary" onClick={() => setCreatingPO(true)}>+ New purchase order</button>)}
      </div>
      <div className="tabs standalone">
        <button className={tab === 'suppliers' ? 'on' : ''} onClick={() => setTab('suppliers')}>Suppliers</button>
        <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>Purchase orders</button>
      </div>
      {tab === 'suppliers' ? (
        <div className="card table-card">
          <Async state={suppliers} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No suppliers yet" hint="Add a supplier to start creating purchase orders." />}>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th className="num">Products</th><th /></tr></thead>
              <tbody>{(suppliers.data || []).map((s) => (
                <tr key={s.id}><td><b>{s.name}</b></td><td>{s.email || '—'}</td><td>{s.phone || '—'}</td><td>{s.address || '—'}</td><td className="num">{s.product_count}</td>
                  <td className="actions">{manage && <><button className="btn sm" onClick={() => setEditing({ ...s, email: s.email || '', phone: s.phone || '', address: s.address || '' })}>Edit</button><button className="btn sm danger" onClick={() => remove(s)}>Delete</button></>}</td></tr>
              ))}</tbody></table></div>
          </Async>
        </div>
      ) : (
        <div className="card table-card">
          <Async state={pos} emptyWhen={(d) => !d || !d.length} empty={<Empty title="No purchase orders" hint="Create one to restock your warehouses." />}>
            <div className="table-wrap"><table>
              <thead><tr><th>PO #</th><th>Supplier</th><th>Warehouse</th><th>Items</th><th className="num">Total</th><th>Status</th><th>Created</th><th /></tr></thead>
              <tbody>{(pos.data || []).map((po) => (
                <tr key={po.id}><td><b>{po.po_number}</b></td><td>{po.supplier_name}</td><td>{po.warehouse_name}</td>
                  <td>{po.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}</td><td className="num">{money(po.total)}</td>
                  <td><Badge status={po.status} /></td><td>{dt(po.created_at)}</td>
                  <td className="actions">{manage && po.status === 'PENDING' && <><button className="btn sm primary" onClick={() => poAction(po, 'receive')}>Receive</button><button className="btn sm danger" onClick={() => poAction(po, 'cancel')}>Cancel</button></>}</td></tr>
              ))}</tbody></table></div>
          </Async>
        </div>
      )}
      {editing && <SupplierForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); suppliers.reload(); }} />}
      {creatingPO && <POForm suppliers={suppliers.data || []} onClose={() => setCreatingPO(false)} onSaved={() => { setCreatingPO(false); pos.reload(); setTab('pos'); }} />}
    </>
  );
}

function SupplierForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ name: required(form.name, 'Name'), email: emailRule(form.email) });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (initial.id) await api(`/api/suppliers/${initial.id}`, { method: 'PUT', body: form }); else await api('/api/suppliers', { method: 'POST', body: form });
      toast(initial.id ? 'Supplier updated' : 'Supplier added'); onSaved();
    } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial.id ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form-grid">
        <Input label="Name *" value={form.name} onChange={set('name')} error={errors.name} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Input label="Address" value={form.address} onChange={set('address')} error={errors.address} />
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

function POForm({ suppliers, onClose, onSaved }) {
  const toast = useToast();
  const products = useFetch('/api/products');
  const warehouses = useFetch('/api/warehouses');
  const [head, setHead] = useState({ supplier_id: '', warehouse_id: '' });
  const [items, setItems] = useState([{ product_id: '', quantity: '', unit_cost: '' }]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const setItem = (i, k, v) => setItems(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({ supplier_id: required(head.supplier_id, 'Supplier'), warehouse_id: required(head.warehouse_id, 'Warehouse') });
    items.forEach((it, i) => {
      const m = required(it.product_id, 'Product') || intMin(it.quantity, 1, 'Quantity') || numMin(it.unit_cost, 0, 'Unit cost');
      if (m && !errs.items) errs.items = `Item ${i + 1}: ${m}`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { const po = await api('/api/purchase-orders', { method: 'POST', body: { ...head, items } }); toast(`${po.po_number} created`); onSaved(); }
    catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title="New purchase order" onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="form-grid two">
          <Select label="Supplier *" value={head.supplier_id} onChange={(e) => setHead({ ...head, supplier_id: e.target.value })} error={errors.supplier_id}>
            <option value="">Select…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select label="Deliver to warehouse *" value={head.warehouse_id} onChange={(e) => setHead({ ...head, warehouse_id: e.target.value })} error={errors.warehouse_id}>
            <option value="">Select…</option>{(warehouses.data || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
        </div>
        <Field label="Items *" error={errors.items}>
          <div className="po-items">
            {items.map((it, i) => (
              <div className="po-row" key={i}>
                <select value={it.product_id} onChange={(e) => setItem(i, 'product_id', e.target.value)} aria-label="Product"><option value="">Product…</option>{(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input type="number" min="1" step="1" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} aria-label="Quantity" />
                <input type="number" min="0" step="0.01" placeholder="Unit cost" value={it.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} aria-label="Unit cost" />
                <button type="button" className="icon-btn" disabled={items.length === 1} onClick={() => setItems(items.filter((_, x) => x !== i))} aria-label="Remove item">✕</button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setItems([...items, { product_id: '', quantity: '', unit_cost: '' }])}>+ Add item</button>
          </div>
        </Field>
        <div className="form-actions"><b className="grow">Total: {money(total)}</b><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create PO'}</button></div>
      </form>
    </Modal>
  );
}
