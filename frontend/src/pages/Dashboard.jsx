import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// Inline SVG icon helper
const Icon = ({ path, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  available:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  allocated:    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  maintenance:  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  bookings:     'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  transfers:    'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  overdue:      'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  upcoming:     'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  pending:      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

const KPI_CONFIG = [
  { key: 'assets_available',  label: 'Available',         icon: ICONS.available,   bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', num: 'text-emerald-600', link: '/assets?status=available' },
  { key: 'assets_allocated',  label: 'Allocated',         icon: ICONS.allocated,   bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  num: 'text-indigo-600',  link: '/allocations' },
  { key: 'maintenance_active',label: 'Under Maintenance', icon: ICONS.maintenance, bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   num: 'text-amber-600',   link: '/maintenance' },
  { key: 'active_bookings',   label: 'Active Bookings',   icon: ICONS.bookings,    bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700',     num: 'text-sky-600',     link: '/bookings' },
  { key: 'pending_transfers', label: 'Pending Transfers', icon: ICONS.transfers,   bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  num: 'text-purple-600',  link: '/allocations' },
  { key: 'overdue_returns',   label: 'Overdue Returns',   icon: ICONS.overdue,     bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     num: 'text-red-600',     link: '/allocations' },
];

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function activityLabel(action) {
  const map = {
    'booking.created':    'Booking requested',
    'booking.approved':   'Booking approved',
    'booking.rejected':   'Booking rejected',
    'booking.cancelled':  'Booking cancelled',
    'allocation.created': 'Asset allocated',
    'allocation.returned':'Asset returned',
    'transfer.requested': 'Transfer requested',
    'transfer.approved':  'Transfer approved',
    'transfer.rejected':  'Transfer rejected',
    'maintenance.created':'Maintenance raised',
    'maintenance.approved':'Maintenance approved',
    'maintenance.resolved':'Maintenance resolved',
  };
  return map[action] || action.replace(/\./g, ' ');
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(null);

  const load = () => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const approveBooking = async (id) => {
    setApproving(id);
    try { await api(`/bookings/${id}/approve`, { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
    finally { setApproving(null); }
  };

  const rejectBooking = async (id) => {
    setApproving(id);
    try { await api(`/bookings/${id}/reject`, { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
    finally { setApproving(null); }
  };

  if (error) return <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (!data) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Loading dashboard…
    </div>
  );

  const isManager = ['admin', 'asset_manager'].includes(user?.role);
  const kpis = data?.kpis ?? {};
  const pendingBookings = data?.pending_bookings ?? [];
  const overdueReturns = data?.overdue_returns ?? [];
  const upcomingReturns = data?.upcoming_returns ?? [];
  const myAssets = data?.my_assets ?? [];
  const recentActivity = data?.recent_activity ?? [];
  const bookingTimeline = data?.booking_timeline ?? [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayBookings = bookingTimeline
    .map((booking) => ({
      ...booking,
      start_time: new Date(booking.start_time),
      end_time: new Date(booking.end_time),
    }))
    .filter((booking) => booking.start_time < todayEnd && booking.end_time > todayStart);
  const resources = Array.from(
    todayBookings.reduce((map, booking) => {
      const key = booking.asset_tag || booking.asset_name || booking.id;
      if (!map.has(key)) {
        map.set(key, {
          asset_tag: booking.asset_tag,
          asset_name: booking.asset_name || 'Unknown resource',
          bookings: [],
        });
      }
      map.get(key).bookings.push(booking);
      return map;
    }, new Map()).values()
  );
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            &nbsp;·&nbsp;<span className="capitalize">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <Link to="/assets" className="btn flex items-center gap-1.5">
              <Icon path="M12 4v16m8-8H4" className="h-4 w-4" /> Register Asset
            </Link>
          )}
          <Link to="/bookings" className="btn-secondary flex items-center gap-1.5">
            <Icon path={ICONS.bookings} className="h-4 w-4" /> Book Resource
          </Link>
          <Link to="/maintenance" className="btn-secondary flex items-center gap-1.5">
            <Icon path={ICONS.maintenance} className="h-4 w-4" /> Raise Maintenance
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CONFIG.map((k) => {
          const val = Number(kpis[k.key]) || 0;
          const urgent = k.key === 'overdue_returns' && val > 0;
          return (
            <Link
              key={k.key}
              to={k.link}
              className={`flex flex-col gap-2 p-4 rounded-xl border ${k.bg} ${k.border} hover:shadow-md transition-all group relative ${urgent ? 'ring-1 ring-red-300' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.bg} border ${k.border}`}>
                <Icon path={k.icon} className={`h-4 w-4 ${k.text}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${k.num}`}>{val}</div>
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${k.text} opacity-80`}>{k.label}</div>
              </div>
              {urgent && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <div className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Today’s Booking Schedule</h2>
              <p className="text-sm text-slate-500">Open the full schedule page for a better view of today’s bookings.</p>
            </div>
            <Link to="/schedule" className="btn inline-flex items-center gap-2">
              Open Today’s Booking Schedule
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Resources booked today</p>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{resources.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total approved bookings</p>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{todayBookings.length}</div>
            </div>
          </div>
          {resources.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
              No approved bookings are scheduled for today. Use the schedule page to see upcoming bookings and times.
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          {/* Manager: Pending Booking Approvals */}
          {isManager && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <Icon path={ICONS.pending} className="h-4 w-4 text-amber-600" />
                  </span>
                  Pending Booking Approvals
                  {kpis.pending_bookings_count > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      {kpis.pending_bookings_count}
                    </span>
                  )}
                </h2>
                <Link to="/bookings" className="text-xs text-indigo-600 hover:underline font-medium">View All</Link>
              </div>
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No pending booking requests.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{b.asset_name} <span className="font-mono text-xs text-gray-400">({b.asset_tag})</span></div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {b.booked_by_name} &middot; {new Date(b.start_time).toLocaleDateString()} {new Date(b.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–{new Date(b.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </div>
                        {b.purpose && <div className="text-xs text-indigo-600 italic mt-0.5">"{b.purpose}"</div>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          disabled={approving === b.id}
                          onClick={() => approveBooking(b.id)}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                        >Approve</button>
                        <button
                          disabled={approving === b.id}
                          onClick={() => rejectBooking(b.id)}
                          className="px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                        >Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Employee: My Upcoming Bookings */}
          {!isManager && pendingBookings.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                    <Icon path={ICONS.bookings} className="h-4 w-4 text-sky-600" />
                  </span>
                  My Bookings
                </h2>
                <Link to="/bookings" className="text-xs text-indigo-600 hover:underline font-medium">View All</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {data.pending_bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3 gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{b.asset_name} <span className="font-mono text-xs text-gray-400">({b.asset_tag})</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(b.start_time).toLocaleDateString()} &middot; {new Date(b.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–{new Date(b.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
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
              <h2 className="font-bold text-red-600 mb-3 flex items-center gap-2 text-sm">
                <Icon path={ICONS.overdue} className="h-4 w-4" />
                Overdue Returns
                <span className="ml-auto px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 text-xs font-bold">{kpis.overdue_returns}</span>
              </h2>
              {overdueReturns.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">All assets returned on time.</p>
              ) : (
                <div className="space-y-0">
                  {overdueReturns.map((r) => (
                    <div key={r.id} className="flex justify-between items-start py-2.5 border-t border-gray-100 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{r.asset_name}</div>
                        <div className="text-[11px] text-gray-400">{r.employee_name}</div>
                      </div>
                      <span className="text-[11px] font-bold text-red-600 shrink-0">{new Date(r.expected_return_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                <Icon path={ICONS.upcoming} className="h-4 w-4 text-sky-600" />
                Upcoming Returns
                <span className="ml-auto px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 border border-sky-100 text-xs font-bold">{kpis.upcoming_returns}</span>
              </h2>
              {upcomingReturns.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No returns due this week.</p>
              ) : (
                <div className="space-y-0">
                  {upcomingReturns.map((r) => (
                    <div key={r.id} className="flex justify-between items-start py-2.5 border-t border-gray-100 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{r.asset_name}</div>
                        <div className="text-[11px] text-gray-400">{r.employee_name}</div>
                      </div>
                      <span className="text-[11px] font-medium text-sky-700 shrink-0">{new Date(r.expected_return_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Employee: My Allocated Assets */}
          {myAssets.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                    <Icon path={ICONS.allocated} className="h-4 w-4 text-indigo-600" />
                  </span>
                  My Assigned Assets
                </h2>
                <Link to="/allocations" className="text-xs text-indigo-600 hover:underline font-medium">View All</Link>
              </div>
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="th">Tag</th>
                      <th className="th">Asset</th>
                      <th className="th">Category</th>
                      <th className="th">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAssets.map((a) => {
                      const overdue = a.expected_return_date && new Date(a.expected_return_date) < now;
                      return (
                        <tr key={a.id} className={overdue ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}>
                          <td className="td font-mono text-xs text-indigo-600 font-bold">{a.asset_tag}</td>
                          <td className="td font-medium text-gray-800">{a.asset_name}</td>
                          <td className="td text-gray-500">{a.category_name || '—'}</td>
                          <td className={`td font-medium text-xs ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                            {a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : <span className="text-gray-400">—</span>}
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

          {/* Quick Stats Snapshot */}
          <div className="card bg-linear-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <h2 className="font-bold text-slate-200 mb-4 text-sm uppercase tracking-wider">System Snapshot</h2>
            <div className="space-y-3">
              {[
                { label: 'Pending Booking Approvals', val: kpis.pending_bookings_count,    color: 'text-amber-400' },
                { label: 'Open Maintenance Requests', val: kpis.pending_maintenance_count, color: 'text-rose-400' },
                { label: 'Pending Asset Transfers',   val: kpis.pending_transfers,          color: 'text-purple-400' },
              ].map((s) => (
                <div key={s.label} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className={`text-lg font-bold ${s.color}`}>{s.val ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">Quick Actions</h2>
            <div className="space-y-2">
              {[
                isManager && { to: '/assets', icon: 'M12 4v16m8-8H4', label: 'Register New Asset', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                isManager && { to: '/allocations', icon: ICONS.allocated, label: 'Allocate an Asset', color: 'text-purple-600 bg-purple-50 border-purple-100' },
                { to: '/bookings', icon: ICONS.bookings, label: 'Book a Resource', color: 'text-sky-600 bg-sky-50 border-sky-100' },
                { to: '/maintenance', icon: ICONS.maintenance, label: 'Raise Maintenance Request', color: 'text-amber-600 bg-amber-50 border-amber-100' },
                isManager && { to: '/audits', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', label: 'Start an Audit Cycle', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                { to: '/reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'View Reports', color: 'text-gray-600 bg-gray-50 border-gray-200' },
              ].filter(Boolean).map((action) => (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium hover:shadow-sm transition-all ${action.color}`}
                >
                  <Icon path={action.icon} className="h-4 w-4 shrink-0" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Recent Activity</h2>
              <Link to="/notifications" className="text-xs text-indigo-600 hover:underline font-medium">View All</Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No recent activity.</p>
            ) : (
              <div className="space-y-0">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700">{activityLabel(a.action)}</div>
                      {a.details && <div className="text-[11px] text-gray-400 truncate">{a.details}</div>}
                      <div className="text-[10px] text-gray-400 mt-0.5">{a.user_name || 'System'} · {timeAgo(a.created_at)}</div>
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
