import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, PageHeader, Field, ErrorBanner, ConfirmModal,
  EmptyState, TableSkeleton,
} from '../components/ui';

const STATUS_STYLE = {
  pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  approved:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
  upcoming:  'bg-sky-50 text-sky-700 border border-sky-200',
  ongoing:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  completed: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const FILTERS = ['all', 'pending', 'upcoming', 'ongoing', 'completed', 'rejected'];

function fmtRange(start, end) {
  const s = new Date(start), e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const t = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `${s.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${t(s)} – ${t(e)}`
    : `${s.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${e.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

function duration(start, end) {
  const mins = (new Date(end) - new Date(start)) / 60000;
  if (mins <= 0 || Number.isNaN(mins)) return null;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

export default function Bookings() {
  const { user } = useAuth();
  const toast = useToast();
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState(null);
  const [form, setForm] = useState({ asset_id: '', start_time: '', end_time: '', purpose: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState(null);
  const [resourceSchedule, setResourceSchedule] = useState(null); // approved bookings of selected resource

  const load = () => {
    api('/assets?bookable=true').then(setResources).catch(() => {});
    api('/bookings').then(setBookings).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  // Availability preview: whenever a resource is picked, fetch its approved bookings
  useEffect(() => {
    if (!form.asset_id) { setResourceSchedule(null); return; }
    let stale = false;
    api(`/bookings?asset_id=${form.asset_id}`)
      .then((rows) => {
        if (stale) return;
        const upcoming = rows.filter((b) => new Date(b.end_time) > new Date()).slice(0, 4);
        setResourceSchedule(upcoming);
      })
      .catch(() => setResourceSchedule(null));
    return () => { stale = true; };
  }, [form.asset_id]);

  const dur = duration(form.start_time, form.end_time);
  const invalidRange = form.start_time && form.end_time && new Date(form.end_time) <= new Date(form.start_time);

  const book = async (e) => {
    e.preventDefault();
    setError('');
    if (invalidRange) { setError('End time must be after the start time.'); return; }
    setBusy(true);
    try {
      await api('/bookings', { method: 'POST', body: { ...form, asset_id: Number(form.asset_id) } });
      toast.success('Booking requested — pending manager approval');
      setForm({ asset_id: '', start_time: '', end_time: '', purpose: '' });
      load();
    } catch (err) {
      setError(err.message); // 409 carries the overlapping booking details
    } finally { setBusy(false); }
  };

  const act = async (id, action, okMsg) => {
    try {
      await api(`/bookings/${id}/${action}`, { method: 'POST' });
      toast[action === 'reject' ? 'info' : 'success'](okMsg);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const isManager = ['admin', 'asset_manager'].includes(user?.role);

  const visible = useMemo(() => {
    if (!bookings) return [];
    if (filter === 'all') return bookings;
    return bookings.filter((b) => b.live_status === filter);
  }, [bookings, filter]);

  const counts = useMemo(() => {
    const c = {};
    (bookings || []).forEach((b) => { c[b.live_status] = (c[b.live_status] || 0) + 1; });
    return c;
  }, [bookings]);

  return (
    <div className="space-y-5">
      <PageHeader title="Resource Bookings" subtitle="Time-slot booking of shared resources — overlaps are rejected automatically.">
        <Link to="/schedule" className="btn-secondary">
          <Icon path={ICONS.clock} /> Today's Schedule
        </Link>
      </PageHeader>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Booking form */}
      <form onSubmit={book} className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">New Booking Request</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Resource" required className="grow max-w-sm min-w-52">
            <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
              <option value="">Select resource…</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.location || 'no location'}</option>)}
            </select>
          </Field>
          <Field label="From" required>
            <input className="input" type="datetime-local" value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
          </Field>
          <Field label="To" required>
            <input className={`input ${invalidRange ? '!border-rose-300 focus:!ring-rose-400/60' : ''}`} type="datetime-local" value={form.end_time}
              min={form.start_time || undefined}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
          </Field>
          <Field label="Purpose" className="grow max-w-xs min-w-44">
            <input className="input" placeholder="e.g. Sprint planning" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </Field>
          <button className="btn" disabled={busy || invalidRange}>{busy ? 'Requesting…' : 'Request Booking'}</button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
          {invalidRange && (
            <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
              <Icon path={ICONS.alert} className="h-3.5 w-3.5" /> End time must be after the start time.
            </span>
          )}
          {!invalidRange && dur && (
            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
              <Icon path={ICONS.clock} className="h-3.5 w-3.5" /> Duration: {dur}
            </span>
          )}
        </div>

        {/* Availability preview */}
        {form.asset_id && resourceSchedule && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 animate-fade-up">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-2 flex items-center gap-1.5">
              <Icon path={ICONS.calendar} className="h-3.5 w-3.5" />
              Already booked (approved) — avoid these slots
            </div>
            {resourceSchedule.length === 0 ? (
              <p className="text-xs text-sky-800/80">No upcoming approved bookings — the calendar is wide open. 🎉</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resourceSchedule.map((b) => (
                  <span key={b.id} className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-xs font-medium text-slate-700">
                    {fmtRange(b.start_time, b.end_time)}
                    <span className="text-slate-400"> · {b.booked_by_name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`capitalize ${filter === f ? 'pill-on' : 'pill-off'}`}>
            {f}{f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {/* Bookings table */}
      <div className="card p-0 overflow-hidden">
        {!bookings ? (
          <TableSkeleton rows={5} cols={6} />
        ) : visible.length === 0 ? (
          <EmptyState icon={ICONS.calendar} title="No bookings here"
            sub={filter === 'all' ? 'Request a booking above — it lands in this registry.' : `No ${filter} bookings right now.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Resource</th>
                  <th className="th">Requested By</th>
                  <th className="th">Slot</th>
                  <th className="th">Purpose</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td">
                      <div className="font-semibold text-slate-800">{b.asset_name}</div>
                      <div className="text-xs font-mono text-slate-400">{b.asset_tag}</div>
                    </td>
                    <td className="td text-slate-600">{b.booked_by_name}</td>
                    <td className="td text-slate-600 whitespace-nowrap">
                      {fmtRange(b.start_time, b.end_time)}
                      <span className="block text-[11px] text-slate-400">{duration(b.start_time, b.end_time)}</span>
                    </td>
                    <td className="td text-slate-500 italic max-w-48 truncate">{b.purpose ? `"${b.purpose}"` : <span className="text-slate-300 not-italic">—</span>}</td>
                    <td className="td">
                      <span className={`badge uppercase !text-[10px] font-extrabold ${STATUS_STYLE[b.live_status]}`}>{b.live_status}</span>
                    </td>
                    <td className="td text-right whitespace-nowrap space-x-1.5">
                      {['pending', 'upcoming'].includes(b.live_status) && b.booked_by === user.id && (
                        <button className="btn-ghost !text-xs !px-2.5 border border-slate-200" onClick={() => setCancelling(b)}>Cancel</button>
                      )}
                      {isManager && b.live_status === 'pending' && (
                        <>
                          <button
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold rounded-lg text-xs transition-all border border-emerald-200 cursor-pointer"
                            onClick={() => act(b.id, 'approve', 'Booking approved')}>
                            Approve
                          </button>
                          <button
                            className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-bold rounded-lg text-xs transition-all border border-rose-200 cursor-pointer"
                            onClick={() => act(b.id, 'reject', 'Booking rejected')}>
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelling && (
        <ConfirmModal
          title="Cancel booking"
          message={<>Cancel your booking of <strong>{cancelling.asset_name}</strong> ({fmtRange(cancelling.start_time, cancelling.end_time)})? The slot becomes free for others.</>}
          confirmLabel="Cancel Booking"
          danger
          onConfirm={async () => {
            await act(cancelling.id, 'cancel', 'Booking cancelled');
            setCancelling(null);
          }}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
