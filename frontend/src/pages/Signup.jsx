import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AuthShell from '../components/AuthShell';
import { Field, ErrorBanner, Icon, ICONS } from '../components/ui';

// Signup always creates an Employee — no role selection (admin promotes later in Org Setup)
export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pwTooShort = form.password.length > 0 && form.password.length < 6;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setBusy(true);
    try {
      await signup(form.name.trim(), form.email.trim(), form.password);
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h1>
        <p className="text-sm text-slate-400 mt-1">You'll join as an Employee — an admin can promote you later.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <Field label="Full name" required>
          <input className="input" placeholder="Jane Cooper" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
        </Field>

        <Field label="Email" required>
          <input className="input" type="email" placeholder="you@company.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>

        <Field label="Password" required hint={pwTooShort ? undefined : 'Minimum 6 characters'}>
          <input className={`input ${pwTooShort ? '!border-rose-300 focus:!ring-rose-400/60' : ''}`} type="password"
            placeholder="••••••••" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          {pwTooShort && <p className="text-[11px] text-rose-500 mt-1">At least 6 characters required.</p>}
        </Field>

        <button className="btn w-full !py-2.5" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          Already registered? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </form>

      <div className="mt-8 flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[12px] text-indigo-900/70 leading-relaxed">
        <Icon path={ICONS.info} className="h-4 w-4 mt-0.5 shrink-0 text-indigo-500" />
        Roles (Asset Manager, Department Head) are assigned only by an Administrator from the Employee Directory — never at signup.
      </div>
    </AuthShell>
  );
}
