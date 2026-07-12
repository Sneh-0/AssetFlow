// OWNER: P1 — Admin-only. 3 tabs: Departments / Categories / Employee Directory (only place roles change)
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function OrgSetup() {
  const [tab, setTab] = useState('departments');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Organization Setup</h1>
      <div className="flex gap-2">
        {['departments', 'categories', 'employees'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize cursor-pointer ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'departments' && <Departments />}
      {tab === 'categories' && <Categories />}
      {tab === 'employees' && <Employees />}
    </div>
  );
}

function Departments() {
  const [depts, setDepts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: '', head_id: '', parent_id: '' });
  const [error, setError] = useState('');

  const load = () => { api('/org/departments').then(setDepts); api('/org/employees').then(setEmployees); };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/org/departments', { method: 'POST', body: {
        name: form.name, head_id: form.head_id ? Number(form.head_id) : null, parent_id: form.parent_id ? Number(form.parent_id) : null,
      }});
      setForm({ name: '', head_id: '', parent_id: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (d) => {
    await api(`/org/departments/${d.id}`, { method: 'PUT', body: { status: d.status === 'active' ? 'inactive' : 'active', head_id: d.head_id, parent_id: d.parent_id } });
    load();
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
      <form onSubmit={create} className="card flex flex-wrap gap-3 items-end">
        <input className="input max-w-xs" placeholder="Department name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="input max-w-xs" value={form.head_id} onChange={(e) => setForm({ ...form, head_id: e.target.value })}>
          <option value="">Head (optional)…</option>
          {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input max-w-xs" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
          <option value="">Parent dept (optional)…</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn">Add</button>
      </form>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Head</th><th className="th">Parent</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>{depts.map((d) => (
            <tr key={d.id}>
              <td className="td">{d.name}</td><td className="td">{d.head_name || '—'}</td><td className="td">{d.parent_name || '—'}</td>
              <td className="td"><span className={`badge ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>{d.status}</span></td>
              <td className="td"><button className="btn-secondary" onClick={() => toggle(d)}>{d.status === 'active' ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Categories() {
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const load = () => api('/org/categories').then(setCats);
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api('/org/categories', { method: 'POST', body: form });
    setForm({ name: '', description: '' });
    load();
  };
  // TODO(P1): custom fields editor (e.g. warranty period for Electronics) — schema already supports custom_fields JSONB

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input max-w-md" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn">Add</button>
      </form>
      <div className="card p-0">
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Description</th><th className="th">Custom Fields</th></tr></thead>
          <tbody>{cats.map((c) => (
            <tr key={c.id}><td className="td">{c.name}</td><td className="td">{c.description || '—'}</td>
            <td className="td text-gray-400">{(c.custom_fields || []).map((f) => f.name).join(', ') || '—'}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [depts, setDepts] = useState([]);
  const load = () => { api('/org/employees').then(setEmployees); api('/org/departments').then(setDepts); };
  useEffect(load, []);

  const update = async (id, patch, current) => {
    await api(`/org/employees/${id}`, { method: 'PUT', body: { department_id: current.department_id, ...patch } });
    load();
  };

  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full">
        <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Department</th><th className="th">Role</th><th className="th">Status</th></tr></thead>
        <tbody>{employees.map((u) => (
          <tr key={u.id}>
            <td className="td">{u.name}</td>
            <td className="td">{u.email}</td>
            <td className="td">
              <select className="input" value={u.department_id || ''} onChange={(e) => update(u.id, { department_id: e.target.value ? Number(e.target.value) : null }, u)}>
                <option value="">—</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </td>
            <td className="td">
              <select className="input" value={u.role} onChange={(e) => update(u.id, { role: e.target.value }, u)}>
                <option value="employee">Employee</option>
                <option value="dept_head">Department Head</option>
                <option value="asset_manager">Asset Manager</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td className="td">
              <button className="btn-secondary" onClick={() => update(u.id, { status: u.status === 'active' ? 'inactive' : 'active' }, u)}>
                {u.status}
              </button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
