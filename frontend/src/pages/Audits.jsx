// OWNER: P4 — cycle detail drill-down (mark each asset verified/missing/damaged), discrepancy report view
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Audits() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [depts, setDepts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null); // detailed cycle with asset checklist
  const [form, setForm] = useState({ name: '', scope_department_id: '', start_date: '', end_date: '', auditor_ids: [] });
  const [error, setError] = useState('');

  const load = () => {
    api('/audits').then(setCycles);
    api('/org/departments').then(setDepts);
    api('/org/employees').then(setEmployees);
  };
  useEffect(load, []);

  const openCycle = (id) => api(`/audits/${id}`).then(setSelected).catch((e) => setError(e.message));

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/audits', { method: 'POST', body: {
        ...form, scope_department_id: form.scope_department_id ? Number(form.scope_department_id) : null,
      }});
      setForm({ name: '', scope_department_id: '', start_date: '', end_date: '', auditor_ids: [] });
      load();
    } catch (err) { setError(err.message); }
  };

  const mark = async (assetId, result) => {
    const notes = result !== 'verified' ? prompt('Notes for the discrepancy?') || '' : '';
    try {
      await api(`/audits/${selected.id}/records`, { method: 'POST', body: { asset_id: assetId, result, notes } });
      openCycle(selected.id);
    } catch (err) { setError(err.message); }
  };

  const close = async () => {
    if (!confirm('Close this cycle? Missing assets will be marked Lost. This locks the cycle.')) return;
    await api(`/audits/${selected.id}/close`, { method: 'POST' });
    setSelected(null);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Cycles</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      {user.role === 'admin' && (
        <form onSubmit={create} className="card flex flex-wrap gap-3 items-end">
          <input className="input max-w-xs" placeholder="Cycle name (e.g. Q3 IT Audit)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="input max-w-xs" value={form.scope_department_id} onChange={(e) => setForm({ ...form, scope_department_id: e.target.value })}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
          <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          <select className="input max-w-xs" multiple value={form.auditor_ids}
            onChange={(e) => setForm({ ...form, auditor_ids: [...e.target.selectedOptions].map((o) => Number(o.value)) })}>
            {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn">Create Cycle</button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {cycles.map((c) => (
            <button key={c.id} onClick={() => openCycle(c.id)}
              className={`card w-full text-left cursor-pointer hover:border-indigo-300 ${selected?.id === c.id ? 'border-indigo-500' : ''}`}>
              <div className="flex justify-between">
                <span className="font-semibold">{c.name}</span>
                <span className={`badge ${c.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{c.status}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {c.department_name || 'All departments'} · {new Date(c.start_date).toLocaleDateString()} – {new Date(c.end_date).toLocaleDateString()}
                · {c.records_count} checked · <span className="text-red-600">{c.discrepancy_count} discrepancies</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Auditors: {(c.auditors || []).map((a) => a.name).join(', ') || 'none'}</div>
            </button>
          ))}
          {cycles.length === 0 && <p className="text-sm text-gray-400">No audit cycles yet.</p>}
        </div>

        {selected && (
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">{selected.name} — checklist</h2>
              {selected.status === 'open' && <button className="btn" onClick={close}>Close Cycle</button>}
            </div>
            {selected.assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-2 border-t border-gray-100">
                <span className="font-mono">{a.asset_tag} <span className="font-sans">{a.name}</span>
                  {a.result && <span className={`badge ml-2 ${a.result === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{a.result}</span>}
                </span>
                {selected.status === 'open' && (
                  <span className="flex gap-1">
                    <button className="btn-secondary" onClick={() => mark(a.id, 'verified')}>✓</button>
                    <button className="btn-secondary" onClick={() => mark(a.id, 'missing')}>Missing</button>
                    <button className="btn-secondary" onClick={() => mark(a.id, 'damaged')}>Damaged</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
