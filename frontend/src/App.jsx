import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import OrgSetup from './pages/OrgSetup';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Allocations from './pages/Allocations';
import Bookings from './pages/Bookings';
import Maintenance from './pages/Maintenance';
import Audits from './pages/Audits';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/org" element={<Protected roles={['admin']}><OrgSetup /></Protected>} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/:id" element={<AssetDetail />} />
        <Route path="/allocations" element={<Allocations />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/audits" element={<Audits />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
