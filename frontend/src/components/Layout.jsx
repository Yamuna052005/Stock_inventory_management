import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useFetch } from '../hooks';
import { useToast } from './Toast';

const links = [
  ['/', 'Dashboard', '📊'],
  ['/products', 'Products', '📦'],
  ['/movements', 'Stock Movements', '🔄'],
  ['/suppliers', 'Suppliers & POs', '🚚'],
  ['/warehouses', 'Warehouses', '🏭'],
  ['/reports', 'Reports', '📑', ['admin', 'manager']],
  ['/users', 'Users', '👥', ['admin']],
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const summary = useFetch('/api/dashboard/summary', { pollMs: 10000 });
  const prev = useRef(null);

  // Low-stock alert notifications: toast whenever the count of at-risk items grows
  useEffect(() => {
    if (!summary.data) return;
    const n = summary.data.lowStockCount + summary.data.outOfStockCount;
    if (prev.current !== null && n > prev.current) toast(`⚠️ ${n - prev.current} more product(s) are now low on stock`, 'warn');
    prev.current = n;
  }, [summary.data, toast]);

  const alerts = summary.data ? summary.data.lowStockCount + summary.data.outOfStockCount : 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">📦 <span>Smart<br />Warehouse</span></div>
        <nav>
          {links.filter(([, , , roles]) => !roles || can(...roles)).map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who"><strong>{user.name}</strong><span className="role">{user.role}</span></div>
          <button className="btn ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="live"><i /> Live · refreshes every 10s</span>
          <button className="bell" onClick={() => nav('/products?stock=low')} title="Low-stock alerts">
            🔔{alerts > 0 && <b>{alerts}</b>}
          </button>
        </header>
        <div className="content"><Outlet context={{ summary }} /></div>
      </main>
    </div>
  );
}
