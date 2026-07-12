import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Icon, ICONS } from './ui';
import QrScanner from './QrScanner';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: ICONS.dashboard }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/assets',      label: 'Assets',      icon: ICONS.box },
      { to: '/allocations', label: 'Allocations', icon: ICONS.transfer },
      { to: '/bookings',    label: 'Bookings',    icon: ICONS.calendar },
      { to: '/schedule',    label: 'Schedule',    icon: ICONS.clock },
      { to: '/maintenance', label: 'Maintenance', icon: ICONS.wrench },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/audits',        label: 'Audits',        icon: ICONS.clipboard },
      { to: '/reports',       label: 'Reports',       icon: ICONS.chart },
      { to: '/notifications', label: 'Activity',      icon: ICONS.bell },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [{ to: '/org', label: 'Org Setup', icon: ICONS.building }],
  },
];

const ROLE_LABELS = {
  admin: 'Administrator',
  asset_manager: 'Asset Manager',
  dept_head: 'Department Head',
  employee: 'Employee',
};

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function Sidebar({ user, logout, onNavigate, onScan }) {
  return (
    <div className="h-full w-64 bg-slate-950 text-slate-100 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 shrink-0">
          <Icon path={ICONS.box} className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight leading-none">
            Asset<span className="text-indigo-400">Flow</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 tracking-wide uppercase">Asset Management</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.filter((g) => !g.adminOnly || user.role === 'admin').map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 relative ${
                      isActive
                        ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-indigo-400" />}
                      <Icon path={n.icon} className="h-[17px] w-[17px] shrink-0 opacity-90" />
                      <span>{n.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Scan QR */}
      <div className="px-3 pb-2">
        <button
          onClick={onScan}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-white transition-colors cursor-pointer"
        >
          <Icon path={ICONS.qr} className="h-[17px] w-[17px] shrink-0" />
          Scan Asset QR
        </button>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{user.name}</div>
            <div className="text-[11px] text-slate-500">{ROLE_LABELS[user.role] || user.role}</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <Icon path={ICONS.logout} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const openScanner = () => { setDrawerOpen(false); setShowScanner(true); };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">
        <Sidebar user={user} logout={logout} onScan={openScanner} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-slide-in-left">
            <Sidebar user={user} logout={logout} onNavigate={() => setDrawerOpen(false)} onScan={openScanner} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-slate-950 text-white shadow-md">
          <button onClick={() => setDrawerOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <Icon path={ICONS.menu} className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Icon path={ICONS.box} className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-sm">Asset<span className="text-indigo-400">Flow</span></span>
          </div>
          <button onClick={openScanner} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" title="Scan QR">
            <Icon path={ICONS.qr} className="h-5 w-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[11px] font-bold">
            {initials(user.name)}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div key={location.pathname} className="animate-page mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* QR scanner modal — rendered at layout root so its fixed overlay maps to the viewport */}
      {showScanner && <QrScanner onClose={() => setShowScanner(false)} />}
    </div>
  );
}
