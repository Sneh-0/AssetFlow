import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { ah, logActivity } from '../helpers.js';

const router = Router();

// Signup ALWAYS creates a plain employee — no role selection (per problem statement)
router.post('/signup', ah(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows: [user] } = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role, department_id`,
    [name, email.toLowerCase(), hash]
  );
  await logActivity(user.id, 'user.signup', 'user', user.id, `${name} signed up`);
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const { rows: [user] } = await query(`SELECT * FROM users WHERE email = $1`, [(email || '').toLowerCase()]);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: 'Account is deactivated' });
  const { password_hash, ...safe } = user;
  res.json({ token: signToken(user), user: safe });
}));

// Session validation — frontend calls this on load to restore the session
router.get('/me', requireAuth, ah(async (req, res) => {
  const { rows: [user] } = await query(
    `SELECT id, name, email, role, department_id, status FROM users WHERE id = $1`, [req.user.id]);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Session invalid' });
  res.json({ user });
}));

// TODO(hackathon): forgot-password can be faked — generate a reset code, show it on screen instead of emailing
export default router;
