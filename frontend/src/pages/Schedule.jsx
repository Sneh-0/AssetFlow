import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const Icon = ({ path, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  bookings: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

export default function Schedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (!data) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Loading schedule…
    </div>
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayBookings = data.booking_timeline
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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Today’s Booking Schedule</h1>
          <p className="text-sm text-slate-500">A full-width view of today’s approved bookings and resource occupancy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate(-1)} className="btn-secondary">Back to Dashboard</button>
          <Link to="/bookings" className="btn inline-flex items-center gap-2">
            <Icon path={ICONS.bookings} className="h-4 w-4" /> Book Resource
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-230">
          <div className="grid grid-cols-[200px_repeat(24,minmax(0,1fr))] gap-0 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <div className="px-4 py-3">Resource</div>
            {hours.map((hour) => (
              <div key={hour} className="border-l border-slate-200 px-3 py-3 text-center">{hour}:00</div>
            ))}
          </div>
          <div className="space-y-3 py-3">
            {resources.map((resource) => (
              <div key={resource.asset_tag || resource.asset_name} className="relative grid grid-cols-[200px_repeat(24,minmax(0,1fr))] rounded-3xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
                <div className="border-r border-slate-200 bg-white px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{resource.asset_name}</div>
                  <div className="text-xs text-slate-500">{resource.asset_tag || '—'}</div>
                </div>
                <div className="relative col-span-24 bg-white py-4">
                  <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-24">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l border-slate-200" />
                    ))}
                  </div>
                  {resource.bookings.map((booking) => {
                    const start = booking.start_time < todayStart ? todayStart : booking.start_time;
                    const end = booking.end_time > todayEnd ? todayEnd : booking.end_time;
                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const duration = Math.max((end.getHours() + end.getMinutes() / 60) - startHour, 0.5);
                    const left = `${(startHour / 24) * 100}%`;
                    const width = `${(duration / 24) * 100}%`;
                    const title = booking.purpose || booking.booked_by_name || booking.asset_name;
                    return (
                      <div
                        key={booking.id}
                        className="group absolute top-3 h-12 rounded-none bg-linear-to-r from-indigo-600 to-sky-500 px-3 py-2 text-[12px] text-white shadow-lg"
                        style={{ left, width }}
                      >
                        <div className="flex h-full flex-col justify-center overflow-hidden">
                          <div className="truncate font-semibold">{title}</div>
                          <div className="mt-0.5 text-[10px] text-slate-100/90">
                            {booking.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {booking.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute left-0 -bottom-1 hidden w-72 translate-y-full rounded border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg group-hover:block">
                          <div className="mb-1 font-semibold text-slate-900 truncate">{booking.purpose || booking.asset_name || 'Booking'}</div>
                          <div className="text-[11px] text-slate-500">{booking.asset_tag ? `Tag: ${booking.asset_tag}` : 'Tag: —'}</div>
                          <div className="mt-2 text-[11px] leading-5">
                            <div><span className="font-semibold">Booked by:</span> {booking.booked_by_name || '—'}</div>
                            <div><span className="font-semibold">Time:</span> {booking.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {booking.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div><span className="font-semibold">Purpose:</span> {booking.purpose || '—'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {resources.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No approved bookings are scheduled for today.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
