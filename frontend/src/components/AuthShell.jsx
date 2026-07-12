// Shared split-panel shell for Login / Signup
import { Icon, ICONS } from './ui';

const FEATURES = [
  { icon: ICONS.box,      title: 'Full asset lifecycle',   sub: 'Available → Allocated → Maintenance → Retired, all tracked' },
  { icon: ICONS.calendar, title: 'Conflict-free booking',  sub: 'Time-slot reservations with automatic overlap rejection' },
  { icon: ICONS.wrench,   title: 'Approval workflows',     sub: 'Maintenance and transfers routed through the right people' },
  { icon: ICONS.clipboard,title: 'Audit cycles',           sub: 'Assign auditors, flag discrepancies, auto-build reports' },
];

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative overflow-hidden">
        {/* decorative glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-violet-600/20 blur-[100px]" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-950">
            <Icon path={ICONS.box} className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-white">Asset<span className="text-indigo-400">Flow</span></div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest">Enterprise Asset Management</div>
          </div>
        </div>

        <div className="relative space-y-8 max-w-md">
          <h2 className="text-3xl font-bold text-white leading-tight tracking-tight">
            Every asset, every booking,<br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">one source of truth.</span>
          </h2>
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon path={f.icon} className="h-4.5 w-4.5 text-indigo-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{f.title}</div>
                  <div className="text-[13px] text-slate-500 leading-snug mt-0.5">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600">Departments · Assets · Bookings · Maintenance · Audits · Reports</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-100 lg:rounded-l-[2.5rem]">
        <div className="w-full max-w-sm animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
