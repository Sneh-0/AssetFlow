// OWNER: P2 — add photo display, status transition buttons, QR code render
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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

// Allowed manual status transitions per current status
const TRANSITIONS = {
  available:         ['reserved', 'lost', 'retired', 'disposed'],
  allocated:         ['lost', 'retired'],
  reserved:          ['available', 'lost', 'retired', 'disposed'],
  under_maintenance: ['available', 'lost', 'retired'],
  lost:              ['available'],
  retired:           ['disposed'],
  disposed:          [],
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({});
  const [imageMode, setImageMode] = useState('url');
  const [activePhoto, setActivePhoto] = useState(null);

  const reload = () => api(`/assets/${id}`).then((a) => { setAsset(a); setEdit({ name: a.name, condition: a.condition, location: a.location || '', is_bookable: a.is_bookable, image_url: a.image_url || '' }); });
  useEffect(() => { reload(); }, [id]);

  if (!asset) return <div className="text-gray-500">Loading…</div>;

  const canEdit   = ['admin', 'asset_manager'].includes(user.role);
  const canDelete = canEdit;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setEdit((prev) => ({ ...prev, image_url: b64 }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/assets/${id}`, { method: 'PUT', body: edit });
      setShowEdit(false);
      reload();
    } catch (err) { setError(err.message); }
  };

  const transition = async (status) => {
    if (!window.confirm(`Mark asset as "${status.replace('_', ' ')}"?`)) return;
    setError('');
    try {
      await api(`/assets/${id}`, { method: 'PUT', body: { status } });
      reload();
    } catch (err) { setError(err.message); }
  };

  const deleteAsset = async () => {
    if (!window.confirm(`Delete ${asset.asset_tag} — ${asset.name}? This cannot be undone.`)) return;
    try {
      await api(`/assets/${id}`, { method: 'DELETE' });
      navigate('/assets');
    } catch (err) { setError(err.message); }
  };

  const nextStatuses = TRANSITIONS[asset.status] || [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/assets" className="text-sm text-indigo-600">← Back to assets</Link>
        <div className="flex gap-2">
          {canEdit && <button onClick={() => setShowEdit(true)} className="btn text-sm">Edit</button>}
          {canDelete && <button onClick={deleteAsset} className="btn bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>}
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      {/* Main info card */}
      <div className="card flex gap-5">
        {asset.image_url
          ? <img src={asset.image_url} alt={asset.name} className="h-28 w-28 object-cover rounded-lg border flex-shrink-0" />
          : <div className="h-28 w-28 rounded-lg border bg-gray-100 flex items-center justify-center text-gray-300 text-3xl flex-shrink-0">📦</div>
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{asset.name} <span className="font-mono text-base text-gray-400">{asset.asset_tag}</span></h1>
            <span className={`badge ${STATUS_COLORS[asset.status]}`}>{asset.status.replace('_', ' ')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
            <div><div className="text-gray-400 text-xs">Category</div>{asset.category_name}</div>
            <div><div className="text-gray-400 text-xs">Condition</div>{asset.condition}</div>
            <div><div className="text-gray-400 text-xs">Location</div>{asset.location || '—'}</div>
            <div><div className="text-gray-400 text-xs">Serial</div>{asset.serial_number || '—'}</div>
            <div><div className="text-gray-400 text-xs">Acquired</div>{asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : '—'}</div>
            <div><div className="text-gray-400 text-xs">Cost</div>{asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString()}` : '—'}</div>
            <div><div className="text-gray-400 text-xs">Bookable</div>{asset.is_bookable ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      {/* Status transition actions */}
      {canEdit && nextStatuses.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wide">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <button key={s} onClick={() => transition(s)}
                className={`btn text-sm capitalize ${s === 'disposed' || s === 'lost' ? 'bg-red-600 hover:bg-red-700 text-white' : s === 'retired' ? 'bg-gray-500 hover:bg-gray-600 text-white' : ''}`}>
                Mark as {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={saveEdit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Edit Asset</h2>
            <input className="input" placeholder="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            <select className="input" value={edit.condition} onChange={(e) => setEdit({ ...edit, condition: e.target.value })}>
              {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Location" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_bookable} onChange={(e) => setEdit({ ...edit, is_bookable: e.target.checked })} />
              Shared / bookable resource
            </label>

            {/* Photo in edit */}
            <div className="space-y-1">
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'url'} onChange={() => setImageMode('url')} /> URL
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'file'} onChange={() => setImageMode('file')} /> Upload file
                </label>
              </div>
              {imageMode === 'url'
                ? <input className="input" placeholder="Image URL" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} />
                : <input type="file" accept="image/*" className="input text-sm" onChange={handleFile} />
              }
              {edit.image_url && <img src={edit.image_url} alt="preview" className="h-16 w-16 object-cover rounded border mt-1" />}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn flex-1">Save</button>
              <button type="button" className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 flex-1" onClick={() => setShowEdit(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Allocation history */}
      <div className="card">
        <h2 className="font-semibold mb-2">Allocation History</h2>
        {asset.allocations.length === 0 && <p className="text-sm text-gray-400">Never allocated.</p>}
        {asset.allocations.map((al) => (
          <div key={al.id} className="text-sm py-2 border-t border-gray-100 flex justify-between">
            <span>{al.employee_name || al.department_name} <span className="text-gray-400">by {al.allocated_by_name}</span></span>
            <span className="text-gray-500">
              {new Date(al.allocated_at).toLocaleDateString()} → {al.returned_at ? new Date(al.returned_at).toLocaleDateString() : 'now'}
            </span>
          </div>
        ))}
      </div>

      {/* Maintenance history */}
      <div className="card">
        <h2 className="font-semibold mb-2">Maintenance History</h2>
        {asset.maintenance.length === 0 && <p className="text-sm text-gray-400">No maintenance records.</p>}
        {asset.maintenance.map((m) => (
          <div key={m.id} className="text-sm py-3 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {m.photo_url ? (
                <img
                  src={m.photo_url}
                  alt="Issue"
                  className="h-10 w-10 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => setActivePhoto(m.photo_url)}
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs text-gray-300 font-bold">
                  —
                </div>
              )}
              <div>
                <div className="font-medium text-gray-800">{m.issue}</div>
                <div className="text-xs text-gray-400">
                  Priority: <span className="capitalize font-semibold text-gray-500">{m.priority}</span> · raised by {m.raised_by_name}
                </div>
              </div>
            </div>
            <span className="capitalize text-gray-500 font-medium text-xs bg-gray-100 px-2 py-1 rounded">{m.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Lightbox Modal for Photo Preview */}
      {activePhoto && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-white p-2 rounded-xl shadow-2xl overflow-hidden">
            <img src={activePhoto} alt="Maintenance Issue Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
