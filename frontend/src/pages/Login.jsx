import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AuthShell from '../components/AuthShell';
import { Field, ErrorBanner, Icon, ICONS } from '../components/ui';

const EYE = 'M15 12a3 3 0 11-6 0 3 3 0 016 0z|M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z';
const EYE_OFF = 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
        <p className="text-sm text-slate-400 mt-1">Sign in to manage your organization's assets.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <Field label="Email" required>
          <input
            className="input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <Icon path={showPw ? EYE_OFF : EYE} className="h-4.5 w-4.5" />
            </button>
          </div>
        </Field>

        <button className="btn w-full !py-2.5" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          No account? <Link to="/signup" className="text-indigo-600 font-semibold hover:underline">Create one</Link>
        </p>
      </form>

      {/* Demo quick-fill */}
      <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          <Icon path={ICONS.sparkle} className="h-3.5 w-3.5" /> Demo access
        </div>
        <button
          type="button"
          onClick={() => { setEmail('admin@assetflow.com'); setPassword('admin123'); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 text-sm hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors"
        >
          <span className="font-medium text-slate-700">Administrator</span>
          <span className="text-xs text-slate-400 font-mono">admin@assetflow.com</span>
        </button>
        <p className="text-[11px] text-slate-400 mt-2">Click to fill the form, then sign in.</p>
      </div>
    </AuthShell>
  );
}
