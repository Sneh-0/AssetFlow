import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, Modal, ConfirmModal, Field, ErrorBanner,
  StatusBadge, CardSkeleton,
} from '../components/ui';

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

const MAINT_BADGE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-sky-50 text-sky-700 border-sky-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  assigned: 'bg-violet-50 text-violet-700 border-violet-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-sm text-slate-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value ?? <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({});
  const [imageMode, setImageMode] = useState('url');
  const [confirm, setConfirm] = useState(null); // { type: 'transition'|'delete', status? }
  const [busy, setBusy] = useState(false);
  const qrRef = useRef(null);

  const reload = () => api(`/assets/${id}`).then((a) => {
    setAsset(a);
    setEdit({
      name: a.name, condition: a.condition, location: a.location || '',
      is_bookable: a.is_bookable, image_url: a.image_url || '',
      brand: a.brand || '', model: a.model || '', vendor: a.vendor || '',
      warranty_expiry: a.warranty_expiry ? a.warranty_expiry.split('T')[0] : '',
    });
  }).catch((e) => setError(e.message));

  useEffect(() => { reload(); }, [id]);

  if (error && !asset) return <ErrorBanner message={error} />;
  if (!asset) return (
    <div className="space-y-5 max-w-4xl">
      <div className="skeleton h-8 w-48" />
      <CardSkeleton className="h-44" />
      <CardSkeleton className="h-32" />
    </div>
  );

  const canEdit = ['admin', 'asset_manager'].includes(user.role);
  const scanUrl = `${window.location.origin}/scan/${asset.asset_tag}`;
  const nextStatuses = TRANSITIONS[asset.status] || [];
  const warrantyExpired = asset.warranty_expiry && new Date(asset.warranty_expiry) < new Date();

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${asset.asset_tag}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // ─────────────────────────────────────────────────────────────


  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setEdit((prev) => ({ ...prev, image_url: b64 }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/assets/${id}`, { method: 'PUT', body: { ...edit, warranty_expiry: edit.warranty_expiry || null } });
      setShowEdit(false);
      toast.success('Asset updated');
      reload();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      if (confirm.type === 'delete') {
        await api(`/assets/${id}`, { method: 'DELETE' });
        toast.success(`${asset.asset_tag} deleted`);
        navigate('/assets');
        return;
      }
      await api(`/assets/${id}`, { method: 'PUT', body: { status: confirm.status } });
      toast.success(`Status changed to ${confirm.status.replace('_', ' ')}`);
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/assets" className="btn-ghost !px-2">
          <Icon path={ICONS.arrowLeft} className="h-4 w-4" /> All assets
        </Link>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(true)} className="btn-secondary">
              <Icon path={ICONS.edit} className="h-4 w-4" /> Edit
            </button>
            <button onClick={() => setConfirm({ type: 'delete' })} className="btn-danger">
              <Icon path={ICONS.trash} className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Hero card */}
      <div className="card !p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
          {asset.image_url ? (
            <img
              src={asset.image_url} alt={asset.name}
              onClick={() => setActivePhoto(asset.image_url)}
              className="h-32 w-32 object-cover rounded-2xl border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="h-32 w-32 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
              <Icon path={ICONS.box} className="h-12 w-12 text-slate-200" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{asset.name}</h1>
                  {asset.is_bookable && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider">Bookable</span>
                  )}
                </div>
                <div className="text-sm font-mono text-slate-400 mt-0.5">{asset.asset_tag}</div>
              </div>
              <StatusBadge status={asset.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 mt-5">
              <Meta label="Category" value={asset.category_name} />
              <Meta label="Condition" value={asset.condition && asset.condition[0].toUpperCase() + asset.condition.slice(1)} />
              <Meta label="Location" value={asset.location} />
              <Meta label="Serial No." value={asset.serial_number} mono />
              <Meta label="Brand" value={asset.brand} />
              <Meta label="Model" value={asset.model} />
              <Meta label="Vendor" value={asset.vendor} />
              <Meta
                label="Warranty"
                value={asset.warranty_expiry
                  ? <span className={warrantyExpired ? 'text-rose-600 font-semibold' : ''}>
                      {new Date(asset.warranty_expiry).toLocaleDateString()}{warrantyExpired ? ' (expired)' : ''}
                    </span>
                  : null}
              />
              <Meta label="Acquired" value={asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : null} />
              <Meta label="Cost" value={asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString('en-IN')}` : null} />
            </div>
          </div>
        </div>
      </div>

      {/* Status transitions */}
      {canEdit && nextStatuses.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Lifecycle Actions</h2>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => {
              const danger = s === 'disposed' || s === 'lost';
              const warn = s === 'retired';
              return (
                <button
                  key={s}
                  onClick={() => setConfirm({ type: 'transition', status: s })}
                  className={`capitalize ${danger ? 'btn-danger' : warn ? 'btn bg-slate-600 shadow-slate-600/20 hover:bg-slate-500' : 'btn-secondary'}`}
                >
                  Mark as {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* QR + histories */}
      <div className="grid md:grid-cols-3 gap-5 items-start">
        <div className="card flex flex-col items-center text-center">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Icon path={ICONS.qr} className="h-3.5 w-3.5" /> QR Code
          </h2>
          <div ref={qrRef} className="p-2.5 bg-white rounded-xl border border-slate-200">
            <QRCodeSVG value={scanUrl} size={132} includeMargin level="M" />
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">Scan to open the public asset page — no login needed.</p>
          <button onClick={downloadQR} className="btn-secondary mt-3 w-full">
            <Icon path={ICONS.download} className="h-4 w-4" /> Download SVG
          </button>
        </div>

        <div className="md:col-span-2 space-y-5">
          {/* Allocation history */}
          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Allocation History</h2>
            {asset.allocations.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Never allocated.</p>
            ) : (
              <div className="relative">
                <span className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />
                {asset.allocations.map((al) => (
                  <div key={al.id} className="relative pl-6 py-2.5">
                    <span className={`absolute left-0 top-4 w-[11px] h-[11px] rounded-full ring-2 ring-white ${al.status === 'active' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div>
                        <span className="text-sm font-semibold text-slate-800">{al.employee_name || al.department_name}</span>
                        <span className="text-xs text-slate-400 ml-2">by {al.allocated_by_name}</span>
                        {al.return_notes && <div className="text-xs text-slate-400 italic mt-0.5">"{al.return_notes}"</div>}
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                        {new Date(al.allocated_at).toLocaleDateString()} → {al.returned_at ? new Date(al.returned_at).toLocaleDateString() : <span className="text-indigo-600 font-semibold">now</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maintenance history */}
          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Maintenance History</h2>
            {asset.maintenance.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No maintenance records.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asset.maintenance.map((m) => (
                  <div key={m.id} className="py-3 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="Issue" onClick={() => setActivePhoto(m.photo_url)}
                          className="h-10 w-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-85 transition-opacity shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          <Icon path={ICONS.wrench} className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{m.issue}</div>
                        <div className="text-xs text-slate-400">
                          <span className="capitalize font-semibold text-slate-500">{m.priority}</span> · raised by {m.raised_by_name}
                          {m.technician_name && <span className="text-indigo-500"> · tech: {m.technician_name}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`badge capitalize border shrink-0 ${MAINT_BADGE[m.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal title="Edit Asset" subtitle={asset.asset_tag} onClose={() => setShowEdit(false)} maxWidth="max-w-xl">
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" required className="sm:col-span-2">
                <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
              </Field>
              <Field label="Condition">
                <select className="input" value={edit.condition} onChange={(e) => setEdit({ ...edit, condition: e.target.value })}>
                  {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <input className="input" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
              </Field>
              <Field label="Brand">
                <input className="input" value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} />
              </Field>
              <Field label="Model">
                <input className="input" value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} />
              </Field>
              <Field label="Vendor">
                <input className="input" value={edit.vendor} onChange={(e) => setEdit({ ...edit, vendor: e.target.value })} />
              </Field>
              <Field label="Warranty expiry">
                <input type="date" className="input" value={edit.warranty_expiry} onChange={(e) => setEdit({ ...edit, warranty_expiry: e.target.value })} />
              </Field>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label !mb-0">Photo</span>
                <div className="flex gap-3 text-xs font-medium text-slate-600">
                  {['url', 'file'].map((m) => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={imageMode === m} onChange={() => setImageMode(m)} />
                      {m === 'url' ? 'Image URL' : 'Upload file'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {imageMode === 'url'
                  ? <input className="input" placeholder="https://…" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} />
                  : <input type="file" accept="image/*" className="input" onChange={handleFile} />
                }
                {edit.image_url && <img src={edit.image_url} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-200 shrink-0" />}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded accent-indigo-600" checked={edit.is_bookable} onChange={(e) => setEdit({ ...edit, is_bookable: e.target.checked })} />
              Shared / bookable resource
            </label>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmations */}
      {confirm && (
        <ConfirmModal
          title={confirm.type === 'delete' ? 'Delete asset' : `Mark as ${confirm.status?.replace('_', ' ')}`}
          message={confirm.type === 'delete'
            ? <>You are about to permanently delete <strong>{asset.asset_tag} — {asset.name}</strong>. This cannot be undone.</>
            : <>Change status of <strong>{asset.asset_tag}</strong> from <strong>{asset.status.replace('_', ' ')}</strong> to <strong>{confirm.status?.replace('_', ' ')}</strong>?</>}
          confirmLabel={confirm.type === 'delete' ? 'Delete' : 'Change Status'}
          danger={confirm.type === 'delete' || ['lost', 'disposed'].includes(confirm.status)}
          busy={busy}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Photo lightbox */}
      {activePhoto && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setActivePhoto(null)}>
          <div className="relative max-w-3xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <img src={activePhoto} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 bg-slate-950/50 text-white rounded-full p-2 hover:bg-slate-950/70 cursor-pointer">
              <Icon path={ICONS.close} className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
