// Admin-only. 4 tabs: Departments / Categories / Employee Directory / Technicians
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import {
  Icon, ICONS, PageHeader, Field, ErrorBanner,
  EmptyState, TableSkeleton,
} from '../components/ui';

const TABS = [
  { id: 'departments', label: 'Departments',  icon: ICONS.building },
  { id: 'categories',  label: 'Categories',   icon: ICONS.tag },
  { id: 'employees',   label: 'Employees',    icon: ICONS.users },
  { id: 'technicians', label: 'Technicians',  icon: ICONS.wrench },
];

const ROLE_BADGE = {
  admin:         'bg-rose-50 text-rose-700 border border-rose-200',
  asset_manager: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  dept_head:     'bg-violet-50 text-violet-700 border border-violet-200',
  employee:      'bg-slate-100 text-slate-600 border border-slate-200',
};

export default function OrgSetup() {
  const [tab, setTab] = useState('departments');
  return (
    <div className="space-y-5">
      <PageHeader title="Organization Setup" subtitle="Master data everything else depends on — departments, categories, people, and roles." />

      <div className="flex gap-1.5 flex-wrap border-b border-slate-200 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold cursor-pointer transition-all border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Icon path={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-up">
        {tab === 'departments' && <Departments />}
        {tab === 'categories' && <Categories />}
        {tab === 'employees' && <Employees />}
        {tab === 'technicians' && <Technicians />}
      </div>
    </div>
  );
}

function Departments() {
  const toast = useToast();
  const [depts, setDepts] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: '', head_id: '', parent_id: '' });
  const [error, setError] = useState('');

  const load = () => {
    api('/org/departments').then(setDepts).catch((e) => setError(e.message));
    api('/org/employees').then(setEmployees).catch(() => {});
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/org/departments', { method: 'POST', body: {
        name: form.name.trim(),
        head_id: form.head_id ? Number(form.head_id) : null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      }});
      toast.success(`Department "${form.name.trim()}" created`);
      setForm({ name: '', head_id: '', parent_id: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (d) => {
    try {
      await api(`/org/departments/${d.id}`, { method: 'PUT', body: {
        status: d.status === 'active' ? 'inactive' : 'active', head_id: d.head_id, parent_id: d.parent_id,
      }});
      toast.info(`${d.name} ${d.status === 'active' ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <form onSubmit={create} className="card flex flex-wrap gap-3 items-end">
        <Field label="Department name" required className="grow max-w-xs min-w-48">
          <input className="input" placeholder="e.g. Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Department head (optional)" className="grow max-w-xs min-w-44">
          <select className="input" value={form.head_id} onChange={(e) => setForm({ ...form, head_id: e.target.value })}>
            <option value="">No head yet…</option>
            {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Parent department (optional)" className="grow max-w-xs min-w-44">
          <select className="input" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">Top level</option>
            {(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <button className="btn"><Icon path={ICONS.plus} /> Add Department</button>
      </form>

      <div className="card p-0 overflow-hidden">
        {!depts ? <TableSkeleton rows={4} cols={5} /> : depts.length === 0 ? (
          <EmptyState icon={ICONS.building} title="No departments yet" sub="Create your first department above — assets and people attach to them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Head</th><th className="th">Parent</th><th className="th">Status</th><th className="th text-right">Action</th></tr></thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td font-semibold text-slate-800">{d.name}</td>
                    <td className="td text-slate-600">{d.head_name || <span className="text-slate-300">—</span>}</td>
                    <td className="td text-slate-600">{d.parent_name || <span className="text-slate-300">—</span>}</td>
                    <td className="td">
                      <span className={`badge ${d.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="td text-right">
                      <button className="btn-ghost !text-xs border border-slate-200" onClick={() => toggle(d)}>
                        {d.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
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

function Categories() {
  const toast = useToast();
  const [cats, setCats] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const load = () => api('/org/categories').then(setCats).catch((e) => setError(e.message));
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/org/categories', { method: 'POST', body: { ...form, name: form.name.trim() } });
      toast.success(`Category "${form.name.trim()}" created`);
      setForm({ name: '', description: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <form onSubmit={create} className="card flex flex-wrap gap-3 items-end">
        <Field label="Category name" required className="grow max-w-xs min-w-48">
          <input className="input" placeholder="e.g. Electronics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Description" className="grow max-w-md min-w-56">
          <input className="input" placeholder="What belongs in this category?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <button className="btn"><Icon path={ICONS.plus} /> Add Category</button>
      </form>

      <div className="card p-0 overflow-hidden">
        {!cats ? <TableSkeleton rows={4} cols={3} /> : cats.length === 0 ? (
          <EmptyState icon={ICONS.tag} title="No categories yet" sub="Add categories like Electronics, Furniture, or Vehicles — every asset needs one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Description</th><th className="th">Custom Fields</th></tr></thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td font-semibold text-slate-800">{c.name}</td>
                    <td className="td text-slate-600">{c.description || <span className="text-slate-300">—</span>}</td>
                    <td className="td text-slate-400 text-xs">{(c.custom_fields || []).map((f) => f.name).join(', ') || '—'}</td>
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

function Employees() {
  const toast = useToast();
  const [employees, setEmployees] = useState(null);
  const [depts, setDepts] = useState([]);
  const [q, setQ] = useState('');
  const load = () => {
    api('/org/employees').then(setEmployees);
    api('/org/departments').then(setDepts);
  };
  useEffect(load, []);

  const update = async (id, patch, current, okMsg) => {
    try {
      await api(`/org/employees/${id}`, { method: 'PUT', body: { department_id: current.department_id, ...patch } });
      toast.success(okMsg);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const visible = (employees || []).filter((u) => {
    const s = q.toLowerCase();
    return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative grow max-w-sm min-w-56">
          <Icon path={ICONS.search} className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input className="input pl-9" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400 font-medium">
          This directory is the <span className="font-bold text-slate-500">only</span> place roles are assigned — changes apply instantly.
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        {!employees ? <TableSkeleton rows={6} cols={5} /> : visible.length === 0 ? (
          <EmptyState icon={ICONS.users} title="No employees found" sub={q ? 'Try a different search.' : 'New signups appear here automatically as Employees.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Department</th><th className="th">Role</th><th className="th">Status</th></tr></thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="td text-slate-500">{u.email}</td>
                    <td className="td">
                      <select className="input !py-1.5 max-w-44" value={u.department_id || ''}
                        onChange={(e) => update(u.id, { department_id: e.target.value ? Number(e.target.value) : null }, u, `${u.name}'s department updated`)}>
                        <option value="">Unassigned</option>
                        {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <select className="input !py-1.5 max-w-44" value={u.role}
                          onChange={(e) => update(u.id, { role: e.target.value }, u, `${u.name} is now ${e.target.value.replace('_', ' ')}`)}>
                          <option value="employee">Employee</option>
                          <option value="dept_head">Department Head</option>
                          <option value="asset_manager">Asset Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                        <span className={`badge capitalize hidden xl:inline-flex ${ROLE_BADGE[u.role]}`}>{u.role.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="td">
                      <button
                        onClick={() => update(u.id, { status: u.status === 'active' ? 'inactive' : 'active' }, u, `${u.name} ${u.status === 'active' ? 'deactivated' : 'activated'}`)}
                        className={`badge cursor-pointer transition-all ${u.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {u.status}
                      </button>
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

function Technicians() {
  const toast = useToast();
  const [techs, setTechs] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', specialty: '' });
  const [error, setError] = useState('');

  const load = () => api('/technicians').then(setTechs).catch((err) => setError(err.message));
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/technicians', { method: 'POST', body: form });
      toast.success(`Technician "${form.name}" registered`);
      setForm({ name: '', email: '', phone: '', specialty: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const toggleStatus = async (t) => {
    try {
      await api(`/technicians/${t.id}`, { method: 'PUT', body: { status: t.status === 'active' ? 'inactive' : 'active' } });
      toast.info(`${t.name} ${t.status === 'active' ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <form onSubmit={create} className="card flex flex-wrap gap-3 items-end">
        <Field label="Name" required className="grow max-w-xs min-w-44">
          <input className="input" placeholder="Technician name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email (optional)" className="grow max-w-xs min-w-44">
          <input className="input" type="email" placeholder="tech@vendor.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone (optional)" className="grow max-w-48">
          <input className="input" placeholder="+91 …" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Specialty" className="grow max-w-48">
          <input className="input" placeholder="e.g. HVAC, Laptops" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </Field>
        <button className="btn"><Icon path={ICONS.plus} /> Add Technician</button>
      </form>

      <div className="card p-0 overflow-hidden">
        {!techs ? <TableSkeleton rows={4} cols={6} /> : techs.length === 0 ? (
          <EmptyState icon={ICONS.wrench} title="No technicians registered" sub="Technicians are assigned to approved maintenance requests." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Name</th><th className="th">Email</th><th className="th">Phone</th>
                  <th className="th">Specialty</th><th className="th">Workload</th><th className="th">Status</th><th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {techs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td font-semibold text-slate-800">{t.name}</td>
                    <td className="td text-slate-500">{t.email || <span className="text-slate-300">—</span>}</td>
                    <td className="td text-slate-500">{t.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="td capitalize text-slate-600">{t.specialty || 'General'}</td>
                    <td className="td">
                      <span className={`font-bold tabular-nums ${Number(t.active_requests_count) > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {t.active_requests_count}
                      </span>
                      <span className="text-xs text-slate-400"> active</span>
                    </td>
                    <td className="td">
                      <span className={`badge ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {t.status}
                      </span>
                    </td>
                    <td className="td text-right">
                      <button className="btn-ghost !text-xs border border-slate-200" onClick={() => toggleStatus(t)}>
                        {t.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
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
