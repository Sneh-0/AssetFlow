// Base URL for the API. Empty by default so calls stay same-origin (`/api/...`),
// which is how the single-project Vercel deploy serves the backend. Set
// VITE_API_URL at build time only if the API lives on a different host.
const API_BASE = import.meta.env.VITE_API_URL || '';

// Tiny API client. Usage: api('/assets'), api('/auth/login', { method: 'POST', body: {...} })
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
