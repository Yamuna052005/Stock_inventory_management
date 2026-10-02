import { useState } from 'react';
import { downloadCsv } from '../api';
import { useFetch } from '../hooks';
import { Async, Empty } from '../components/States';
import { useToast } from '../components/Toast';
import { dt, money } from '../validators';

const TABS = {
  inventory: { label: 'Inventory valuation', path: '/api/reports/inventory', file: 'inventory-report.csv' },
  movements: { label: 'Stock movements', path: '/api/reports/movements', file: 'movements-report.csv' },
  restock: { label: 'Predictive restocking', path: '/api/reports/restock', file: 'restock-suggestions.csv' },
};

export default function Reports() {
  const [tab, setTab] = useState('inventory');
  const [range, setRange] = useState({ from: '', to: '' });
  const toast = useToast();
  const t = TABS[tab];
  const q = tab === 'movements' ? new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString() : '';
  const path = t.path + (q ? '?' + q : '');
  const report = useFetch(path);

  const download = async () => { try { await downloadCsv(path, t.file); toast('Report downloaded'); } catch (e) { toast(e.message, 'error'); } };
  const rows = report.data || [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const fmt = (c, v) => (v === null || v === undefined ? '—' : c === 'date' ? dt(v) : /value|price/.test(c) ? money(v) : v);

  return (
    <>
      <div className="page-head"><h2>Reports</h2><button className="btn primary" onClick={download} disabled={!rows.length}>⬇ Download CSV</button></div>
      <div className="tabs standalone">{Object.entries(TABS).map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v.label}</button>)}</div>
      {tab === 'movements' && (
        <div className="filters card inline">
          <label>From <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
      )}
      {tab === 'restock' && <p className="muted note">Suggested quantity = 14 days of average daily outflow (last 30 days) + reorder level − current stock.</p>}
      <div className="card table-card">
        <Async state={report} emptyWhen={(d) => !d || !d.length} empty={<Empty title="Nothing to report" hint={tab === 'restock' ? 'No products currently need restocking.' : 'No data for this selection.'} />}>
          <div className="table-wrap"><table>
            <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={typeof r[c] === 'number' ? 'num' : ''}>{fmt(c, r[c])}</td>)}</tr>)}</tbody>
          </table></div>
        </Async>
      </div>
    </>
  );
}
