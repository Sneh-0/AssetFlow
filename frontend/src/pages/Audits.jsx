// OWNER: P4 — cycle detail drill-down (mark each asset verified/missing/damaged), discrepancy report view
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const Icon = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const RESULT_CONFIG = {
  verified: { label: 'Verified',  bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  missing:  { label: 'Missing',   bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
  damaged:  { label: 'Damaged',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  unchecked:{ label: 'Unchecked', bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-500',    dot: 'bg-gray-300'    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ result, count }) {
  const cfg = RESULT_CONFIG[result];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`text-[11px] font-bold ${cfg.text}`}>{count}</span>
      <span className={`text-[10px] ${cfg.text} opacity-70`}>{cfg.label}</span>
    </div>
  );
}

function MarkPanel({ asset, onSave, onClose, saving }) {
  const [result, setResult] = useState(asset.result || 'verified');
  const [notes, setNotes] = useState(asset.notes || '');

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* slide-in panel */}
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-slide-in">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Record Audit Result</h3>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{asset.asset_tag} — {asset.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon d="M6 18L18 6M6 6l12 12" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Result</label>
            <div className="flex flex-col gap-2">
              {['verified', 'missing', 'damaged'].map((r) => {
                const cfg = RESULT_CONFIG[r];
                const active = result === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResult(r)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                      active ? `${cfg.bg} ${cfg.border} shadow-sm` : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${active ? cfg.border : 'border-gray-300'}`}>
                      {active && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                    </span>
                    <span className={`text-sm font-semibold ${active ? cfg.text : 'text-gray-600'}`}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {result !== 'verified' && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                Discrepancy Notes <span className="text-rose-400">*</span>
              </label>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder="Describe the discrepancy — condition, location, circumstances..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          )}

          {result === 'verified' && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Notes (optional)</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Any observations or comments..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1 border border-gray-100">
            <div><span className="font-semibold">Location:</span> {asset.location || '—'}</div>
            <div><span className="font-semibold">Current Status:</span> <span className="capitalize">{asset.status}</span></div>
            {asset.result && (
              <div><span className="font-semibold">Previously:</span> {asset.result} by {asset.audited_by_name} · {timeAgo(asset.audited_at)}</div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-secondary cursor-pointer"
          >Cancel</button>
          <button
            type="button"
            disabled={saving || (result !== 'verified' && !notes.trim())}
            onClick={() => onSave(asset.id, result, notes)}
            className={`flex-1 btn cursor-pointer disabled:opacity-50 ${
              result === 'missing' ? 'bg-rose-600 hover:bg-rose-700' : result === 'damaged' ? 'bg-amber-600 hover:bg-amber-700' : ''
            }`}
          >
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseConfirmModal({ cycle, summary, onConfirm, onCancel, closing }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
            <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Close Audit Cycle</h3>
            <p className="text-xs text-gray-400">This action is irreversible</p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          You are about to close <strong>"{cycle.name}"</strong>. The following will occur:
        </p>

        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
          {[
            { label: 'Assets checked',   val: (summary?.counts?.verified || 0) + (summary?.counts?.missing || 0) + (summary?.counts?.damaged || 0), color: 'text-gray-700' },
            { label: 'Still unchecked',  val: summary?.counts?.unchecked || 0,  color: summary?.counts?.unchecked > 0 ? 'text-amber-600 font-bold' : 'text-gray-700' },
            { label: 'Marked Missing → will be set to Lost', val: summary?.counts?.missing || 0, color: summary?.counts?.missing > 0 ? 'text-rose-600 font-bold' : 'text-gray-700' },
            { label: 'Discrepancies flagged', val: (summary?.counts?.missing || 0) + (summary?.counts?.damaged || 0), color: 'text-gray-700' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-gray-500">{label}</span>
              <span className={color}>{val}</span>
            </div>
          ))}
        </div>

        {(summary?.counts?.unchecked || 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-medium">
            Warning: {summary.counts.unchecked} asset{summary.counts.unchecked !== 1 ? 's' : ''} have not been checked. They will remain in their current status.
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 btn-secondary cursor-pointer">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={closing}
            className="flex-1 btn bg-rose-600 hover:bg-rose-700 cursor-pointer disabled:opacity-50"
          >
            {closing ? 'Closing…' : 'Yes, Close Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Audits() {
  const { user } = useAuth();
  const [cycles, setCycles]       = useState([]);
  const [depts, setDepts]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [summary, setSummary]     = useState(null);

  // UI state
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [showEditModal, setShowEditModal]           = useState(false);
  const [showCloseModal, setShowCloseModal]         = useState(false);
  const [markingAsset, setMarkingAsset]             = useState(null); // asset being marked in slide-in panel
  const [savingMark, setSavingMark]                 = useState(false);
  const [closingCycle, setClosingCycle]             = useState(false);
  const [viewMode, setViewMode]                     = useState('checklist');
  const [search, setSearch]                         = useState('');
  const [resultFilter, setResultFilter]             = useState('all');
  const [error, setError]                           = useState('');

  const [form, setForm] = useState({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '', auditor_ids: [] });
  const [editForm, setEditForm] = useState({ name: '', start_date: '', end_date: '', auditor_ids: [] });

  const load = useCallback(() => {
    api('/audits').then(setCycles).catch(e => setError(e.message));
    api('/org/departments').then(setDepts);
    api('/org/employees').then(setEmployees);
  }, []);

  useEffect(load, [load]);

  const openCycle = (id) => {
    setError('');
    setSearch('');
    setResultFilter('all');
    setViewMode('checklist');
    Promise.all([api(`/audits/${id}`), api(`/audits/${id}/summary`)])
      .then(([data, sum]) => { setSelected(data); setSummary(sum); })
      .catch(e => setError(e.message));
  };

  const refreshSelected = () => {
    if (!selected) return;
    Promise.all([api(`/audits/${selected.id}`), api(`/audits/${selected.id}/summary`)])
      .then(([data, sum]) => { setSelected(data); setSummary(sum); });
  };

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/audits', { method: 'POST', body: {
        ...form,
        scope_department_id: form.scope_department_id ? Number(form.scope_department_id) : null,
        scope_location: form.scope_location || null,
      }});
      setForm({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '', auditor_ids: [] });
      setShowCreateModal(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const updateCycle = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/audits/${selected.id}`, { method: 'PUT', body: editForm });
      setShowEditModal(false);
      openCycle(selected.id);
      load();
    } catch (err) { setError(err.message); }
  };

  const saveMark = async (assetId, result, notes) => {
    setSavingMark(true);
    setError('');
    try {
      await api(`/audits/${selected.id}/records`, { method: 'POST', body: { asset_id: assetId, result, notes } });
      setMarkingAsset(null);
      refreshSelected();
    } catch (err) { setError(err.message); }
    finally { setSavingMark(false); }
  };

  const confirmClose = async () => {
    setClosingCycle(true);
    try {
      await api(`/audits/${selected.id}/close`, { method: 'POST' });
      setShowCloseModal(false);
      setSelected(null);
      setSummary(null);
      load();
    } catch (err) { setError(err.message); }
    finally { setClosingCycle(false); }
  };

  const exportCSV = () => {
    if (!selected) return;
    const discrepancies = selected.assets.filter(a => a.result && a.result !== 'verified');
    const headers = ['Asset Tag', 'Asset Name', 'Expected Location', 'Result', 'Notes', 'Audited By', 'Audited At'];
    const rows = discrepancies.map(a => [
      a.asset_tag, a.name, a.location || '—', a.result, a.notes || '',
      a.audited_by_name || '—', a.audited_at ? new Date(a.audited_at).toLocaleString() : '—',
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })),
      download: `audit_${selected.name.replace(/\s+/g, '_')}.csv`,
    });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const isAdminOrManager = ['admin', 'asset_manager'].includes(user?.role);
  const isAssignedAuditor = selected?.auditor_ids?.includes(user?.id);
  const canAudit = isAdminOrManager || isAssignedAuditor;
  const canCreate = isAdminOrManager;

  const discrepancies = selected ? selected.assets.filter(a => a.result && a.result !== 'verified') : [];

  const filteredAssets = selected ? selected.assets.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.asset_tag.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    const matchFilter = resultFilter === 'all'
      || (resultFilter === 'unchecked' && !a.result)
      || a.result === resultFilter;
    return matchSearch && matchFilter;
  }) : [];

  const totalCyclesCount      = cycles.length;
  const openCyclesCount       = cycles.filter(c => c.status === 'open').length;
  const totalDiscrepanciesCount = cycles.reduce((acc, c) => acc + (Number(c.discrepancy_count) || 0), 0);

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Asset Auditing</h1>
          <p className="text-sm text-gray-400 mt-0.5">Schedule cycles, assign auditors, record verifications, and resolve discrepancies.</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreateModal(true)} className="btn flex items-center gap-2 cursor-pointer shadow-sm">
            <Icon d="M12 4v16m8-8H4" className="h-4 w-4" />
            Create Audit Cycle
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        {[
          { label: 'Total Cycles',    val: totalCyclesCount,       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' },
          { label: 'Active Audits',   val: openCyclesCount,        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
          { label: 'Total Flags',     val: totalDiscrepanciesCount,icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' },
        ].map(k => (
          <div key={k.label} className={`card flex items-center gap-4 border ${k.border} ${k.bg}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${k.border} bg-white/60`}>
              <Icon d={k.icon} className={`h-5 w-5 ${k.text}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${k.text}`}>{k.val}</div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left — Cycles List */}
        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 pb-2">Audit Cycles Registry</div>
          <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-0.5">
            {cycles.length === 0 && <p className="text-sm text-gray-400 italic text-center py-8">No audit cycles recorded.</p>}
            {cycles.map(c => {
              const isOverdue = c.status === 'open' && new Date(c.end_date) < new Date();
              return (
                <button
                  key={c.id}
                  onClick={() => openCycle(c.id)}
                  className={`w-full text-left p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                    selected?.id === c.id
                      ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-400/30 shadow-sm'
                      : isOverdue ? 'border-rose-200 bg-rose-50/30 hover:border-rose-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="font-bold text-sm text-gray-800 leading-tight">{c.name}</span>
                    <span className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      c.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>{c.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 space-y-0.5">
                    <div>Scope: <span className="text-gray-600 font-medium">{c.department_name || 'All Departments'}</span></div>
                    {c.scope_location && <div>Location: <span className="text-gray-600 font-medium">{c.scope_location}</span></div>}
                    <div>{new Date(c.start_date).toLocaleDateString()} — {new Date(c.end_date).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold">{c.records_count} checked</span>
                    {Number(c.discrepancy_count) > 0 && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold">{c.discrepancy_count} flags</span>
                    )}
                    {isOverdue && <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">Overdue</span>}
                  </div>
                  {(c.auditors || []).length > 0 && (
                    <div className="mt-2 text-[10px] text-gray-400">
                      Auditors: <span className="text-gray-600 font-semibold">{c.auditors.map(a => a.name).join(', ')}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — Cycle Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="card border border-gray-200 space-y-4">

              {/* Cycle Header */}
              <div className="flex flex-wrap justify-between items-start gap-3 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-lg text-gray-900">{selected.name}</h2>
                  <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Scope: <strong className="text-gray-600">{selected.scope_department_id ? 'Departmental' : 'All Assets'}</strong></span>
                    {selected.scope_location && <span>Location: <strong className="text-gray-600">{selected.scope_location}</strong></span>}
                    <span>Period: <strong className="text-gray-600">{new Date(selected.start_date).toLocaleDateString()} – {new Date(selected.end_date).toLocaleDateString()}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selected.status === 'open' && isAdminOrManager && (
                    <>
                      <button
                        onClick={() => {
                          setEditForm({ name: selected.name, start_date: selected.start_date, end_date: selected.end_date, auditor_ids: selected.auditor_ids || [] });
                          setShowEditModal(true);
                        }}
                        className="btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="text-xs px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="h-3.5 w-3.5" />
                        Close Cycle
                      </button>
                    </>
                  )}
                  {selected.status === 'closed' && (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 font-bold border border-gray-200">Closed {selected.closed_at ? new Date(selected.closed_at).toLocaleDateString() : ''}</span>
                  )}
                </div>
              </div>

              {/* Progress breakdown */}
              {summary && (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Audit Progress</span>
                    <span className="text-xs text-gray-500">{summary.total - (summary.counts.unchecked || 0)} / {summary.total} checked</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex gap-px">
                    {['verified','missing','damaged'].map(r => {
                      const pct = summary.total > 0 ? ((summary.counts[r] || 0) / summary.total) * 100 : 0;
                      const cfg = RESULT_CONFIG[r];
                      return pct > 0 ? <div key={r} className={`h-full ${cfg.dot} transition-all`} style={{ width: `${pct}%` }} /> : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['verified','missing','damaged','unchecked'].map(r => (
                      <StatBadge key={r} result={r} count={summary.counts[r] || 0} />
                    ))}
                  </div>

                  {/* Auditor contributions */}
                  {summary.auditor_stats?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Auditor Progress</div>
                      <div className="flex flex-wrap gap-3">
                        {summary.auditor_stats.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">
                              {a.name.charAt(0)}
                            </div>
                            <span className="text-[11px] text-gray-600">{a.name.split(' ')[0]}</span>
                            <span className="text-[11px] font-bold text-indigo-600">{a.checked}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View toggle + export */}
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
                  {[['checklist', `Checklist (${selected.assets.length})`], ['discrepancies', `Discrepancies (${discrepancies.length})`]].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-4 py-2 cursor-pointer transition-colors ${viewMode === mode ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {viewMode === 'discrepancies' && discrepancies.length > 0 && (
                  <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5 ml-auto cursor-pointer">
                    <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                )}
              </div>

              {/* Permission notice */}
              {selected.status === 'open' && !canAudit && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 font-medium flex items-center gap-2">
                  <Icon d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4 shrink-0" />
                  View-only: You are not assigned as an auditor on this cycle.
                </div>
              )}

              {/* ── Checklist View ── */}
              {viewMode === 'checklist' && (
                <div className="space-y-3">
                  {/* Search + filter */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-48">
                      <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-9 text-sm"
                        placeholder="Search by tag or name…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {['all', 'unchecked', 'verified', 'missing', 'damaged'].map(f => {
                        const cfg = f === 'all' ? null : RESULT_CONFIG[f];
                        return (
                          <button
                            key={f}
                            onClick={() => setResultFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                              resultFilter === f
                                ? f === 'all' ? 'bg-gray-800 text-white border-gray-800' : `${cfg.bg} ${cfg.text} ${cfg.border}`
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {f === 'all' ? 'All' : RESULT_CONFIG[f].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Checklist items */}
                  <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto rounded-xl border border-gray-100">
                    {filteredAssets.length === 0 && (
                      <p className="text-center text-gray-400 text-sm italic py-8">No assets match your filter.</p>
                    )}
                    {filteredAssets.map(a => {
                      const resCfg = a.result ? RESULT_CONFIG[a.result] : null;
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-gray-800">{a.asset_tag}</span>
                              <span className="text-gray-600 text-sm truncate">{a.name}</span>
                              {resCfg && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold capitalize border ${resCfg.bg} ${resCfg.text} ${resCfg.border}`}>
                                  {a.result}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              {a.location && <span>Location: {a.location}</span>}
                              <span>Status: <span className="capitalize">{a.status}</span></span>
                              {a.result && (
                                <span className="text-indigo-500">
                                  by {a.audited_by_name} · {timeAgo(a.audited_at)}
                                </span>
                              )}
                            </div>
                            {a.notes && (
                              <div className="text-[11px] text-gray-500 italic mt-1 bg-gray-50 rounded px-2 py-0.5 inline-block border border-gray-100">
                                "{a.notes}"
                              </div>
                            )}
                          </div>

                          {selected.status === 'open' && canAudit && (
                            <button
                              onClick={() => setMarkingAsset(a)}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                                a.result
                                  ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              }`}
                            >
                              {a.result ? 'Update' : 'Record'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Discrepancy View ── */}
              {viewMode === 'discrepancies' && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="th">Asset</th>
                        <th className="th">Location</th>
                        <th className="th">Result</th>
                        <th className="th">Notes</th>
                        <th className="th">Audited By</th>
                        <th className="th">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discrepancies.length === 0 && (
                        <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">No discrepancies flagged. All checked assets are verified.</td></tr>
                      )}
                      {discrepancies.map(a => {
                        const cfg = RESULT_CONFIG[a.result];
                        return (
                          <tr key={a.id} className="hover:bg-gray-50/50">
                            <td className="td">
                              <div className="font-mono font-bold text-gray-800">{a.asset_tag}</div>
                              <div className="text-gray-500">{a.name}</div>
                            </td>
                            <td className="td text-gray-500">{a.location || '—'}</td>
                            <td className="td">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                {a.result}
                              </span>
                            </td>
                            <td className="td text-gray-500 italic max-w-xs">"{a.notes || 'No notes'}"</td>
                            <td className="td font-semibold text-gray-700">{a.audited_by_name || '—'}</td>
                            <td className="td text-gray-400">{timeAgo(a.audited_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 min-h-[450px]">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-800">No Cycle Selected</h3>
              <p className="text-xs text-gray-400 max-w-xs mt-2 leading-relaxed">Select an audit cycle from the left panel to view its checklist, record asset states, and track discrepancy reports.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Cycle Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900">Create Audit Cycle</h3>
                <p className="text-[10px] text-gray-400">Set scope, schedule, and auditor assignments.</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); setError(''); }} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100">
                <Icon d="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Cycle Name</label>
                  <input className="input" placeholder="e.g. Q3 IT Hardware Audit" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Department Scope</label>
                  <select className="input" value={form.scope_department_id} onChange={e => setForm({ ...form, scope_department_id: e.target.value })}>
                    <option value="">All Departments</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Location Filter</label>
                  <input className="input" placeholder="e.g. HQ Floor 2 (optional)" value={form.scope_location} onChange={e => setForm({ ...form, scope_location: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Start Date</label>
                  <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">End Date</label>
                  <input className="input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
                </div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Assign Auditors</span>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {employees.map(u => (
                    <label key={u.id} className="flex items-center gap-2.5 text-xs cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                      <input type="checkbox" className="h-4 w-4 rounded text-indigo-600 border-gray-300 cursor-pointer"
                        checked={form.auditor_ids.includes(u.id)}
                        onChange={e => setForm(prev => ({ ...prev, auditor_ids: e.target.checked ? [...prev.auditor_ids, u.id] : prev.auditor_ids.filter(id => id !== u.id) }))} />
                      {u.name} <span className="text-gray-400 font-normal">({u.role.replace('_', ' ')})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" className="btn-secondary cursor-pointer" onClick={() => { setShowCreateModal(false); setError(''); }}>Cancel</button>
                <button type="submit" className="btn cursor-pointer">Create Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Cycle Modal ── */}
      {showEditModal && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900">Edit Audit Cycle</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100">
                <Icon d="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <form onSubmit={updateCycle} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Cycle Name</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Start Date</label>
                  <input className="input" type="date" value={editForm.start_date?.split('T')[0]} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">End Date</label>
                  <input className="input" type="date" value={editForm.end_date?.split('T')[0]} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
                </div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Auditors</span>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {employees.map(u => (
                    <label key={u.id} className="flex items-center gap-2.5 text-xs cursor-pointer font-semibold text-gray-700">
                      <input type="checkbox" className="h-4 w-4 rounded text-indigo-600 border-gray-300 cursor-pointer"
                        checked={editForm.auditor_ids.includes(u.id)}
                        onChange={e => setEditForm(prev => ({ ...prev, auditor_ids: e.target.checked ? [...prev.auditor_ids, u.id] : prev.auditor_ids.filter(id => id !== u.id) }))} />
                      {u.name} <span className="text-gray-400 font-normal">({u.role.replace('_', ' ')})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" className="btn-secondary cursor-pointer" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Close Confirm Modal ── */}
      {showCloseModal && selected && (
        <CloseConfirmModal
          cycle={selected}
          summary={summary}
          onConfirm={confirmClose}
          onCancel={() => setShowCloseModal(false)}
          closing={closingCycle}
        />
      )}

      {/* ── Mark Asset Slide-in Panel ── */}
      {markingAsset && (
        <MarkPanel
          asset={markingAsset}
          onSave={saveMark}
          onClose={() => setMarkingAsset(null)}
          saving={savingMark}
        />
      )}
    </div>
  );
}
