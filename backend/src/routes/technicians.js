import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// GET /api/technicians - List all technicians with active workloads
router.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, 
            COALESCE(COUNT(m.id) FILTER (WHERE m.status IN ('assigned', 'in_progress')), 0)::integer AS active_requests_count
     FROM technicians t
     LEFT JOIN maintenance_requests m ON m.technician_id = t.id
     GROUP BY t.id
     ORDER BY t.name`
  );
  res.json(rows);
}));

// POST /api/technicians - Create a new technician (Admin or Asset Manager only)
router.post('/', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { name, email, phone, specialty } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Check email uniqueness if provided
  if (email) {
    const { rows: existing } = await query('SELECT id FROM technicians WHERE email = $1', [email.toLowerCase()]);
    if (existing.length) {
      return res.status(409).json({ error: 'A technician with this email already exists' });
    }
  }

  const { rows: [tech] } = await query(
    `INSERT INTO technicians (name, email, phone, specialty) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, email ? email.toLowerCase() : null, phone || null, specialty || null]
  );
  res.status(201).json(tech);
}));

// PUT /api/technicians/:id - Update an existing technician (Admin or Asset Manager only)
router.put('/:id', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { name, email, phone, specialty, status } = req.body;
  if (status && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be active or inactive' });
  }

  // Check email uniqueness if email is changed
  if (email) {
    const { rows: existing } = await query('SELECT id FROM technicians WHERE email = $1 AND id <> $2', [email.toLowerCase(), req.params.id]);
    if (existing.length) {
      return res.status(409).json({ error: 'Another technician with this email already exists' });
    }
  }

  const { rows: [tech] } = await query(
    `UPDATE technicians SET 
       name = COALESCE($1, name), 
       email = COALESCE($2, email), 
       phone = COALESCE($3, phone), 
       specialty = COALESCE($4, specialty), 
       status = COALESCE($5, status)
     WHERE id = $6 RETURNING *`,
    [name, email ? email.toLowerCase() : null, phone, specialty, status, req.params.id]
  );

  if (!tech) return res.status(404).json({ error: 'Technician not found' });
  res.json(tech);
}));

export default router;
