// OWNER: P3 — upgrade the list into a proper calendar/day view; add reschedule + reminder toast
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Bookings() {
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ asset_id: '', start_time: '', end_time: '', purpose: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = () => {
    api('/assets?bookable=true').then(setResources);
    api('/bookings').then(setBookings);
  };
  useEffect(load, []);

  const book = async (e) => {
    e.preventDefault();
    setError(''); setOk('');
    try {
      await api('/bookings', { method: 'POST', body: { ...form, asset_id: Number(form.asset_id) } });
      setOk('Booking confirmed ✅');
      setForm({ asset_id: '', start_time: '', end_time: '', purpose: '' });
      load();
    } catch (err) {
      setError(err.message); // 409 shows the overlapping booking details
    }
  };

  const cancel = async (id) => {
    try { await api(`/bookings/${id}/cancel`, { method: 'POST' }); load(); }
    catch (err) { setError(err.message); }
  };

  const statusColor = { upcoming: 'bg-sky-100 text-sky-700', ongoing: 'bg-emerald-100 text-emerald-700', completed: 'bg-gray-200 text-gray-600', cancelled: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Resource Bookings</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">🚫 {error}</div>}
      {ok && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2">{ok}</div>}

      <form onSubmit={book} className="card flex flex-wrap gap-3 items-end">
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500">Resource</label>
          <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
            <option value="">Select…</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.location || 'no location'})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input className="input" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input className="input" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
        </div>
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500">Purpose</label>
          <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
        </div>
        <button className="btn">Book</button>
      </form>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Resource</th><th className="th">By</th><th className="th">From</th><th className="th">To</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="td">{b.asset_name}</td>
                <td className="td">{b.booked_by_name}</td>
                <td className="td">{new Date(b.start_time).toLocaleString()}</td>
                <td className="td">{new Date(b.end_time).toLocaleString()}</td>
                <td className="td"><span className={`badge ${statusColor[b.live_status]}`}>{b.live_status}</span></td>
                <td className="td">{b.live_status === 'upcoming' && <button className="btn-secondary" onClick={() => cancel(b.id)}>Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && <p className="p-4 text-sm text-gray-400">No bookings yet.</p>}
      </div>
    </div>
  );
}
