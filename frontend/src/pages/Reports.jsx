// OWNER: P4 — add charts (recharts or plain CSS bars), booking heatmap, CSV export
import { useEffect, useState } from 'react';
import { api } from '../api';

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatCard({ title, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function BarChart({ title, subtitle, data, labelKey, valueKey, colors }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-slate-400">No data available yet.</p>
        ) : data.map((item, index) => (
          <div key={item[labelKey] || index}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{item[labelKey]}</span>
              <span className="text-slate-500">{item[valueKey]}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2.5 rounded-full"
                style={{ width: `${Math.max((Number(item[valueKey] || 0) / max) * 100, 6)}%`, backgroundColor: colors[index % colors.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieChart({ title, subtitle, data }) {
  const total = data.reduce((sum, item) => sum + Number(item.count || 0), 0);
  let start = -90;
  const segments = data.map((item, index) => {
    const value = Number(item.count || 0);
    const sweep = total > 0 ? (value / total) * 360 : 0;
    const segment = `${PIE_COLORS[index % PIE_COLORS.length]} ${start}deg ${start + sweep}deg`;
    start += sweep;
    return segment;
  });

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative mx-auto h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${segments.join(', ') || '#e2e8f0 0deg 360deg'})` }}>
          <div className="absolute inset-5 rounded-full bg-white" />
        </div>
        <div className="flex-1 space-y-2">
          {data.length === 0 ? (
            <p className="text-sm text-slate-400">No data available yet.</p>
          ) : data.map((item, index) => (
            <div key={item.status || item.department || index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <span className="capitalize text-slate-600">{(item.status || item.department || '').replace('_', ' ')}</span>
              </div>
              <span className="font-semibold text-slate-700">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingTimeline({ data }) {
  const entries = (data || [])
    .flatMap((row) => {
      const dayName = DAY_NAMES[Number(row.day_of_week) || 0];
      const bookings = Array.isArray(row.bookings) ? row.bookings : [];
      return bookings.map((booking) => ({
        dayName,
        hour: Number(row.hour_of_day),
        ...booking,
      }));
    })
    .sort((a, b) => (a.hour || 0) - (b.hour || 0));

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">Booking Timeline</h2>
        <p className="text-sm text-slate-500">Recent approved bookings grouped by day and hour.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
          No approved booking activity recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((booking, index) => (
            <div key={`${booking.booked_by_name || 'user'}-${booking.asset_name || 'asset'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{booking.booked_by_name || 'Unknown user'}</div>
                  <div className="text-xs text-slate-500">{booking.asset_name || 'Unnamed asset'} • {booking.asset_tag || '—'}</div>
                </div>
                <div className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {booking.dayName} • {String(booking.hour).padStart(2, '0')}:00
                </div>
              </div>
              {booking.purpose && (
                <div className="mt-2 text-sm text-slate-600">Purpose: {booking.purpose}</div>
              )}
              {booking.start_time && (
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(booking.start_time).toLocaleString()} {booking.end_time ? `– ${new Date(booking.end_time).toLocaleString()}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/reports')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading reports…</div>;

  const assetsByStatus = data.assets_by_status || [];
  const departmentAllocation = data.department_allocation || [];
  const maintenanceFrequency = data.maintenance_frequency || [];
  const mostUsedAssets = data.most_used_assets || [];
  const heatmapData = data.bookings_heatmap || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">A clearer snapshot of asset health, utilization, and booking demand.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard title="Assets tracked" value={assetsByStatus.reduce((sum, item) => sum + Number(item.count || 0), 0)} accent="text-indigo-600" />
          <StatCard title="Active departments" value={departmentAllocation.length} accent="text-emerald-600" />
          <StatCard title="Top maintenance items" value={maintenanceFrequency.length} accent="text-amber-600" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieChart title="Assets by Status" subtitle="Current operational mix across the fleet" data={assetsByStatus} />
        <BarChart title="Active Allocation by Department" subtitle="Current allocation distribution" data={departmentAllocation} labelKey="department" valueKey="count" colors={['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b']} />
        <BarChart title="Maintenance Frequency" subtitle="Most requested assets for service" data={maintenanceFrequency} labelKey="name" valueKey="requests" colors={['#ef4444', '#f59e0b', '#10b981', '#8b5cf6']} />
        <BarChart title="Most Used Assets" subtitle="Assets with the highest allocation history" data={mostUsedAssets} labelKey="name" valueKey="allocation_count" colors={['#0ea5e9', '#6366f1', '#14b8a6', '#f97316']} />
      </div>

      <BookingTimeline data={heatmapData} />
    </div>
  );
}
