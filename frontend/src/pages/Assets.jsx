import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, PageHeader, Field, Modal, ErrorBanner,
  StatusBadge, ASSET_STATUS, EmptyState, TableSkeleton, useDebounce,
} from '../components/ui';

const EMPTY_FORM = {
  name: '', category_id: '', serial_number: '', location: '',
  brand: '', model: '', vendor: '', warranty_expiry: '',
  acquisition_date: '', acquisition_cost: '', condition: 'good',
  is_bookable: false, image_url: '', imageMode: 'url',
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function RegisterModal({ categories, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB.'); e.target.value = ''; return; }
    set({ image_url: await toBase64(file) });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.acquisition_cost && Number(form.acquisition_cost) < 0) { setError('Cost cannot be negative.'); return; }
    setBusy(true);
    try {
      const { imageMode, ...rest } = form;
      const asset = await api('/assets', {
        method: 'POST',
        body: {
          ...rest,
          category_id: Number(rest.category_id),
          acquisition_cost: rest.acquisition_cost ? Number(rest.acquisition_cost) : null,
          acquisition_date: rest.acquisition_date || null,
          warranty_expiry: rest.warranty_expiry || null,
        },
      });
      toast.success(`Asset registered as ${asset.asset_tag}`);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Register Asset" subtitle="A unique asset tag (AF-xxxx) is generated automatically." onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Asset name" required className="sm:col-span-2">
            <input className="input" placeholder='e.g. MacBook Pro 14"' value={form.name} onChange={(e) => set({ name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Category" required>
            <select className="input" value={form.category_id} onChange={(e) => set({ category_id: e.target.value })} required>
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Serial number">
            <input className="input" placeholder="e.g. SN-49301" value={form.serial_number} onChange={(e) => set({ serial_number: e.target.value })} />
          </Field>
          <Field label="Brand">
            <input className="input" placeholder="e.g. Dell, Apple" value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
          </Field>
          <Field label="Model">
            <input className="input" placeholder="e.g. Latitude 5440" value={form.model} onChange={(e) => set({ model: e.target.value })} />
          </Field>
          <Field label="Location">
            <input className="input" placeholder="e.g. HQ Floor 2" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Condition">
            <select className="input" value={form.condition} onChange={(e) => set({ condition: e.target.value })}>
              {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Vendor / Supplier">
            <input className="input" placeholder="e.g. Ingram Micro" value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} />
          </Field>
          <Field label="Warranty expiry">
            <input type="date" className="input" value={form.warranty_expiry} onChange={(e) => set({ warranty_expiry: e.target.value })} />
          </Field>
          <Field label="Acquisition date">
            <input type="date" className="input" value={form.acquisition_date} onChange={(e) => set({ acquisition_date: e.target.value })} />
          </Field>
          <Field label="Acquisition cost (₹)" hint="Used for rankings and reports only.">
            <input type="number" min="0" step="0.01" className="input" placeholder="e.g. 85000" value={form.acquisition_cost} onChange={(e) => set({ acquisition_cost: e.target.value })} />
          </Field>
        </div>

        {/* Photo */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="label !mb-0">Photo (optional)</span>
            <div className="flex gap-3 text-xs font-medium text-slate-600">
              {['url', 'file'].map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="imageMode" checked={form.imageMode === m} onChange={() => set({ imageMode: m, image_url: '' })} />
                  {m === 'url' ? 'Image URL' : 'Upload file'}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {form.imageMode === 'url'
              ? <input className="input" placeholder="https://…" value={form.image_url} onChange={(e) => set({ image_url: e.target.value })} />
              : <input type="file" accept="image/*" className="input" onChange={handleFile} />
            }
            {form.image_url && <img src={form.image_url} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-200 shrink-0" />}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
          <input type="checkbox" className="h-4 w-4 rounded accent-indigo-600" checked={form.is_bookable} onChange={(e) => set({ is_bookable: e.target.checked })} />
          <span>
            Shared / bookable resource
            <span className="block text-xs text-slate-400 font-normal">Rooms, vehicles, projectors — anything booked by time slot.</span>
          </span>
        </label>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Register Asset'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Assets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState(null);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(searchParams.get('register') === '1');
  const [error, setError] = useState('');
  const debouncedQ = useDebounce(q, 300);

  const load = () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    api(`/assets?${params}`).then(setAssets).catch((e) => setError(e.message));
  };

  useEffect(load, [debouncedQ, status, category]);
  useEffect(() => { api('/org/categories').then(setCategories).catch(() => {}); }, []);

  const canRegister = ['admin', 'asset_manager'].includes(user.role);

  const closeForm = () => {
    setShowForm(false);
    if (searchParams.get('register')) {
      searchParams.delete('register');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Assets" subtitle="Register, search, and track every asset through its lifecycle.">
        {canRegister && (
          <button className="btn" onClick={() => setShowForm(true)}>
            <Icon path={ICONS.plus} /> Register Asset
          </button>
        )}
      </PageHeader>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {showForm && <RegisterModal categories={categories} onClose={closeForm} onSaved={() => { closeForm(); load(); }} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative grow max-w-sm min-w-56">
          <Icon path={ICONS.search} className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input className="input pl-9" placeholder="Search tag, serial, or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input max-w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(ASSET_STATUS).map(([s, meta]) => <option key={s} value={s}>{meta.label}</option>)}
        </select>
        {assets && (
          <span className="ml-auto text-xs font-semibold text-slate-400 tabular-nums">
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {!assets ? (
          <TableSkeleton rows={6} cols={6} />
        ) : assets.length === 0 ? (
          <EmptyState
            icon={ICONS.box}
            title="No assets found"
            sub={q || status || category ? 'Try adjusting your search or filters.' : 'Register your first asset to get started.'}
          >
            {canRegister && !q && !status && !category && (
              <button className="btn" onClick={() => setShowForm(true)}>
                <Icon path={ICONS.plus} /> Register Asset
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Asset</th>
                  <th className="th">Category</th>
                  <th className="th">Status</th>
                  <th className="th">Holder</th>
                  <th className="th">Location</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/assets/${a.id}`)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="td">
                      <div className="flex items-center gap-3">
                        {a.image_url ? (
                          <img src={a.image_url} alt="" className="h-9 w-9 object-cover rounded-lg border border-slate-200 shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Icon path={ICONS.box} className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 truncate">{a.name}</span>
                            {a.is_bookable && (
                              <span className="px-1.5 py-px rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider shrink-0">
                                Bookable
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {a.asset_tag}{a.serial_number ? ` · ${a.serial_number}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600">{a.category_name}</td>
                    <td className="td"><StatusBadge status={a.status} /></td>
                    <td className="td text-slate-600">{a.holder_name || a.holder_department || <span className="text-slate-300">—</span>}</td>
                    <td className="td text-slate-600">{a.location || <span className="text-slate-300">—</span>}</td>
                    <td className="td text-right pr-5">
                      <Icon path={ICONS.chevronR} className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
