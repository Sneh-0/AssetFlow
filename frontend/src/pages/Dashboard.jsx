import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const KPIS = [
  { key: 'assets_available', label: 'Assets Available', color: 'text-emerald-600' },
  { key: 'assets_allocated', label: 'Assets Allocated', color: 'text-indigo-600' },
  { key: 'maintenance_active', label: 'Maintenance Active', color: 'text-amber-600' },
  { key: 'active_bookings', label: 'Active Bookings', color: 'text-sky-600' },
  { key: 'pending_transfers', label: 'Pending Transfers', color: 'text-purple-600' },
  { key: 'upcoming_returns', label: 'Upcoming Returns', color: 'text-gray-700' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/assets" className="btn">+ Register Asset</Link>
          <Link to="/bookings" className="btn-secondary">Book Resource</Link>
          <Link to="/maintenance" className="btn-secondary">Raise Maintenance</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {KPIS.map((k) => (
          <div key={k.key} className="card">
            <div className={`text-3xl font-bold ${k.color}`}>{data.kpis[k.key]}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-red-600 mb-3">⚠ Overdue Returns ({data.kpis.overdue_returns})</h2>
          {data.overdue_returns.length === 0 && <p className="text-sm text-gray-400">Nothing overdue 🎉</p>}
          {data.overdue_returns.map((r) => (
            <div key={r.id} className="flex justify-between text-sm py-2 border-t border-gray-100">
              <span>{r.asset_tag} · {r.asset_name} — {r.employee_name}</span>
              <span className="text-red-600 font-medium">{new Date(r.expected_return_date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">📅 Upcoming Returns (next 7 days)</h2>
          {data.upcoming_returns.length === 0 && <p className="text-sm text-gray-400">None this week</p>}
          {data.upcoming_returns.map((r) => (
            <div key={r.id} className="flex justify-between text-sm py-2 border-t border-gray-100">
              <span>{r.asset_tag} · {r.asset_name} — {r.employee_name}</span>
              <span className="text-gray-500">{new Date(r.expected_return_date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
