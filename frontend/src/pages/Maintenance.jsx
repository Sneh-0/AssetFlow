import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, PageHeader, Field, Modal, ErrorBanner,
  EmptyState, TableSkeleton,
} from '../components/ui';

const STATUS_BADGE = {
  pending:     'bg-amber-50 text-amber-700 border border-amber-200',
  approved:    'bg-sky-50 text-sky-700 border border-sky-200',
  rejected:    'bg-rose-50 text-rose-700 border border-rose-200',
  assigned:    'bg-violet-50 text-violet-700 border border-violet-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  resolved:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const PRIORITY_BADGE = {
  critical: 'bg-rose-100 text-rose-800 border border-rose-200',
  high:     'bg-orange-100 text-orange-800 border border-orange-200',
  medium:   'bg-amber-50 text-amber-700 border border-amber-200',
  low:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

// Which transitions each status offers, plus how to style them
const NEXT = { pending: ['approve', 'reject'], approved: ['assign'], assigned: ['start', 'resolve'], in_progress: ['resolve'] };
const ACTION_STYLE = {
  approve: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white',
  reject:  'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white',
  assign:  'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-600 hover:text-white',
  start:   'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white',
  resolve: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white',
};

const WORKFLOW = ['Pending', 'Approved', 'Assigned', 'In Progress', 'Resolved'];

export default function Maintenance() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ asset_id: '', issue: '', priority: 'medium' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null);

  // Technician assignment modal
  const [technicians, setTechnicians] = useState([]);
  const [assigning, setAssigning] = useState(null); // request id
  const [selectedTechId, setSelectedTechId] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const load = () => {
    api('/maintenance').then(setRequests).catch((e) => setError(e.message));
    if (user && user.role === 'employee') {
      // Employees can only raise requests for assets they currently hold
      api('/allocations?mine=true&active=true').then((allocs) => {
        setAssets(allocs.map((al) => ({ id: al.asset_id, asset_tag: al.asset_tag, name: al.asset_name })));
      }).catch(() => {});
    } else {
      api('/assets').then(setAssets).catch(() => {});
    }
  };
  useEffect(load, [user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm((f) => ({ ...f, photo_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const raise = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api('/maintenance', { method: 'POST', body: { ...form, asset_id: Number(form.asset_id) } });
      toast.success('Maintenance request raised — awaiting approval');
      setForm({ asset_id: '', issue: '', priority: 'medium', photo_url: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const act = async (id, action) => {
    if (action === 'assign') {
      try {
        const data = await api('/technicians');
        setTechnicians(data.filter((t) => t.status === 'active'));
        setAssigning(id);
      } catch (err) { toast.error(err.message); }
      return;
    }
    try {
      await api(`/maintenance/${id}`, { method: 'PUT', body: { action } });
      const messages = {
        approve: 'Request approved — asset moved to Under Maintenance',
        reject: 'Request rejected',
        start: 'Work started',
        resolve: 'Resolved — asset status restored',
      };
      toast[action === 'reject' ? 'info' : 'success'](messages[action] || 'Updated');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const assignTechnician = async (e) => {
    e.preventDefault();
    if (!selectedTechId) return;
    try {
      await api(`/maintenance/${assigning}`, { method: 'PUT', body: { action: 'assign', technician_id: Number(selectedTechId) } });
      const tech = technicians.find((t) => t.id === Number(selectedTechId));
      toast.success(`Assigned to ${tech?.name || 'technician'}`);
      setAssigning(null); setSelectedTechId('');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const isManager = ['admin', 'asset_manager'].includes(user?.role);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, active: 0, resolved: 0 };
    (requests || []).forEach((m) => {
      if (m.status === 'pending') c.pending++;
      else if (m.status === 'approved') c.approved++;
      else if (['assigned', 'in_progress'].includes(m.status)) c.active++;
      else if (m.status === 'resolved') c.resolved++;
    });
    return c;
  }, [requests]);

  const filtered = (requests || []).filter((m) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !['assigned', 'in_progress'].includes(m.status)) return false;
      if (statusFilter !== 'active' && m.status !== statusFilter) return false;
    }
    if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Maintenance" subtitle="Repairs route through approval before work starts — asset status updates automatically." />

      {/* Workflow legend */}
      <div className="flex items-center gap-1 flex-wrap text-[11px] font-semibold text-slate-400">
        {WORKFLOW.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">{step}</span>
            {i < WORKFLOW.length - 1 && <Icon path={ICONS.chevronR} className="h-3 w-3" />}
          </span>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Raise form */}
      <form onSubmit={raise} className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Raise Maintenance Request</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Asset" required className="grow max-w-xs min-w-48">
            <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
              <option value="">Select asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
            </select>
          </Field>
          <Field label="Issue" required className="grow max-w-md min-w-56">
            <input className="input" placeholder="Describe the problem…" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} required />
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Attach photo (optional)" className="grow max-w-xs">
            <input
              type="file" accept="image/*" ref={fileInputRef}
              className="input file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              onChange={handlePhotoChange}
            />
          </Field>
          {form.photo_url && (
            <div className="flex items-center gap-2 pb-0.5">
              <img src={form.photo_url} alt="Preview" className="h-10 w-10 object-cover rounded-lg border border-slate-200" />
              <button type="button" className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                onClick={() => { setForm((f) => ({ ...f, photo_url: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                Clear
              </button>
            </div>
          )}
          <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Raise Request'}</button>
        </div>
      </form>

      {/* Stat chips + filters */}
      {isManager && (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-1.5 items-center">
            {[
              { id: 'all',      label: `All (${(requests || []).length})` },
              { id: 'pending',  label: `Pending (${counts.pending})` },
              { id: 'approved', label: `Approved (${counts.approved})` },
              { id: 'active',   label: `Under Repair (${counts.active})` },
              { id: 'resolved', label: `Resolved (${counts.resolved})` },
              { id: 'rejected', label: 'Rejected' },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setStatusFilter(f.id)}
                className={statusFilter === f.id ? 'pill-on' : 'pill-off'}>
                {f.label}
              </button>
            ))}
          </div>
          <select className="input max-w-40 !py-1.5" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">All priorities</option>
            {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Requests table */}
      <div className="card p-0 overflow-hidden">
        {!requests ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ICONS.wrench} title="No maintenance requests"
            sub={statusFilter !== 'all' || priorityFilter !== 'all' ? 'Nothing matches these filters.' : 'Raise a request above when an asset needs repair.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Asset</th>
                  <th className="th">Issue</th>
                  <th className="th">Photo</th>
                  <th className="th">Priority</th>
                  <th className="th">Raised By</th>
                  <th className="th">Status</th>
                  {isManager && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td font-mono text-xs font-bold text-indigo-600">{m.asset_tag}</td>
                    <td className="td">
                      <div className="text-slate-800 max-w-64 truncate" title={m.issue}>{m.issue}</div>
                      {m.technician_name && (
                        <div className="text-xs text-violet-600 font-semibold mt-0.5 flex items-center gap-1">
                          <Icon path={ICONS.users} className="h-3 w-3" />
                          {m.technician_name}{m.technician_specialty ? ` · ${m.technician_specialty}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="td">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="Issue" onClick={() => setActivePhoto(m.photo_url)}
                          className="h-10 w-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-85 hover:scale-105 transition-all" />
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="td">
                      <span className={`badge capitalize ${PRIORITY_BADGE[m.priority]}`}>{m.priority}</span>
                    </td>
                    <td className="td text-slate-600">{m.raised_by_name}</td>
                    <td className="td">
                      <span className={`badge capitalize ${STATUS_BADGE[m.status]}`}>{m.status.replace('_', ' ')}</span>
                    </td>
                    {isManager && (
                      <td className="td text-right whitespace-nowrap space-x-1.5">
                        {(NEXT[m.status] || []).map((a) => (
                          <button key={a} onClick={() => act(m.id, a)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all cursor-pointer ${ACTION_STYLE[a]}`}>
                            {a.replace('_', ' ')}
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {activePhoto && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setActivePhoto(null)}>
          <div className="relative max-w-3xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <img src={activePhoto} alt="Maintenance issue" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 bg-slate-950/50 text-white rounded-full p-2 hover:bg-slate-950/70 cursor-pointer">
              <Icon path={ICONS.close} className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Assign technician modal */}
      {assigning && (
        <Modal title="Assign Technician" subtitle="Pick who takes on this repair." onClose={() => { setAssigning(null); setSelectedTechId(''); }} maxWidth="max-w-md">
          <form onSubmit={assignTechnician} className="space-y-4">
            <Field label="Technician" required>
              <select className="input" value={selectedTechId} onChange={(e) => setSelectedTechId(e.target.value)} required>
                <option value="">Select…</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.specialty || 'General'}) — {t.active_requests_count} active job{Number(t.active_requests_count) !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              {technicians.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <Icon path={ICONS.warning} className="h-3.5 w-3.5" />
                  No active technicians. Register one in Org Setup → Technicians first.
                </p>
              )}
            </Field>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" className="btn-secondary" onClick={() => { setAssigning(null); setSelectedTechId(''); }}>Cancel</button>
              <button type="submit" className="btn" disabled={!selectedTechId}>Confirm Assignment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
