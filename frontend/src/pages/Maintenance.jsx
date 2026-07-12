// OWNER: P3 — add photo attach, technician-assignment modal, priority filters
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Maintenance() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ asset_id: '', issue: '', priority: 'medium' });
  const [error, setError] = useState('');

  const load = () => {
    api('/maintenance').then(setRequests);
    api('/assets').then(setAssets);
  };
  useEffect(load, []);

  const raise = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/maintenance', { method: 'POST', body: { ...form, asset_id: Number(form.asset_id) } });
      setForm({ asset_id: '', issue: '', priority: 'medium' });
      load();
    } catch (err) { setError(err.message); }
  };

  const act = async (id, action) => {
    setError('');
    try {
      const technician = action === 'assign' ? prompt('Technician name?') : undefined;
      await api(`/maintenance/${id}`, { method: 'PUT', body: { action, technician } });
      load();
    } catch (err) { setError(err.message); }
  };

  const isManager = ['admin', 'asset_manager'].includes(user.role);
  const NEXT = { pending: ['approve', 'reject'], approved: ['assign'], assigned: ['start', 'resolve'], in_progress: ['resolve'] };
  const badge = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-sky-100 text-sky-700', rejected: 'bg-red-100 text-red-700', assigned: 'bg-purple-100 text-purple-700', in_progress: 'bg-indigo-100 text-indigo-700', resolved: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Maintenance</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      <form onSubmit={raise} className="card flex flex-wrap gap-3 items-end">
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500">Asset</label>
          <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
            <option value="">Select…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
          </select>
        </div>
        <div className="grow max-w-md">
          <label className="text-xs text-gray-500">Issue</label>
          <input className="input" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-gray-500">Priority</label>
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'medium', 'high', 'critical'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn">Raise Request</button>
      </form>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Asset</th><th className="th">Issue</th><th className="th">Priority</th><th className="th">Raised By</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
          <tbody>
            {requests.map((m) => (
              <tr key={m.id}>
                <td className="td font-mono">{m.asset_tag}</td>
                <td className="td">{m.issue}{m.technician && <span className="text-gray-400"> · tech: {m.technician}</span>}</td>
                <td className="td capitalize">{m.priority}</td>
                <td className="td">{m.raised_by_name}</td>
                <td className="td"><span className={`badge ${badge[m.status]}`}>{m.status.replace('_', ' ')}</span></td>
                <td className="td space-x-1">
                  {isManager && (NEXT[m.status] || []).map((a) => (
                    <button key={a} className="btn-secondary" onClick={() => act(m.id, a)}>{a}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <p className="p-4 text-sm text-gray-400">No maintenance requests.</p>}
      </div>
    </div>
  );
}
