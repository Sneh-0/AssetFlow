import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

// Attaches req.user = { id, role, name } or rejects with 401
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Usage: requireRole('admin') or requireRole('admin', 'asset_manager')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}
