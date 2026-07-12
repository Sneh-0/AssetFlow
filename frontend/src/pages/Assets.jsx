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

const EMPTY_FORM = { name: '', category_id: '', serial_number: '', location: '', is_bookable: false, image_url: '', imageMode: 'url', brand: '', model: '', vendor: '', warranty_expiry: '' };

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Assets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    api(`/assets?${params}`).then(setAssets).catch((e) => setError(e.message));
  };

  useEffect(load, [q, status]);
  useEffect(() => { api('/org/categories').then(setCategories); }, []);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setForm((f) => ({ ...f, image_url: b64 }));
  };

  const register = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { imageMode, ...rest } = form;
      await api('/assets', { method: 'POST', body: { ...rest, category_id: Number(rest.category_id) } });
      setShowForm(false);
      setForm(EMPTY_FORM);
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
          <input className="input" placeholder="Brand (e.g. Dell, Apple)" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <input className="input" placeholder="Model (e.g. Latitude 5440)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="Vendor / Supplier" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          <div className="space-y-0.5">
            <label className="text-xs text-gray-400">Warranty Expiry</label>
            <input type="date" className="input" value={form.warranty_expiry} onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })} />
          </div>

          {/* Photo upload */}
          <div className="md:col-span-2 space-y-1">
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="imageMode" checked={form.imageMode === 'url'} onChange={() => setForm({ ...form, imageMode: 'url', image_url: '' })} />
                URL
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="imageMode" checked={form.imageMode === 'file'} onChange={() => setForm({ ...form, imageMode: 'file', image_url: '' })} />
                Upload file
              </label>
            </div>
            {form.imageMode === 'url'
              ? <input className="input" placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              : <input type="file" accept="image/*" className="input text-sm" onChange={handleFile} />
            }
            {form.image_url && (
              <img src={form.image_url} alt="preview" className="h-16 w-16 object-cover rounded border mt-1" />
            )}
          </div>

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
                <td className="td font-mono">
                  <Link className="text-indigo-600" to={`/assets/${a.id}`}>
                    {a.image_url && <img src={a.image_url} alt="" className="inline-block h-5 w-5 object-cover rounded mr-1 align-middle" />}
                    {a.asset_tag}
                  </Link>
                </td>
                <td className="td">
                  <span>{a.name}</span>
                  {a.is_bookable && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                      Bookable
                    </span>
                  )}
                </td>
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
