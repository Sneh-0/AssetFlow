import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/assets', label: 'Assets', icon: '💻' },
  { to: '/allocations', label: 'Allocations', icon: '🔄' },
  { to: '/bookings', label: 'Bookings', icon: '📅' },
  { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  { to: '/audits', label: 'Audits', icon: '✅' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/org', label: 'Org Setup', icon: '🏢', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 text-lg font-bold tracking-tight">
          Asset<span className="text-indigo-400">Flow</span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {nav.filter((n) => !n.adminOnly || user.role === 'admin').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-slate-400 text-xs capitalize mb-2">{user.role.replace('_', ' ')}</div>
          <button onClick={logout} className="text-slate-300 hover:text-white text-xs underline cursor-pointer">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
