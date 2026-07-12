// OWNER: P3 — upgrade the list into a proper calendar/day view; add reschedule + reminder toast
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Bookings() {
  const { user } = useAuth();
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
      setOk('Booking request submitted. Pending manager approval.');
      setForm({ asset_id: '', start_time: '', end_time: '', purpose: '' });
      load();
    } catch (err) {
      setError(err.message); // 409 shows the overlapping booking details
    }
  };

  const cancel = async (id) => {
    setError(''); setOk('');
    try { 
      await api(`/bookings/${id}/cancel`, { method: 'POST' }); 
      setOk('Booking cancelled');
      load(); 
    } catch (err) { setError(err.message); }
  };

  const approve = async (id) => {
    setError(''); setOk('');
    try {
      await api(`/bookings/${id}/approve`, { method: 'POST' });
      setOk('Booking approved successfully');
      load();
    } catch (err) { setError(err.message); }
  };

  const reject = async (id) => {
    setError(''); setOk('');
    try {
      await api(`/bookings/${id}/reject`, { method: 'POST' });
      setOk('Booking request rejected');
      load();
    } catch (err) { setError(err.message); }
  };

  const isManager = ['admin', 'asset_manager'].includes(user?.role);
  const statusColor = { 
    pending: 'bg-amber-50 text-amber-700 border border-amber-200', 
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200', 
    rejected: 'bg-rose-50 text-rose-700 border border-rose-200', 
    cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
    upcoming: 'bg-sky-50 text-sky-700 border border-sky-200', 
    ongoing: 'bg-emerald-50 text-emerald-700 border border-emerald-200', 
    completed: 'bg-gray-100 text-gray-600 border border-gray-200'
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Resource Bookings</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">{error}</div>}
      {ok && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-100">{ok}</div>}

      <form onSubmit={book} className="card flex flex-wrap gap-4 items-end">
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Resource</label>
          <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
            <option value="">Select…</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.location || 'No location'})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 block">From</label>
          <input className="input" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 block">To</label>
          <input className="input" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
        </div>
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Purpose</label>
          <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
        </div>
        <button className="btn">Request Booking</button>
      </form>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="th">Resource</th>
              <th className="th">Requested By</th>
              <th className="th">From</th>
              <th className="th">To</th>
              <th className="th">Purpose</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="td font-medium text-gray-800">{b.asset_name}</td>
                <td className="td text-gray-600">{b.booked_by_name}</td>
                <td className="td text-gray-600">{new Date(b.start_time).toLocaleString()}</td>
                <td className="td text-gray-600">{new Date(b.end_time).toLocaleString()}</td>
                <td className="td text-gray-500 italic">"{b.purpose || 'No purpose stated'}"</td>
                <td className="td">
                  <span className={`badge uppercase text-[10px] font-extrabold ${statusColor[b.live_status]}`}>
                    {b.live_status}
                  </span>
                </td>
                <td className="td text-right space-x-1.5">
                  {['pending', 'upcoming'].includes(b.live_status) && b.booked_by === user.id && (
                    <button className="btn-secondary text-xs cursor-pointer font-semibold" onClick={() => cancel(b.id)}>Cancel</button>
                  )}
                  {isManager && b.live_status === 'pending' && (
                    <>
                      <button 
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold rounded text-xs transition-all border border-emerald-100 cursor-pointer" 
                        onClick={() => approve(b.id)}
                      >
                        Approve
                      </button>
                      <button 
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-bold rounded text-xs transition-all border border-rose-100 cursor-pointer" 
                        onClick={() => reject(b.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan="7" className="p-6 text-center text-gray-400 italic">No bookings recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
