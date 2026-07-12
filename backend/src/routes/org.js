// Organization Setup (Screen 3): departments, categories, employee directory. Admin-only writes.
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// ---- Tab A: Departments ----
router.get('/departments', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, u.name AS head_name, p.name AS parent_name
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_id
     LEFT JOIN departments p ON p.id = d.parent_id
     ORDER BY d.name`);
  res.json(rows);
}));

router.post('/departments', requireRole('admin'), ah(async (req, res) => {
  const { name, head_id, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows: [dept] } = await query(
    `INSERT INTO departments (name, head_id, parent_id) VALUES ($1, $2, $3) RETURNING *`,
    [name, head_id || null, parent_id || null]);
  await logActivity(req.user.id, 'department.created', 'department', dept.id, name);
  res.status(201).json(dept);
}));

router.put('/departments/:id', requireRole('admin'), ah(async (req, res) => {
  const { name, head_id, parent_id, status } = req.body;
  const { rows: [dept] } = await query(
    `UPDATE departments SET name = COALESCE($1, name), head_id = $2, parent_id = $3, status = COALESCE($4, status)
     WHERE id = $5 RETURNING *`,
    [name, head_id || null, parent_id || null, status, req.params.id]);
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  await logActivity(req.user.id, 'department.updated', 'department', dept.id, dept.name);
  res.json(dept);
}));

// ---- Tab B: Asset Categories ----
router.get('/categories', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM categories ORDER BY name`);
  res.json(rows);
}));

router.post('/categories', requireRole('admin'), ah(async (req, res) => {
  const { name, description, custom_fields } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows: [cat] } = await query(
    `INSERT INTO categories (name, description, custom_fields) VALUES ($1, $2, $3) RETURNING *`,
    [name, description || null, JSON.stringify(custom_fields || [])]);
  await logActivity(req.user.id, 'category.created', 'category', cat.id, name);
  res.status(201).json(cat);
}));

router.put('/categories/:id', requireRole('admin'), ah(async (req, res) => {
  const { name, description, custom_fields } = req.body;
  const { rows: [cat] } = await query(
    `UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description),
     custom_fields = COALESCE($3, custom_fields) WHERE id = $4 RETURNING *`,
    [name, description, custom_fields ? JSON.stringify(custom_fields) : null, req.params.id]);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  res.json(cat);
}));

// ---- Tab C: Employee Directory ----
router.get('/employees', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.department_id, d.name AS department_name
     FROM users u LEFT JOIN departments d ON d.id = u.department_id ORDER BY u.name`);
  res.json(rows);
}));

// THE ONLY place roles are assigned — admin promotes/demotes here
router.put('/employees/:id', requireRole('admin'), ah(async (req, res) => {
  const { role, department_id, status } = req.body;
  if (role && !['admin', 'asset_manager', 'dept_head', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const { rows: [user] } = await query(
    `UPDATE users SET role = COALESCE($1, role), department_id = $2, status = COALESCE($3, status)
     WHERE id = $4 RETURNING id, name, email, role, department_id, status`,
    [role, department_id ?? null, status, req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await logActivity(req.user.id, 'user.role_changed', 'user', user.id, `${user.name} → ${user.role}`);
  await notify(user.id, 'role_changed', `Your role is now: ${user.role.replace('_', ' ')}`);
  res.json(user);
}));

export default router;
