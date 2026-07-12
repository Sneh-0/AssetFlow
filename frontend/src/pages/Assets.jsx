// OWNER: P2 — flesh out register form (photo upload, custom category fields), QR code search
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const STATUS_COLORS = {
  available: 'bg-emerald-100 text-emerald-700',
  allocated: 'bg-indigo-100 text-indigo-700',
  reserved: 'bg-sky-100 text-sky-700',
  under_maintenance: 'bg-amber-100 text-amber-700',
  lost: 'bg-red-100 text-red-700',
  retired: 'bg-gray-200 text-gray-600',
  disposed: 'bg-gray-200 text-gray-500',
};

export default function Assets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', serial_number: '', location: '', is_bookable: false });
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    api(`/assets?${params}`).then(setAssets).catch((e) => setError(e.message));
  };

  useEffect(load, [q, status]);
  useEffect(() => { api('/org/categories').then(setCategories); }, []);

  const register = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/assets', { method: 'POST', body: { ...form, category_id: Number(form.category_id) } });
      setShowForm(false);
      setForm({ name: '', category_id: '', serial_number: '', location: '', is_bookable: false });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const canRegister = ['admin', 'asset_manager'].includes(user.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assets</h1>
        {canRegister && <button className="btn" onClick={() => setShowForm(!showForm)}>+ Register Asset</button>}
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      {showForm && (
        <form onSubmit={register} className="card grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
            <option value="">Category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="Serial number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_bookable} onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })} />
            Shared / bookable resource
          </label>
          <button className="btn">Save</button>
        </form>
      )}

      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Search tag / serial / name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-45" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>
            <th className="th">Tag</th><th className="th">Name</th><th className="th">Category</th>
            <th className="th">Status</th><th className="th">Holder</th><th className="th">Location</th>
          </tr></thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="td font-mono"><Link className="text-indigo-600" to={`/assets/${a.id}`}>{a.asset_tag}</Link></td>
                <td className="td">{a.name}{a.is_bookable && ' 📅'}</td>
                <td className="td">{a.category_name}</td>
                <td className="td"><span className={`badge ${STATUS_COLORS[a.status]}`}>{a.status.replace('_', ' ')}</span></td>
                <td className="td">{a.holder_name || a.holder_department || '—'}</td>
                <td className="td">{a.location || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 && <p className="p-4 text-sm text-gray-400">No assets found.</p>}
      </div>
    </div>
  );
}
