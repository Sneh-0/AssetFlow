import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
        <h1 className="text-2xl font-bold">Asset<span className="text-indigo-600">Flow</span></h1>
        <p className="text-sm text-gray-500">Enterprise Asset & Resource Management</p>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-sm text-gray-500">
          No account? <Link to="/signup" className="text-indigo-600 font-medium">Sign up</Link>
        </p>
        <p className="text-xs text-gray-400">Demo: admin@assetflow.com / admin123</p>
      </form>
    </div>
  );
}
