import { Link, useOutletContext } from 'react-router-dom';
import { Async, Badge, Empty } from '../components/States';
import { dt, money } from '../validators';

function Stat({ label, value, tone, to }) {
  const body = <div className={`stat ${tone || ''}`}><span>{label}</span><strong>{value}</strong></div>;
  return to ? <Link to={to} className="stat-link">{body}</Link> : body;
}

export default function Dashboard() {
  const { summary } = useOutletContext();
  const s = summary.data;
  return (
    <>
      <div className="page-head"><h2>Inventory Dashboard</h2>{s && <span className="muted">Updated {new Date(s.generatedAt).toLocaleTimeString()}</span>}</div>
      <Async state={summary}>
        {s && (
          <>
            <div className="stats">
              <Stat label="Total units in stock" value={s.totalUnits.toLocaleString()} />
              <Stat label="Active products" value={s.totalProducts} to="/products" />
              <Stat label="Inventory value" value={money(s.totalValue)} />
              <Stat label="Low stock alerts" value={s.lowStockCount} tone="amber" to="/products?stock=low" />
              <Stat label="Out of stock" value={s.outOfStockCount} tone="red" to="/products?stock=out" />
              <Stat label="Pending POs" value={s.pendingPurchaseOrders} to="/suppliers" />
            </div>
            <div className="grid2">
              <section className="card">
                <h3>⚠️ Low-stock alerts</h3>
                {s.lowStock.length === 0 ? <Empty title="All products are well stocked" /> : (
                  <table><thead><tr><th>Product</th><th>SKU</th><th className="num">Stock</th><th className="num">Reorder at</th></tr></thead>
                    <tbody>{s.lowStock.map((p) => (
                      <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td>
                        <td className="num"><Badge status={p.total_stock === 0 ? 'out' : 'low'} /> {p.total_stock}</td><td className="num">{p.reorder_level}</td></tr>
                    ))}</tbody></table>
                )}
              </section>
              <section className="card">
                <h3>Movements — last 7 days</h3>
                {s.movementsByDay.length === 0 ? <Empty title="No movements yet" /> : <DayChart rows={s.movementsByDay} />}
              </section>
              <section className="card">
                <h3>Recent stock movements</h3>
                {s.recentMovements.length === 0 ? <Empty title="No movements yet" /> : (
                  <table><thead><tr><th>When</th><th>Product</th><th>Type</th><th className="num">Qty</th><th>Warehouse</th></tr></thead>
                    <tbody>{s.recentMovements.map((m) => (
                      <tr key={m.id}><td>{dt(m.created_at)}</td><td>{m.product_name}</td><td><Badge status={m.type} /></td><td className="num">{m.quantity}</td><td>{m.warehouse_name}</td></tr>
                    ))}</tbody></table>
                )}
              </section>
              <section className="card">
                <h3>Stock by category</h3>
                {s.stockByCategory.length === 0 ? <Empty title="No products yet" /> : <CategoryBars rows={s.stockByCategory} />}
              </section>
            </div>
          </>
        )}
      </Async>
    </>
  );
}

function DayChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.stock_in, r.stock_out]));
  return (
    <div className="daychart">
      {rows.map((r) => (
        <div key={r.day} className="daycol" title={`${r.day}: +${r.stock_in} / -${r.stock_out}`}>
          <div className="bars">
            <div className="bar in" style={{ height: `${(r.stock_in / max) * 100}%` }} />
            <div className="bar out" style={{ height: `${(r.stock_out / max) * 100}%` }} />
          </div>
          <small>{r.day.slice(5)}</small>
        </div>
      ))}
      <div className="legend"><i className="in" /> Stock IN <i className="out" /> Stock OUT</div>
    </div>
  );
}

function CategoryBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.units));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.category} className="hbar">
          <span>{r.category}</span>
          <div className="track"><div style={{ width: `${(r.units / max) * 100}%` }} /></div>
          <b>{r.units}</b>
        </div>
      ))}
    </div>
  );
}
