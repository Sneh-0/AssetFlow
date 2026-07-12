import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import { Icon, ICONS, EmptyState, useCountUp, CardSkeleton } from '../components/ui';

const KPI_CONFIG = [
  { key: 'assets_available',   label: 'Available',         icon: ICONS.checkCircle, tone: 'emerald', link: '/assets?status=available' },
  { key: 'assets_allocated',   label: 'Allocated',         icon: ICONS.box,         tone: 'indigo',  link: '/allocations' },
  { key: 'maintenance_active', label: 'In Maintenance',    icon: ICONS.wrench,      tone: 'amber',   link: '/maintenance' },
  { key: 'active_bookings',    label: 'Active Bookings',   icon: ICONS.calendar,    tone: 'sky',     link: '/bookings' },
  { key: 'pending_transfers',  label: 'Pending Transfers', icon: ICONS.transfer,    tone: 'violet',  link: '/allocations' },
  { key: 'overdue_returns',    label: 'Overdue Returns',   icon: ICONS.alert,       tone: 'rose',    link: '/allocations' },
];

const TONES = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200/70', text: 'text-emerald-700', num: 'text-emerald-600', iconBg: 'bg-emerald-100/70' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200/70',  text: 'text-indigo-700',  num: 'text-indigo-600',  iconBg: 'bg-indigo-100/70' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200/70',   text: 'text-amber-700',   num: 'text-amber-600',   iconBg: 'bg-amber-100/70' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200/70',     text: 'text-sky-700',     num: 'text-sky-600',     iconBg: 'bg-sky-100/70' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200/70',  text: 'text-violet-700',  num: 'text-violet-600',  iconBg: 'bg-violet-100/70' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200/70',    text: 'text-rose-700',    num: 'text-rose-600',    iconBg: 'bg-rose-100/70' },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function activityLabel(action) {
  const map = {
    'booking.created': 'Booking requested',   'booking.approved': 'Booking approved',
    'booking.rejected': 'Booking rejected',   'booking.cancelled': 'Booking cancelled',
    'allocation.created': 'Asset allocated',  'allocation.returned': 'Asset returned',
    'transfer.requested': 'Transfer requested', 'transfer.approved': 'Transfer approved',
    'transfer.rejected': 'Transfer rejected', 'maintenance.raised': 'Maintenance raised',
    'maintenance.created': 'Maintenance raised', 'maintenance.approved': 'Maintenance approved',
    'maintenance.resolved': 'Maintenance resolved', 'asset.created': 'Asset registered',
    'asset.updated': 'Asset updated', 'asset.deleted': 'Asset deleted',
    'user.role_changed': 'Role changed', 'department.created': 'Department created',
    'category.created': 'Category created',
  };
  return map[action] || action.replace(/[._]/g, ' ');
}

function Kpi({ config, value }) {
  const tone = TONES[config.tone];
  const animated = useCountUp(value);
  const urgent = config.key === 'overdue_returns' && value > 0;
  return (
    <Link
      to={config.link}
      className={`relative flex flex-col gap-2.5 p-4 rounded-2xl border ${tone.bg} ${tone.border}
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${urgent ? 'ring-1 ring-rose-300' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone.iconBg}`}>
        <Icon path={config.icon} className={`h-4 w-4 ${tone.text}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold tabular-nums ${tone.num}`}>{animated}</div>
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone.text} opacity-75`}>{config.label}</div>
      </div>
      {urgent && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-72" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} className="h-[104px]" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <CardSkeleton className="h-52" />
          <CardSkeleton className="h-40" />
        </div>
        <div className="space-y-5">
          <CardSkeleton className="h-44" />
          <CardSkeleton className="h-56" />
        </div>
      </div>
    </div>
  );
}

// Compact 0–24h occupancy strip for one resource
function TodayStrip({ resource }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 min-w-0">
        <div className="text-xs font-semibold text-slate-700 truncate">{resource.asset_name}</div>
        <div className="text-[10px] text-slate-400 font-mono">{resource.asset_tag || '—'}</div>
      </div>
      <div className="relative flex-1 h-6 rounded-md bg-slate-100 overflow-hidden">
        {[6, 12, 18].map((h) => (
          <span key={h} className="absolute top-0 bottom-0 w-px bg-slate-200" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {resource.bookings.map((b, i) => {
          const start = Math.max(b.start_time.getHours() + b.start_time.getMinutes() / 60, 0);
          const end = Math.min(b.end_time.getHours() + b.end_time.getMinutes() / 60 || 24, 24);
          const width = Math.max(end - start, 0.4);
          return (
            <span
              key={i}
              title={`${b.purpose || b.booked_by_name || 'Booked'} · ${b.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${b.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              className="absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r from-indigo-500 to-violet-500 shadow-sm"
              style={{ left: `${(start / 24) * 100}%`, width: `${(width / 24) * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null);

  const load = () => api('/dashboard').then(setData).catch((e) => setError(e.message));

  // Initial load + silent refresh every 60s so numbers stay live
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const decideBooking = async (id, action) => {
    setActing(id);
    try {
      await api(`/bookings/${id}/${action}`, { method: 'POST' });
      toast[action === 'approve' ? 'success' : 'info'](`Booking ${action}d`);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  };

  if (error) return <div className="p-4 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">{error}</div>;
  if (!data) return <DashboardSkeleton />;

  const isManager = ['admin', 'asset_manager'].includes(user?.role);
  const kpis = data?.kpis ?? {};
  const pendingBookings = data?.pending_bookings ?? [];
  const overdueReturns = data?.overdue_returns ?? [];
  const upcomingReturns = data?.upcoming_returns ?? [];
  const myAssets = data?.my_assets ?? [];
  const recentActivity = data?.recent_activity ?? [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
  const todayBookings = (data?.booking_timeline ?? [])
    .map((b) => ({ ...b, start_time: new Date(b.start_time), end_time: new Date(b.end_time) }))
    .filter((b) => b.start_time < todayEnd && b.end_time > todayStart);
  const resources = Array.from(
    todayBookings.reduce((map, b) => {
      const key = b.asset_tag || b.asset_name || b.id;
      if (!map.has(key)) map.set(key, { asset_tag: b.asset_tag, asset_name: b.asset_name || 'Unknown resource', bookings: [] });
      map.get(key).bookings.push(b);
      return map;
    }, new Map()).values()
  );

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{greeting}, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <Link to="/assets?register=1" className="btn">
              <Icon path={ICONS.plus} /> Register Asset
            </Link>
          )}
          <Link to="/bookings" className="btn-secondary">
            <Icon path={ICONS.calendar} /> Book Resource
          </Link>
          <Link to="/maintenance" className="btn-secondary">
            <Icon path={ICONS.wrench} /> Raise Maintenance
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
        {KPI_CONFIG.map((k) => <Kpi key={k.key} config={k} value={Number(kpis[k.key]) || 0} />)}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5 items-start">

        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          {/* Today's schedule preview */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <span className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                  <Icon path={ICONS.clock} className="h-4 w-4 text-sky-600" />
                </span>
                Today's Booking Schedule
                {todayBookings.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{todayBookings.length}</span>
                )}
              </h2>
              <Link to="/schedule" className="text-xs text-indigo-600 hover:underline font-semibold">Full schedule →</Link>
            </div>
            {resources.length === 0 ? (
              <EmptyState icon={ICONS.calendar} title="Nothing booked today"
                sub="Approved bookings for today will appear here as an occupancy timeline." />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold pl-[9.75rem] pr-1">
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                </div>
                {resources.slice(0, 5).map((r) => <TodayStrip key={r.asset_tag || r.asset_name} resource={r} />)}
                {resources.length > 5 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+{resources.length - 5} more on the full schedule</p>
                )}
              </div>
            )}
          </div>

          {/* Manager: Pending Booking Approvals */}
          {isManager && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <Icon path={ICONS.bell} className="h-4 w-4 text-amber-600" />
                  </span>
                  Pending Booking Approvals
                  {Number(kpis.pending_bookings_count) > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      {kpis.pending_bookings_count}
                    </span>
                  )}
                </h2>
                <Link to="/bookings" className="text-xs text-indigo-600 hover:underline font-semibold">View all →</Link>
              </div>
              {pendingBookings.length === 0 ? (
                <EmptyState icon={ICONS.checkCircle} title="All caught up" sub="No booking requests are waiting for a decision." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {b.asset_name} <span className="font-mono text-xs text-slate-400">({b.asset_tag})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {b.booked_by_name} · {new Date(b.start_time).toLocaleDateString()} {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {b.purpose && <div className="text-xs text-indigo-600 italic mt-0.5 truncate">"{b.purpose}"</div>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button disabled={acting === b.id} onClick={() => decideBooking(b.id, 'approve')}
                          className="px-2.5 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 transition-all cursor-pointer disabled:opacity-50">
                          Approve
                        </button>
                        <button disabled={acting === b.id} onClick={() => decideBooking(b.id, 'reject')}
                          className="px-2.5 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-200 transition-all cursor-pointer disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Employee: My Bookings */}
          {!isManager && pendingBookings.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                    <Icon path={ICONS.calendar} className="h-4 w-4 text-sky-600" />
                  </span>
                  My Bookings
                </h2>
                <Link to="/bookings" className="text-xs text-indigo-600 hover:underline font-semibold">View all →</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {pendingBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {b.asset_name} <span className="font-mono text-xs text-slate-400">({b.asset_tag})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(b.start_time).toLocaleDateString()} · {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`badge text-[10px] uppercase font-bold ${b.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue & Upcoming Returns */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card">
              <h2 className="font-bold text-rose-600 mb-3 flex items-center gap-2 text-sm">
                <Icon path={ICONS.alert} className="h-4 w-4" />
                Overdue Returns
                <span className="ml-auto px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 text-xs font-bold">{kpis.overdue_returns}</span>
              </h2>
              {overdueReturns.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">All assets returned on time. 🎉</p>
              ) : (
                overdueReturns.map((r) => (
                  <div key={r.id} className="flex justify-between items-start py-2.5 border-t border-slate-100 gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{r.asset_name}</div>
                      <div className="text-[11px] text-slate-400">{r.employee_name}</div>
                    </div>
                    <span className="text-[11px] font-bold text-rose-600 shrink-0">{new Date(r.expected_return_date).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                <Icon path={ICONS.clock} className="h-4 w-4 text-sky-600" />
                Upcoming Returns
                <span className="ml-auto px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100 text-xs font-bold">{kpis.upcoming_returns}</span>
              </h2>
              {upcomingReturns.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No returns due this week.</p>
              ) : (
                upcomingReturns.map((r) => (
                  <div key={r.id} className="flex justify-between items-start py-2.5 border-t border-slate-100 gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{r.asset_name}</div>
                      <div className="text-[11px] text-slate-400">{r.employee_name}</div>
                    </div>
                    <span className="text-[11px] font-medium text-sky-700 shrink-0">{new Date(r.expected_return_date).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My Allocated Assets */}
          {myAssets.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 mb-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                    <Icon path={ICONS.box} className="h-4 w-4 text-indigo-600" />
                  </span>
                  My Assigned Assets
                </h2>
                <Link to="/allocations" className="text-xs text-indigo-600 hover:underline font-semibold">View all →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">Tag</th><th className="th">Asset</th><th className="th">Category</th><th className="th">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAssets.map((a) => {
                      const overdue = a.expected_return_date && new Date(a.expected_return_date) < now;
                      return (
                        <tr key={a.id} className={overdue ? 'bg-rose-50/50' : 'hover:bg-slate-50/60 transition-colors'}>
                          <td className="td font-mono text-xs text-indigo-600 font-bold">{a.asset_tag}</td>
                          <td className="td font-medium text-slate-800">{a.asset_name}</td>
                          <td className="td text-slate-500">{a.category_name || '—'}</td>
                          <td className={`td font-medium text-xs ${overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                            {a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-5">

          {/* System Snapshot */}
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl" />
            <h2 className="font-bold text-slate-200 mb-4 text-xs uppercase tracking-widest">System Snapshot</h2>
            <div className="space-y-1">
              {[
                { label: 'Pending Booking Approvals', val: kpis.pending_bookings_count,    color: 'text-amber-400',  link: '/bookings' },
                { label: 'Open Maintenance Requests', val: kpis.pending_maintenance_count, color: 'text-rose-400',   link: '/maintenance' },
                { label: 'Pending Asset Transfers',   val: kpis.pending_transfers,         color: 'text-violet-400', link: '/allocations' },
              ].map((s) => (
                <Link key={s.label} to={s.link}
                  className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg border-b border-slate-700/50 last:border-0 hover:bg-white/5 transition-colors">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className={`text-lg font-bold tabular-nums ${s.color}`}>{s.val ?? 0}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest">Quick Actions</h2>
            <div className="space-y-2">
              {[
                isManager && { to: '/assets?register=1', icon: ICONS.plus,     label: 'Register New Asset',        color: 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:border-indigo-300' },
                isManager && { to: '/allocations',       icon: ICONS.box,      label: 'Allocate an Asset',         color: 'text-violet-600 bg-violet-50 border-violet-100 hover:border-violet-300' },
                { to: '/bookings',    icon: ICONS.calendar,  label: 'Book a Resource',           color: 'text-sky-600 bg-sky-50 border-sky-100 hover:border-sky-300' },
                { to: '/maintenance', icon: ICONS.wrench,    label: 'Raise Maintenance Request', color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' },
                isManager && { to: '/audits', icon: ICONS.clipboard, label: 'Start an Audit Cycle', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' },
                { to: '/reports', icon: ICONS.chart, label: 'View Reports', color: 'text-slate-600 bg-slate-50 border-slate-200 hover:border-slate-300' },
              ].filter(Boolean).map((action) => (
                <Link key={action.to + action.label} to={action.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm hover:-translate-y-px ${action.color}`}>
                  <Icon path={action.icon} className="h-4 w-4 shrink-0" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 text-xs uppercase tracking-widest">Recent Activity</h2>
              <Link to="/notifications" className="text-xs text-indigo-600 hover:underline font-semibold">View all →</Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity.</p>
            ) : (
              <div className="relative">
                <span className="absolute left-[3px] top-2 bottom-2 w-px bg-slate-200" />
                {recentActivity.map((a, i) => (
                  <div key={i} className="relative flex items-start gap-3 py-2 pl-4">
                    <span className="absolute left-0 top-3.5 w-[7px] h-[7px] rounded-full bg-indigo-400 ring-2 ring-white" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700">{activityLabel(a.action)}</div>
                      {a.details && <div className="text-[11px] text-slate-400 truncate">{a.details}</div>}
                      <div className="text-[10px] text-slate-400 mt-0.5">{a.user_name || 'System'} · {timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
