// OWNER: P4 — add charts (recharts or plain CSS bars), booking heatmap, CSV export
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => { api('/reports').then(setData); }, []);
  if (!data) return <div className="text-gray-500">Loading…</div>;

  const max = Math.max(...data.assets_by_status.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Assets by Status</h2>
          {data.assets_by_status.map((r) => (
            <div key={r.status} className="mb-2">
              <div className="flex justify-between text-sm"><span className="capitalize">{r.status.replace('_', ' ')}</span><span>{r.count}</span></div>
              <div className="h-2 bg-gray-100 rounded-sm"><div className="h-2 bg-indigo-500 rounded-sm" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Active Allocation by Department</h2>
          {data.department_allocation.length === 0 && <p className="text-sm text-gray-400">No active allocations.</p>}
          {data.department_allocation.map((r) => (
            <div key={r.department} className="flex justify-between text-sm py-1 border-t border-gray-100">
              <span>{r.department}</span><span className="font-medium">{r.count}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Maintenance Frequency (top assets)</h2>
          {data.maintenance_frequency.length === 0 && <p className="text-sm text-gray-400">No maintenance yet.</p>}
          {data.maintenance_frequency.map((r) => (
            <div key={r.asset_tag} className="flex justify-between text-sm py-1 border-t border-gray-100">
              <span className="font-mono">{r.asset_tag} <span className="font-sans">{r.name}</span></span><span>{r.requests}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Most-Used Assets (by allocations)</h2>
          {data.most_used_assets.map((r) => (
            <div key={r.asset_tag} className="flex justify-between text-sm py-1 border-t border-gray-100">
              <span className="font-mono">{r.asset_tag} <span className="font-sans">{r.name}</span></span><span>{r.allocation_count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
