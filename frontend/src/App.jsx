import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Movements from './pages/Movements';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Warehouses from './pages/Warehouses';
import Users from './pages/Users';

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="movements" element={<Movements />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="reports" element={<Protected roles={['admin', 'manager']}><Reports /></Protected>} />
        <Route path="users" element={<Protected roles={['admin']}><Users /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
