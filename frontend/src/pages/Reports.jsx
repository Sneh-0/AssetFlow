import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon, ICONS, PageHeader, ErrorBanner, EmptyState, CardSkeleton } from '../components/ui';

/*
 * Chart colors (validated for CVD separation & contrast):
 * - Status mix wears the app's reserved status palette, always with labels.
 * - Single-series bars wear ONE hue each (never a color per bar).
 * - The heatmap wears a sequential indigo ramp, light → dark.
 */
const STATUS_COLOR = {
  available:         { hex: '#059669', label: 'Available' },
  allocated:         { hex: '#6366f1', label: 'Allocated' },
  reserved:          { hex: '#0284c7', label: 'Reserved' },
  under_maintenance: { hex: '#d97706', label: 'Under Maintenance' },
  lost:              { hex: '#f43f5e', label: 'Lost' },
  retired:           { hex: '#64748b', label: 'Retired' },
  disposed:          { hex: '#475569', label: 'Disposed' },
};

const HEAT_RAMP = ['#eef2ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function downloadCSV(filename, headers, rows) {
  const csv = '﻿' + [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: filename,
  });
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function ExportButton({ onClick }) {
  return (
    <button onClick={onClick} className="btn-ghost !text-xs border border-slate-200 shrink-0" title="Export as CSV">
      <Icon path={ICONS.download} className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

function ChartCard({ title, subtitle, onExport, children }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {onExport && <ExportButton onClick={onExport} />}
      </div>
      {children}
    </div>
  );
}

// Single-series horizontal bars: one hue, direct value labels
function BarList({ data, labelKey, valueKey, hue, unit = '' }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);
  if (data.length === 0) return <p className="text-sm text-slate-400 py-3">No data available yet.</p>;
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => {
        const val = Number(item[valueKey] || 0);
        return (
          <div key={item[labelKey] || i} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700 truncate pr-3">{item[labelKey]}</span>
              <span className="text-slate-500 tabular-nums font-semibold shrink-0">{val}{unit}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                style={{ width: `${Math.max((val / max) * 100, 2)}%`, backgroundColor: hue }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Part-to-whole status mix: one horizontal stacked bar + labeled legend
function StatusMix({ data }) {
  const total = data.reduce((s, d) => s + Number(d.count || 0), 0);
  if (total === 0) return <p className="text-sm text-slate-400 py-3">No assets registered yet.</p>;
  return (
    <div className="space-y-4">
      <div className="flex h-5 rounded-lg overflow-hidden gap-0.5 bg-white">
        {data.map((d) => {
          const meta = STATUS_COLOR[d.status] || { hex: '#94a3b8', label: d.status };
          const pct = (Number(d.count) / total) * 100;
          return (
            <div key={d.status} title={`${meta.label}: ${d.count} (${pct.toFixed(0)}%)`}
              className="h-full first:rounded-l-lg last:rounded-r-lg transition-all hover:opacity-80"
              style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: meta.hex }} />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {data.map((d) => {
          const meta = STATUS_COLOR[d.status] || { hex: '#94a3b8', label: d.status };
          const pct = ((Number(d.count) / total) * 100).toFixed(0);
          return (
            <div key={d.status} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: meta.hex }} />
              <span className="text-slate-600 truncate">{meta.label}</span>
              <span className="ml-auto font-semibold text-slate-700 tabular-nums">{d.count}</span>
              <span className="text-xs text-slate-400 tabular-nums w-9 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day × hour booking heatmap: sequential ramp, counts shown in non-empty cells
function BookingHeatmap({ data }) {
  const grid = {};
  let max = 0;
  (data || []).forEach((row) => {
    const count = Number(row.booking_count || 0);
    grid[`${row.day_of_week}-${row.hour_of_day}`] = count;
    if (count > max) max = count;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (max === 0) {
    return (
      <EmptyState icon={ICONS.calendar} title="No approved bookings in the last 45 days"
        sub="The heatmap fills in as bookings are approved — peak usage windows show darkest." />
    );
  }

  const colorFor = (count) => {
    if (!count) return '#f8fafc';
    const idx = Math.min(Math.ceil((count / max) * (HEAT_RAMP.length - 1)), HEAT_RAMP.length - 1);
    return HEAT_RAMP[idx];
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[760px]">
        {/* hour header */}
        <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '2.6rem repeat(24, minmax(0,1fr))' }}>
          <div />
          {hours.map((h) => (
            <div key={h} className="text-center text-[9px] text-slate-400 font-semibold tabular-nums">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DAY_ORDER.map((dow) => (
          <div key={dow} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '2.6rem repeat(24, minmax(0,1fr))' }}>
            <div className="text-[10px] font-bold text-slate-400 flex items-center">{DAY_NAMES[dow]}</div>
            {hours.map((h) => {
              const count = grid[`${dow}-${h}`] || 0;
              return (
                <div
                  key={h}
                  title={`${DAY_NAMES[dow]} ${String(h).padStart(2, '0')}:00 — ${count} booking${count !== 1 ? 's' : ''}`}
                  className="aspect-square rounded-[3px] flex items-center justify-center text-[8px] font-bold transition-transform hover:scale-110 cursor-default border border-slate-100"
                  style={{ backgroundColor: colorFor(count), color: count / max > 0.55 ? '#fff' : '#475569' }}
                >
                  {count > 0 ? count : ''}
                </div>
              );
            })}
          </div>
        ))}
        {/* ramp legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end text-[10px] text-slate-400 font-semibold">
          Fewer
          {HEAT_RAMP.map((c) => <span key={c} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: c }} />)}
          More
        </div>
      </div>
    </div>
  );
}

function StatTile({ title, value, accent }) {
  return (
    <div className="card !p-4">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</div>
      <div className={`mt-1.5 text-3xl font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/reports').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return (
    <div className="space-y-5">
      <div className="skeleton h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-3"><CardSkeleton className="h-24" /><CardSkeleton className="h-24" /><CardSkeleton className="h-24" /></div>
      <div className="grid gap-5 xl:grid-cols-2"><CardSkeleton className="h-64" /><CardSkeleton className="h-64" /></div>
    </div>
  );

  const assetsByStatus = data.assets_by_status || [];
  const departmentAllocation = data.department_allocation || [];
  const maintenanceFrequency = data.maintenance_frequency || [];
  const mostUsedAssets = data.most_used_assets || [];
  const heatmapData = data.bookings_heatmap || [];
  const idleAssets = data.idle_assets || [];
  const warrantyExpiring = data.warranty_expiring || [];
  const totalAssets = assetsByStatus.reduce((s, i) => s + Number(i.count || 0), 0);
  const totalBookings45d = heatmapData.reduce((s, r) => s + Number(r.booking_count || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports & Analytics" subtitle="Asset health, utilization, and booking demand — exportable per section." />

      {/* Headline tiles */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 stagger">
        <StatTile title="Assets tracked" value={totalAssets} accent="text-indigo-600" />
        <StatTile title="Departments holding assets" value={departmentAllocation.length} accent="text-emerald-600" />
        <StatTile title="Approved bookings · 45 days" value={totalBookings45d} accent="text-sky-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Assets by Status" subtitle="Current lifecycle mix across the fleet"
          onExport={() => downloadCSV('assets_by_status.csv', ['Status', 'Count'], assetsByStatus.map((d) => [d.status, d.count]))}
        >
          <StatusMix data={assetsByStatus} />
        </ChartCard>

        <ChartCard
          title="Allocation by Department" subtitle="Active allocations per department"
          onExport={() => downloadCSV('department_allocation.csv', ['Department', 'Active Allocations'], departmentAllocation.map((d) => [d.department, d.count]))}
        >
          <BarList data={departmentAllocation} labelKey="department" valueKey="count" hue="#6366f1" />
        </ChartCard>

        <ChartCard
          title="Maintenance Frequency" subtitle="Assets with the most service requests"
          onExport={() => downloadCSV('maintenance_frequency.csv', ['Tag', 'Asset', 'Requests'], maintenanceFrequency.map((d) => [d.asset_tag, d.name, d.requests]))}
        >
          <BarList data={maintenanceFrequency} labelKey="name" valueKey="requests" hue="#d97706" />
        </ChartCard>

        <ChartCard
          title="Most Used Assets" subtitle="Highest total allocation counts"
          onExport={() => downloadCSV('most_used_assets.csv', ['Tag', 'Asset', 'Allocations'], mostUsedAssets.map((d) => [d.asset_tag, d.name, d.allocation_count]))}
        >
          <BarList data={mostUsedAssets} labelKey="name" valueKey="allocation_count" hue="#0284c7" />
        </ChartCard>
      </div>

      {/* Booking heatmap */}
      <ChartCard
        title="Resource Booking Heatmap" subtitle="Approved bookings by day and hour (last 45 days) — darkest = peak usage"
        onExport={() => downloadCSV('booking_heatmap.csv', ['Day', 'Hour', 'Bookings'],
          heatmapData.map((r) => [DAY_NAMES[Number(r.day_of_week)], `${r.hour_of_day}:00`, r.booking_count]))}
      >
        <BookingHeatmap data={heatmapData} />
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Idle assets */}
        <ChartCard
          title="Idle Assets" subtitle="Never allocated — candidates for redistribution or review"
          onExport={() => downloadCSV('idle_assets.csv', ['Tag', 'Asset', 'Category'], idleAssets.map((d) => [d.asset_tag, d.name, d.category_name]))}
        >
          {idleAssets.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">Every asset has been allocated at least once. 🎉</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {idleAssets.map((a) => (
                <div key={a.asset_tag} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-indigo-600">{a.asset_tag}</span>
                    <span className="text-slate-700 ml-2">{a.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{a.category_name}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Warranty expiring */}
        <ChartCard
          title="Warranty Watchlist" subtitle="Warranties expired or expiring within 90 days"
          onExport={() => downloadCSV('warranty_watchlist.csv', ['Tag', 'Asset', 'Warranty Expiry', 'Expired'],
            warrantyExpiring.map((d) => [d.asset_tag, d.name, new Date(d.warranty_expiry).toLocaleDateString(), d.expired ? 'Yes' : 'No']))}
        >
          {warrantyExpiring.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">No warranties expiring soon.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {warrantyExpiring.map((a) => (
                <div key={a.asset_tag} className="flex items-center justify-between py-2.5 text-sm gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-indigo-600">{a.asset_tag}</span>
                    <span className="text-slate-700 ml-2">{a.name}</span>
                  </div>
                  <span className={`badge shrink-0 ${a.expired
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    <Icon path={a.expired ? ICONS.alert : ICONS.clock} className="h-3 w-3" />
                    {a.expired ? 'Expired' : 'Expires'} {new Date(a.warranty_expiry).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
