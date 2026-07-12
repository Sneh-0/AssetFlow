// Reports & Analytics — recharts + booking heatmap
import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const STATUS_COLORS = {
  available: '#10b981', allocated: '#6366f1', reserved: '#f59e0b',
  under_maintenance: '#ef4444', lost: '#64748b', retired: '#94a3b8', disposed: '#cbd5e1',
};

const PIE_PALETTE = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#06b6d4', '#f59e0b', '#ef4444'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-700 capitalize mb-0.5">{String(label).replace('_', ' ')}</p>
      <p className="text-sm font-bold text-indigo-600">{payload[0].value}</p>
    </div>
  );
};

function BookingHeatmap({ heatmapData }) {
  const { grid, maxCount } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    let mx = 0;
    (heatmapData || []).forEach(({ day, hour, count }) => {
      g[day][hour] = count;
      if (count > mx) mx = count;
    });
    return { grid: g, maxCount: mx };
  }, [heatmapData]);

  const cellColor = (count) => {
    if (count === 0) return 'bg-gray-50';
    const ratio = count / Math.max(maxCount, 1);
    if (ratio < 0.25) return 'bg-indigo-100';
    if (ratio < 0.5)  return 'bg-indigo-200';
    if (ratio < 0.75) return 'bg-indigo-400';
    return 'bg-indigo-600';
  };

  const textColor = (count) => {
    const ratio = count / Math.max(maxCount, 1);
    return ratio >= 0.75 ? 'text-white' : 'text-gray-600';
  };

  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex ml-12 mb-1">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-gray-400 font-medium">
              {labelHours.includes(h) ? `${h}:00` : ''}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {DAYS.map((dayName, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-[2px]">
            <span className="w-12 text-xs text-gray-500 font-medium text-right pr-2">{dayName}</span>
            {HOURS.map((hour) => {
              const count = grid[dayIdx][hour];
              return (
                <div
                  key={hour}
                  className={`flex-1 mx-[1px] h-6 rounded-sm flex items-center justify-center cursor-default transition-colors duration-200 hover:ring-1 hover:ring-indigo-400 ${cellColor(count)} ${textColor(count)}`}
                  title={`${dayName} ${hour}:00 — ${count} booking${count !== 1 ? 's' : ''}`}
                >
                  <span className="text-[9px] font-medium">{count > 0 ? count : ''}</span>
                </div>
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 ml-12">
          <span className="text-[10px] text-gray-400 mr-1">Less</span>
          {['bg-gray-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600'].map((c) => (
            <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => { api('/reports').then(setData); }, []);
  if (!data) return <div className="text-gray-500">Loading…</div>;

  const statusData = data.assets_by_status.map((r) => ({
    ...r,
    label: r.status.replace('_', ' '),
    fill: STATUS_COLORS[r.status] || '#94a3b8',
  }));

  const deptData = data.department_allocation.map((r, i) => ({
    ...r,
    fill: PIE_PALETTE[i % PIE_PALETTE.length],
  }));

  const maintData = data.maintenance_frequency.map((r) => ({
    label: `${r.asset_tag}`,
    name: r.name,
    requests: r.requests,
  }));

  const usedData = data.most_used_assets.map((r) => ({
    label: `${r.asset_tag}`,
    name: r.name,
    allocations: r.allocation_count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports &amp; Analytics</h1>

      {/* Row 1: Assets by Status (bar) + Department Allocation (pie) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Assets by Status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="capitalize" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={800}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Active Allocation by Department</h2>
          {deptData.length === 0 ? (
            <p className="text-sm text-gray-400 mt-8 text-center">No active allocations.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={deptData}
                  dataKey="count"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  animationDuration={800}
                  label={({ department, percent }) =>
                    `${department} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {deptData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} assets`, name]}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Maintenance Frequency + Most-Used Assets (horizontal bars) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Maintenance Frequency (top assets)</h2>
          {maintData.length === 0 ? (
            <p className="text-sm text-gray-400 mt-8 text-center">No maintenance yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, maintData.length * 36)}>
              <BarChart data={maintData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, _, { payload }) => [`${v} requests`, payload.name]}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="requests" fill="#f59e0b" radius={[0, 6, 6, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Most-Used Assets (by allocations)</h2>
          {usedData.length === 0 ? (
            <p className="text-sm text-gray-400 mt-8 text-center">No allocation data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, usedData.length * 36)}>
              <BarChart data={usedData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, _, { payload }) => [`${v} allocations`, payload.name]}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="allocations" fill="#8b5cf6" radius={[0, 6, 6, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Booking Heatmap */}
      <div className="card">
        <h2 className="font-semibold mb-4">Booking Heatmap</h2>
        <p className="text-xs text-gray-400 mb-3">Booking density by day of week and hour of day</p>
        <BookingHeatmap heatmapData={data.booking_heatmap} />
      </div>
    </div>
  );
}
