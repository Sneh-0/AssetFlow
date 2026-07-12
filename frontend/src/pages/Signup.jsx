import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// Signup always creates an Employee — no role selection (admin promotes later in Org Setup)
export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-gray-500">You'll join as an Employee. An admin can promote you later.</p>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn w-full" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
        <p className="text-sm text-gray-500">
          Already registered? <Link to="/login" className="text-indigo-600 font-medium">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
