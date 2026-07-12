// OWNER: P2 — add photo display, status transition buttons, QR code render
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function AssetDetail() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);

  useEffect(() => { api(`/assets/${id}`).then(setAsset); }, [id]);
  if (!asset) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/assets" className="text-sm text-indigo-600">← Back to assets</Link>
      <div className="card">
        <h1 className="text-2xl font-bold">{asset.name} <span className="font-mono text-base text-gray-400">{asset.asset_tag}</span></h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div><div className="text-gray-400 text-xs">Category</div>{asset.category_name}</div>
          <div><div className="text-gray-400 text-xs">Status</div>{asset.status.replace('_', ' ')}</div>
          <div><div className="text-gray-400 text-xs">Condition</div>{asset.condition}</div>
          <div><div className="text-gray-400 text-xs">Location</div>{asset.location || '—'}</div>
          <div><div className="text-gray-400 text-xs">Serial</div>{asset.serial_number || '—'}</div>
          <div><div className="text-gray-400 text-xs">Acquired</div>{asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : '—'}</div>
          <div><div className="text-gray-400 text-xs">Cost</div>{asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString()}` : '—'}</div>
          <div><div className="text-gray-400 text-xs">Bookable</div>{asset.is_bookable ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Allocation History</h2>
        {asset.allocations.length === 0 && <p className="text-sm text-gray-400">Never allocated.</p>}
        {asset.allocations.map((al) => (
          <div key={al.id} className="text-sm py-2 border-t border-gray-100 flex justify-between">
            <span>{al.employee_name || al.department_name} <span className="text-gray-400">by {al.allocated_by_name}</span></span>
            <span className="text-gray-500">
              {new Date(al.allocated_at).toLocaleDateString()} → {al.returned_at ? new Date(al.returned_at).toLocaleDateString() : 'now'}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Maintenance History</h2>
        {asset.maintenance.length === 0 && <p className="text-sm text-gray-400">No maintenance records.</p>}
        {asset.maintenance.map((m) => (
          <div key={m.id} className="text-sm py-2 border-t border-gray-100 flex justify-between">
            <span>{m.issue} <span className="text-gray-400">({m.priority}, by {m.raised_by_name})</span></span>
            <span className="capitalize text-gray-500">{m.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
