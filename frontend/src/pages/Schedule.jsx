import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Icon, ICONS, PageHeader, ErrorBanner, EmptyState, CardSkeleton } from '../components/ui';

const BLOCK_COLORS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-fuchsia-500',
];

const dayStartOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function Schedule() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState(dayStartOf(new Date()));
  const [nowTick, setNowTick] = useState(new Date());

  useEffect(() => {
    api('/bookings').then(setBookings).catch((e) => setError(e.message));
    const t = setInterval(() => setNowTick(new Date()), 60_000); // keep the now-line moving
    return () => clearInterval(t);
  }, []);

  const dayEnd = useMemo(() => { const e = new Date(day); e.setDate(e.getDate() + 1); return e; }, [day]);
  const isToday = dayStartOf(new Date()).getTime() === day.getTime();

  const resources = useMemo(() => {
    const dayBookings = (bookings || [])
      .filter((b) => b.status === 'approved')
      .map((b) => ({ ...b, start_time: new Date(b.start_time), end_time: new Date(b.end_time) }))
      .filter((b) => b.start_time < dayEnd && b.end_time > day);
    return Array.from(
      dayBookings.reduce((map, b) => {
        const key = b.asset_tag || b.asset_name || b.id;
        if (!map.has(key)) map.set(key, { asset_tag: b.asset_tag, asset_name: b.asset_name || 'Unknown resource', bookings: [] });
        map.get(key).bookings.push(b);
        return map;
      }, new Map()).values()
    );
  }, [bookings, day, dayEnd]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const shiftDay = (delta) => setDay((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
  const nowPct = ((nowTick.getHours() + nowTick.getMinutes() / 60) / 24) * 100;

  return (
    <div className="space-y-5">
      <PageHeader title="Booking Schedule" subtitle="Approved bookings by resource across the day — spot free slots at a glance.">
        <Link to="/bookings" className="btn">
          <Icon path={ICONS.calendar} /> Book Resource
        </Link>
      </PageHeader>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Day navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <button onClick={() => shiftDay(-1)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-500 transition-colors">
            <Icon path={ICONS.chevronL} className="h-4 w-4" />
          </button>
          <div className="px-4 py-2 text-sm font-semibold text-slate-800 border-x border-slate-200 min-w-44 text-center tabular-nums">
            {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
          </div>
          <button onClick={() => shiftDay(1)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-500 transition-colors">
            <Icon path={ICONS.chevronR} className="h-4 w-4" />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setDay(dayStartOf(new Date()))} className="btn-secondary !py-2">Today</button>
        )}
        {isToday && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400 font-semibold">
          {resources.length} resource{resources.length !== 1 ? 's' : ''} · {resources.reduce((n, r) => n + r.bookings.length, 0)} booking{resources.reduce((n, r) => n + r.bookings.length, 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="card p-0 overflow-hidden">
        {!bookings ? (
          <div className="p-5 space-y-3">
            <CardSkeleton className="h-16" /><CardSkeleton className="h-16" /><CardSkeleton className="h-16" />
          </div>
        ) : resources.length === 0 ? (
          <EmptyState icon={ICONS.calendar} title={`Nothing booked on ${day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            sub="Approved bookings for this day will appear here as timeline blocks.">
            <Link to="/bookings" className="btn"><Icon path={ICONS.plus} /> Book a Resource</Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* Hour ruler */}
              <div className="grid grid-cols-[180px_1fr] border-b border-slate-200 bg-slate-50/70">
                <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Resource</div>
                <div className="relative h-9">
                  {hours.map((h) => (
                    <span key={h} className="absolute top-0 bottom-0 border-l border-slate-200/80 text-[10px] text-slate-400 font-semibold pl-1 pt-2.5 tabular-nums"
                      style={{ left: `${(h / 24) * 100}%` }}>
                      {h % 2 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {resources.map((resource, ri) => (
                <div key={resource.asset_tag || resource.asset_name} className="grid grid-cols-[180px_1fr] border-b border-slate-100 last:border-0">
                  <div className="px-4 py-3.5 border-r border-slate-100">
                    <div className="text-sm font-semibold text-slate-800 truncate">{resource.asset_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{resource.asset_tag || '—'}</div>
                  </div>
                  <div className="relative h-[68px]">
                    {/* hour gridlines */}
                    {hours.map((h) => (
                      <span key={h} className={`absolute top-0 bottom-0 border-l ${h % 6 === 0 ? 'border-slate-200' : 'border-slate-100'}`} style={{ left: `${(h / 24) * 100}%` }} />
                    ))}
                    {/* now line */}
                    {isToday && (
                      <span className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none" style={{ left: `${nowPct}%` }}>
                        <span className="absolute -top-0 -left-[3px] w-2 h-2 rounded-full bg-rose-500" />
                      </span>
                    )}
                    {/* bookings */}
                    {resource.bookings.map((b) => {
                      const start = b.start_time < day ? day : b.start_time;
                      const end = b.end_time > dayEnd ? dayEnd : b.end_time;
                      const startHour = start.getHours() + start.getMinutes() / 60;
                      const endHour = end.getTime() === dayEnd.getTime() ? 24 : end.getHours() + end.getMinutes() / 60;
                      const width = Math.max(endHour - startHour, 0.5);
                      const color = BLOCK_COLORS[ri % BLOCK_COLORS.length];
                      return (
                        <div
                          key={b.id}
                          className={`group absolute top-2.5 bottom-2.5 rounded-lg bg-gradient-to-r ${color} px-2.5 py-1 text-white shadow-md hover:shadow-lg hover:z-20 transition-shadow cursor-default`}
                          style={{ left: `${(startHour / 24) * 100}%`, width: `${(width / 24) * 100}%` }}
                        >
                          <div className="flex h-full flex-col justify-center overflow-hidden">
                            <div className="truncate text-[11px] font-bold leading-tight">{b.purpose || b.booked_by_name || 'Booked'}</div>
                            <div className="truncate text-[10px] opacity-90">
                              {b.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{b.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {/* hover card */}
                          <div className="pointer-events-none absolute left-0 top-full mt-1.5 hidden w-64 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl group-hover:block z-30">
                            <div className="text-xs font-bold text-slate-900 truncate">{b.purpose || 'Booking'}</div>
                            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
                              <div><span className="font-semibold text-slate-400">By:</span> {b.booked_by_name || '—'}</div>
                              <div><span className="font-semibold text-slate-400">Time:</span> {b.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {b.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <div><span className="font-semibold text-slate-400">Resource:</span> {resource.asset_name} ({resource.asset_tag || '—'})</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
