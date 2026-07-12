// The conflict-rule demo lives here: allocating a taken asset shows the holder + a Transfer Request button
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, PageHeader, Field, Modal, ErrorBanner,
  EmptyState, TableSkeleton,
} from '../components/ui';

const TRANSFER_BADGE = {
  pending:  'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
};

function ReturnModal({ allocation, onClose, onDone }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/allocations/${allocation.id}/return`, {
        method: 'POST',
        body: { return_notes: notes, condition: condition || undefined },
      });
      toast.success(`${allocation.asset_tag} returned — status is Available again`);
      onDone();
    } catch (err) { toast.error(err.message); setBusy(false); }
  };

  return (
    <Modal
      title="Mark as Returned"
      subtitle={`${allocation.asset_tag} — ${allocation.asset_name} · held by ${allocation.employee_name || allocation.department_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Condition on check-in" hint="Optional — updates the asset's condition record.">
          <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">Unchanged</option>
            {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Check-in notes">
          <textarea
            className="input resize-none" rows={3} autoFocus
            placeholder="e.g. Returned with charger, minor scratch on lid…"
            value={notes} onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-success" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm Return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Allocations() {
  const { user } = useAuth();
  const toast = useToast();
  const [allocations, setAllocations] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ asset_id: '', employee_id: '', expected_return_date: '' });
  const [conflict, setConflict] = useState(null); // { message, asset_id }
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('active'); // active | returned | all

  const load = () => {
    api('/allocations').then(setAllocations).catch((e) => setError(e.message));
    api('/allocations/transfers').then(setTransfers).catch(() => {});
    api('/assets').then(setAssets).catch(() => {});
    api('/org/employees').then(setEmployees).catch(() => {});
  };
  useEffect(load, []);

  const allocate = async (e) => {
    e.preventDefault();
    setError(''); setConflict(null); setBusy(true);
    try {
      await api('/allocations', { method: 'POST', body: {
        asset_id: Number(form.asset_id), employee_id: Number(form.employee_id),
        expected_return_date: form.expected_return_date || null,
      }});
      const asset = assets.find((a) => a.id === Number(form.asset_id));
      toast.success(`${asset?.asset_tag || 'Asset'} allocated`);
      setForm({ asset_id: '', employee_id: '', expected_return_date: '' });
      load();
    } catch (err) {
      // 409 = conflict rule: show holder and offer a Transfer Request instead
      if (err.status === 409 && err.data.held_by) setConflict({ message: err.message, asset_id: Number(form.asset_id) });
      else setError(err.message);
    } finally { setBusy(false); }
  };

  const requestTransfer = async () => {
    setBusy(true);
    try {
      await api('/allocations/transfers', { method: 'POST', body: {
        asset_id: conflict.asset_id, to_employee_id: Number(form.employee_id),
        reason: 'Requested after allocation conflict',
      }});
      toast.success('Transfer request submitted for approval');
      setConflict(null);
      setForm({ asset_id: '', employee_id: '', expected_return_date: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const decideTransfer = async (id, action) => {
    try {
      await api(`/allocations/transfers/${id}`, { method: 'PUT', body: { action } });
      toast[action === 'approve' ? 'success' : 'info'](`Transfer ${action}d${action === 'approve' ? ' — asset re-allocated' : ''}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const canManage = ['admin', 'asset_manager', 'dept_head'].includes(user.role);

  // Dept head can only approve/reject transfers where the destination is their department;
  // admins and asset managers can decide any transfer.
  const canDecideTransfer = (t) => {
    if (['admin', 'asset_manager'].includes(user.role)) return true;
    if (user.role === 'dept_head') {
      return (
        (t.to_department_id && t.to_department_id === user.department_id) ||
        (t.to_employee_dept_id && t.to_employee_dept_id === user.department_id)
      );
    }
    return false;
  };

  const list = allocations ?? [];
  const activeCount = list.filter((a) => a.status === 'active').length;
  const overdueCount = list.filter((a) => a.is_overdue).length;
  const pendingTransfers = transfers.filter((t) => t.status === 'pending').length;
  const visible = list.filter((a) =>
    view === 'all' ? true : view === 'active' ? a.status === 'active' : a.status !== 'active');

  return (
    <div className="space-y-5">
      <PageHeader title="Allocations & Transfers" subtitle="Who holds what — with conflict rules, transfers, and return check-ins." />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 stagger">
        {[
          { label: 'Active Allocations', val: activeCount,      tone: 'text-indigo-600 bg-indigo-50 border-indigo-200/70', icon: ICONS.box },
          { label: 'Overdue Returns',    val: overdueCount,     tone: 'text-rose-600 bg-rose-50 border-rose-200/70',       icon: ICONS.alert },
          { label: 'Pending Transfers',  val: pendingTransfers, tone: 'text-violet-600 bg-violet-50 border-violet-200/70', icon: ICONS.transfer },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-3 p-4 rounded-2xl border ${s.tone}`}>
            <Icon path={s.icon} className="h-5 w-5 shrink-0" />
            <div>
              <div className="text-xl font-bold tabular-nums leading-none">{s.val}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75 mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Allocate form */}
      {canManage && (
        <form onSubmit={allocate} className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">New Allocation</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="Asset" required className="grow max-w-sm min-w-52">
              <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
                <option value="">Select asset…</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.name} ({a.status.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employee" required className="grow max-w-xs min-w-44">
              <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                <option value="">Select employee…</option>
                {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Expected return (optional)">
              <input className="input" type="date" value={form.expected_return_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
            </Field>
            <button className="btn" disabled={busy}>{busy ? 'Allocating…' : 'Allocate'}</button>
          </div>
        </form>
      )}

      {/* Conflict card — the demo moment */}
      {conflict && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up">
          <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
            <Icon path={ICONS.warning} className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-900">Allocation blocked — asset already taken</div>
            <p className="text-sm text-amber-800 mt-0.5">{conflict.message}. You can raise a transfer request instead; it will need approval.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn-secondary" onClick={() => setConflict(null)}>Dismiss</button>
            <button className="btn" onClick={requestTransfer} disabled={busy}>
              <Icon path={ICONS.transfer} className="h-4 w-4" /> Request Transfer Instead
            </button>
          </div>
        </div>
      )}

      {/* Allocations table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-wrap gap-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Allocation Registry</h2>
          <div className="flex gap-1.5">
            {[['active', 'Active'], ['returned', 'Returned'], ['all', 'All']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className={view === v ? 'pill-on' : 'pill-off'}>{label}</button>
            ))}
          </div>
        </div>
        {!allocations ? (
          <TableSkeleton rows={5} cols={6} />
        ) : visible.length === 0 ? (
          <EmptyState icon={ICONS.box} title="No allocations here"
            sub={view === 'active' ? 'Allocate an asset above to see it listed.' : 'Nothing matches this filter yet.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Asset</th><th className="th">Holder</th><th className="th">Allocated</th>
                  <th className="th">Expected Return</th><th className="th">Status</th><th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((al) => (
                  <tr key={al.id} className={al.is_overdue ? 'bg-rose-50/60' : 'hover:bg-slate-50/60 transition-colors'}>
                    <td className="td">
                      <span className="font-mono text-xs font-bold text-indigo-600">{al.asset_tag}</span>
                      <span className="text-slate-700 ml-2">{al.asset_name}</span>
                    </td>
                    <td className="td font-medium text-slate-700">{al.employee_name || al.department_name}</td>
                    <td className="td text-slate-500 tabular-nums">{new Date(al.allocated_at).toLocaleDateString()}</td>
                    <td className="td">
                      <span className="text-slate-600 tabular-nums">
                        {al.expected_return_date ? new Date(al.expected_return_date).toLocaleDateString() : <span className="text-slate-300">—</span>}
                      </span>
                      {al.is_overdue && (
                        <span className="badge bg-rose-100 text-rose-700 border border-rose-200 ml-2 !text-[10px] font-bold uppercase">Overdue</span>
                      )}
                    </td>
                    <td className="td">
                      <span className={`badge capitalize ${al.status === 'active' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {al.status}
                      </span>
                    </td>
                    <td className="td text-right">
                      {al.status === 'active' && (
                        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setReturning(al)}>
                          Mark Returned
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Requests */}
      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Icon path={ICONS.transfer} className="h-3.5 w-3.5" /> Transfer Requests
          {pendingTransfers > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 normal-case">{pendingTransfers} pending</span>
          )}
        </h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No transfer requests yet. They appear when someone requests an already-allocated asset.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-mono text-xs font-bold text-indigo-600">{t.asset_tag}</span>
                    <span className="mx-1.5 text-slate-400">→</span>
                    <span className="font-semibold text-slate-800">{t.to_employee_name || t.to_department_name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Requested by {t.requested_by_name}
                    {t.reason && <span className="italic"> · "{t.reason}"</span>}
                    {t.decided_by_name && <span> · decided by {t.decided_by_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge capitalize ${TRANSFER_BADGE[t.status]}`}>{t.status}</span>
                  {t.status === 'pending' && canDecideTransfer(t) && (
                    <>
                      <button
                        className="px-2.5 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 transition-all cursor-pointer"
                        onClick={() => decideTransfer(t.id, 'approve')}>
                        Approve
                      </button>
                      <button
                        className="px-2.5 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-200 transition-all cursor-pointer"
                        onClick={() => decideTransfer(t.id, 'reject')}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {returning && (
        <ReturnModal
          allocation={returning}
          onClose={() => setReturning(null)}
          onDone={() => { setReturning(null); load(); }}
        />
      )}
    </div>
  );
}
