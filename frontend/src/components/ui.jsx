// Shared UI kit — keeps every screen visually consistent.
import { useEffect, useRef, useState } from 'react';

/* ── Icons ─────────────────────────────────────────────────── */

export const Icon = ({ path, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
    {path.split('|').map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

export const ICONS = {
  plus:        'M12 4v16m8-8H4',
  search:      'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  close:       'M6 18L18 6M6 6l12 12',
  check:       'M5 13l4 4L19 7',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:     'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info:        'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clock:       'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  alert:       'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  box:         'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  transfer:    'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  calendar:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  wrench:      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z|M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  clipboard:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  chart:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  bell:        'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  building:    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  users:       'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-4-4',
  tag:         'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 015 10V5a2 2 0 012-2z',
  download:    'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  edit:        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:       'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  arrowLeft:   'M10 19l-7-7m0 0l7-7m-7 7h18',
  chevronL:    'M15 19l-7-7 7-7',
  chevronR:    'M9 5l7 7-7 7',
  qr:          'M12 4v1m6 11h2m-6.5 4.5v-1M6 20H5a1 1 0 01-1-1v-1m16-4v1a1 1 0 01-1 1h-1m1-9V6a1 1 0 00-1-1h-1M4 8V7a1 1 0 011-1h1m0 12v1m8-13h1m-1 16h1m-5-4h.01M9 16h.01M13 16h.01M9 12h.01M13 12h.01M17 12h.01M17 16h.01',
  logout:      'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  menu:        'M4 6h16M4 12h16M4 18h16',
  dashboard:   'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  photo:       'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  sparkle:     'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

/* ── Status metadata (single source of truth) ──────────────── */

export const ASSET_STATUS = {
  available:         { label: 'Available',         cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  allocated:         { label: 'Allocated',         cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200',   dot: 'bg-indigo-500' },
  reserved:          { label: 'Reserved',          cls: 'bg-sky-50 text-sky-700 border border-sky-200',            dot: 'bg-sky-500' },
  under_maintenance: { label: 'Under Maintenance', cls: 'bg-amber-50 text-amber-700 border border-amber-200',      dot: 'bg-amber-500' },
  lost:              { label: 'Lost',              cls: 'bg-rose-50 text-rose-700 border border-rose-200',         dot: 'bg-rose-500' },
  retired:           { label: 'Retired',           cls: 'bg-slate-100 text-slate-600 border border-slate-200',     dot: 'bg-slate-400' },
  disposed:          { label: 'Disposed',          cls: 'bg-slate-100 text-slate-500 border border-slate-200',     dot: 'bg-slate-300' },
};

export function StatusBadge({ status }) {
  const meta = ASSET_STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`badge ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/* ── Page scaffolding ──────────────────────────────────────── */

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
    </div>
  );
}

export function Field({ label, required, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 animate-fade-up">
      <span className="flex items-start gap-2">
        <Icon path={ICONS.alert} className="h-4 w-4 mt-0.5 shrink-0" />
        {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">
          <Icon path={ICONS.close} className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── Modal / Confirm ───────────────────────────────────────── */

export function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors -mr-1.5">
            <Icon path={ICONS.close} className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-rose-50' : 'bg-indigo-50'}`}>
            <Icon path={danger ? ICONS.warning : ICONS.info} className={`h-5 w-5 ${danger ? 'text-rose-600' : 'text-indigo-600'}`} />
          </div>
          <h3 className="font-bold text-slate-900">{title}</h3>
        </div>
        <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
        <div className="flex gap-2.5 pt-1">
          <button className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`${danger ? 'btn-danger' : 'btn'} flex-1`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty / loading states ────────────────────────────────── */

export function EmptyState({ icon = ICONS.box, title, sub, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
        <Icon path={icon} className="h-6 w-6 text-slate-400" />
      </div>
      <p className="font-semibold text-slate-600 text-sm">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{sub}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 h-40 text-slate-400 text-sm">
      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-4" style={{ width: `${[18, 26, 14, 20, 12, 16][c % 6]}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = 'h-28' }) {
  return <div className={`skeleton ${className} rounded-2xl`} />;
}

/* ── Hooks ─────────────────────────────────────────────────── */

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Animated number for KPI cards
export function useCountUp(target, duration = 650) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(target) || 0;
    if (from === to) { setValue(to); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
