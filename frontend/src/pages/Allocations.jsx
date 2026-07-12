// OWNER: P2 — the conflict-rule demo lives here: allocating a taken asset shows holder + Transfer Request button
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Allocations() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ asset_id: '', employee_id: '', expected_return_date: '' });
  const [conflict, setConflict] = useState(null); // { message, asset_id }
  const [error, setError] = useState('');

  const load = () => {
    api('/allocations').then(setAllocations);
    api('/allocations/transfers').then(setTransfers);
    api('/assets').then(setAssets);
    api('/org/employees').then(setEmployees);
  };
  useEffect(load, []);

  const allocate = async (e) => {
    e.preventDefault();
    setError(''); setConflict(null);
    try {
      await api('/allocations', { method: 'POST', body: {
        asset_id: Number(form.asset_id), employee_id: Number(form.employee_id),
        expected_return_date: form.expected_return_date || null,
      }});
      setForm({ asset_id: '', employee_id: '', expected_return_date: '' });
      load();
    } catch (err) {
      // 409 = conflict rule: show holder and offer Transfer Request instead
      if (err.status === 409 && err.data.held_by) setConflict({ message: err.message, asset_id: Number(form.asset_id) });
      else setError(err.message);
    }
  };

  const requestTransfer = async () => {
    try {
      await api('/allocations/transfers', { method: 'POST', body: {
        asset_id: conflict.asset_id, to_employee_id: Number(form.employee_id), reason: 'Requested after allocation conflict',
      }});
      setConflict(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const decideTransfer = async (id, action) => {
    try { await api(`/allocations/transfers/${id}`, { method: 'PUT', body: { action } }); load(); }
    catch (err) { setError(err.message); }
  };

  const markReturned = async (id) => {
    const notes = prompt('Condition / check-in notes?') || '';
    try { await api(`/allocations/${id}/return`, { method: 'POST', body: { return_notes: notes } }); load(); }
    catch (err) { setError(err.message); }
  };

  const canManage = ['admin', 'asset_manager', 'dept_head'].includes(user.role);

  // Dept head can only approve/reject transfers where the destination is their department
  const canDecideTransfer = (t) => {
    if (['admin', 'asset_manager'].includes(user.role)) return true;
    if (user.role === 'dept_head') {
      // Allow if the transfer target employee is in their dept, or target dept matches their dept
      const targetDeptId = t.to_department_id;
      const targetEmployeeDeptId = t.to_employee_dept_id;
      return (
        (targetDeptId && targetDeptId === user.department_id) ||
        (targetEmployeeDeptId && targetEmployeeDeptId === user.department_id)
      );
    }
    return false;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Allocations & Transfers</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      {canManage && (
        <form onSubmit={allocate} className="card flex flex-wrap gap-3 items-end">
          <div className="grow max-w-xs">
            <label className="text-xs text-gray-500">Asset</label>
            <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
              <option value="">Select…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.status})</option>)}
            </select>
          </div>
          <div className="grow max-w-xs">
            <label className="text-xs text-gray-500">Employee</label>
            <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
              <option value="">Select…</option>
              {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Expected return</label>
            <input className="input" type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
          </div>
          <button className="btn">Allocate</button>
        </form>
      )}

      {conflict && (
        <div className="card border-amber-300 bg-amber-50 flex items-center justify-between">
          <span className="text-sm text-amber-800">{conflict.message}</span>
          <button className="btn" onClick={requestTransfer}>Request Transfer Instead</button>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Asset</th><th className="th">Holder</th><th className="th">Allocated</th><th className="th">Expected Return</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {allocations.map((al) => (
              <tr key={al.id} className={al.is_overdue ? 'bg-red-50' : ''}>
                <td className="td font-mono">{al.asset_tag} <span className="font-sans text-gray-500">{al.asset_name}</span></td>
                <td className="td">{al.employee_name || al.department_name}</td>
                <td className="td">{new Date(al.allocated_at).toLocaleDateString()}</td>
                <td className="td">{al.expected_return_date ? new Date(al.expected_return_date).toLocaleDateString() : '—'}{al.is_overdue && <span className="badge bg-red-100 text-red-700 ml-2">OVERDUE</span>}</td>
                <td className="td capitalize">{al.status}</td>
                <td className="td">{al.status === 'active' && <button className="btn-secondary" onClick={() => markReturned(al.id)}>Mark Returned</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Transfer Requests</h2>
        {transfers.length === 0 && <p className="text-sm text-gray-400">No transfer requests.</p>}
        {transfers.map((t) => (
          <div key={t.id} className="flex items-center justify-between text-sm py-2 border-t border-gray-100">
            <span>{t.asset_tag} → {t.to_employee_name || t.to_department_name} <span className="text-gray-400">by {t.requested_by_name}</span></span>
            <span className="flex items-center gap-2">
              <span className={`badge ${t.status === 'pending' ? 'bg-amber-100 text-amber-700' : t.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
              {t.status === 'pending' && canDecideTransfer(t) && (<>
                <button className="btn-secondary" onClick={() => decideTransfer(t.id, 'approve')}>Approve</button>
                <button className="btn-secondary" onClick={() => decideTransfer(t.id, 'reject')}>Reject</button>
              </>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
