import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import { Input, Select, Field } from '../components/Field';
import { Async, Badge, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { clean, intMin, numMin, required, money } from '../validators';

const blank = { sku: '', barcode: '', name: '', category: '', description: '', unit_price: '', reorder_level: '10', supplier_id: '' };

export default function Products() {
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const f = { search: params.get('search') || '', category: params.get('category') || '', stock: params.get('stock') || '', warehouse_id: params.get('warehouse_id') || '' };
  const setF = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  const products = useFetch(`/api/products${qs ? '?' + qs : ''}`, { pollMs: 10000 });
  const cats = useFetch('/api/products/categories');
  const warehouses = useFetch('/api/warehouses');
  const suppliers = useFetch('/api/suppliers');
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const manage = can('admin', 'manager');

  const archive = async (p) => {
    if (!window.confirm(`Archive "${p.name}"? Its stock history is kept.`)) return;
    try { await api(`/api/products/${p.id}`, { method: 'DELETE' }); toast('Product archived'); products.reload(); cats.reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const openDetail = async (p) => { try { setDetail(await api(`/api/products/${p.id}`)); } catch (e) { toast(e.message, 'error'); } };

  return (
    <>
      <div className="page-head"><h2>Products</h2>{manage && <button className="btn primary" onClick={() => setEditing({ ...blank })}>+ Add product</button>}</div>
      <div className="filters card">
        <input placeholder="Search name, SKU or barcode…" value={f.search} onChange={(e) => setF('search', e.target.value)} aria-label="Search" />
        <select value={f.category} onChange={(e) => setF('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>{(cats.data || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={f.stock} onChange={(e) => setF('stock', e.target.value)} aria-label="Stock level">
          <option value="">All stock levels</option><option value="ok">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
        <select value={f.warehouse_id} onChange={(e) => setF('warehouse_id', e.target.value)} aria-label="Warehouse">
          <option value="">All warehouses</option>{(warehouses.data || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {qs && <button className="btn ghost" onClick={() => setParams({})}>Clear</button>}
      </div>
      <div className="card table-card">
        <Async state={products} emptyWhen={(d) => !d || d.length === 0} empty={<Empty title="No products found" hint={qs ? 'Try clearing the filters.' : 'Add your first product to get started.'} />}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th className="num">Reorder</th><th>Status</th><th>Supplier</th><th /></tr></thead>
              <tbody>
                {(products.data || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td><button className="link" onClick={() => openDetail(p)}>{p.name}</button></td>
                    <td>{p.category}</td><td className="num">{money(p.unit_price)}</td>
                    <td className="num"><b>{p.total_stock}</b></td><td className="num">{p.reorder_level}</td>
                    <td><Badge status={p.status} /></td><td>{p.supplier_name || '—'}</td>
                    <td className="actions">{manage && (<><button className="btn sm" onClick={() => setEditing({ ...p, barcode: p.barcode || '', description: p.description || '', supplier_id: p.supplier_id || '' })}>Edit</button>
                      <button className="btn sm danger" onClick={() => archive(p)}>Archive</button></>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
      </div>
      {editing && <ProductForm initial={editing} suppliers={suppliers.data || []} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); products.reload(); cats.reload(); }} />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <p className="muted">{detail.sku} · {detail.category} {detail.barcode && `· barcode ${detail.barcode}`}</p>
          {detail.description && <p>{detail.description}</p>}
          <h4>Stock by warehouse location</h4>
          {detail.levels.length === 0 ? <Empty title="No stock in any warehouse" /> : (
            <table><thead><tr><th>Warehouse</th><th>Location</th><th className="num">Qty</th></tr></thead>
              <tbody>{detail.levels.map((l) => <tr key={l.warehouse_id}><td>{l.warehouse_name}</td><td>{l.location}</td><td className="num">{l.quantity}</td></tr>)}</tbody></table>
          )}
        </Modal>
      )}
    </>
  );
}

function ProductForm({ initial, suppliers, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = clean({
      sku: required(form.sku, 'SKU'), name: required(form.name, 'Name'), category: required(form.category, 'Category'),
      unit_price: numMin(form.unit_price, 0, 'Unit price'), reorder_level: intMin(form.reorder_level, 0, 'Reorder level'),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { ...form, supplier_id: form.supplier_id || null };
      if (initial.id) await api(`/api/products/${initial.id}`, { method: 'PUT', body });
      else await api('/api/products', { method: 'POST', body });
      toast(initial.id ? 'Product updated' : 'Product added');
      onSaved();
    } catch (err) {
      setErrors(err.details || {});
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={initial.id ? 'Edit product' : 'Add product'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form-grid">
        <Input label="SKU *" value={form.sku} onChange={set('sku')} error={errors.sku} />
        <Input label="Barcode" value={form.barcode} onChange={set('barcode')} error={errors.barcode} />
        <Input label="Name *" value={form.name} onChange={set('name')} error={errors.name} />
        <Input label="Category *" value={form.category} onChange={set('category')} error={errors.category} />
        <Input label="Unit price (₹) *" type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} error={errors.unit_price} />
        <Input label="Reorder level *" type="number" min="0" step="1" value={form.reorder_level} onChange={set('reorder_level')} error={errors.reorder_level} hint="Alert when stock falls to this level" />
        <Select label="Supplier" value={form.supplier_id} onChange={set('supplier_id')} error={errors.supplier_id}>
          <option value="">— None —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Field label="Description" error={errors.description}><textarea rows="2" value={form.description} onChange={set('description')} /></Field>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
