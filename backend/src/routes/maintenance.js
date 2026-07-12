// Maintenance Management (Screen 7): Pending → Approved/Rejected → Assigned → In Progress → Resolved
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const params = [];
  const where = [];

  if (req.query.status) {
    params.push(req.query.status);
    where.push(`m.status = $${params.length}`);
  }

  if (req.user.role === 'employee') {
    params.push(req.user.id);
    where.push(`m.raised_by = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT m.*, a.asset_tag, a.name AS asset_name, u.name AS raised_by_name, db.name AS decided_by_name,
            t.name AS technician_name, t.specialty AS technician_specialty
     FROM maintenance_requests m
     JOIN assets a ON a.id = m.asset_id
     JOIN users u ON u.id = m.raised_by
     LEFT JOIN users db ON db.id = m.decided_by
     LEFT JOIN technicians t ON t.id = m.technician_id
     ${whereClause} ORDER BY m.created_at DESC`, params);
  res.json(rows);
}));

router.post('/', ah(async (req, res) => {
  const { asset_id, issue, priority, photo_url } = req.body;
  if (!asset_id || !issue) return res.status(400).json({ error: 'asset_id and issue are required' });

  if (req.user.role === 'employee') {
    const { rows } = await query(
      `SELECT id FROM allocations WHERE asset_id = $1 AND employee_id = $2 AND status = 'active'`,
      [asset_id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: 'Employees can only raise maintenance requests for assets currently allocated to them.' });
    }
  }

  const { rows: [m] } = await query(
    `INSERT INTO maintenance_requests (asset_id, raised_by, issue, priority, photo_url)
     VALUES ($1, $2, $3, COALESCE($4, 'medium'), $5) RETURNING *`,
    [asset_id, req.user.id, issue, priority, photo_url || null]);
  await logActivity(req.user.id, 'maintenance.raised', 'asset', asset_id, issue);
  res.status(201).json(m);
}));

// Single transition endpoint. body: { action: approve|reject|assign|start|resolve, technician_id? }
router.put('/:id', ah(async (req, res) => {
  const { action, technician_id } = req.body;
  const { rows: [m] } = await query(`SELECT * FROM maintenance_requests WHERE id = $1`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Request not found' });

  const transitions = {
    approve: { from: ['pending'], to: 'approved', roles: ['admin', 'asset_manager'] },
    reject:  { from: ['pending'], to: 'rejected', roles: ['admin', 'asset_manager'] },
    assign:  { from: ['approved'], to: 'assigned', roles: ['admin', 'asset_manager'] },
    start:   { from: ['assigned'], to: 'in_progress', roles: ['admin', 'asset_manager'] },
    resolve: { from: ['in_progress', 'assigned'], to: 'resolved', roles: ['admin', 'asset_manager'] },
  };
  const t = transitions[action];
  if (!t) return res.status(400).json({ error: `Unknown action '${action}'` });
  if (!t.roles.includes(req.user.role)) return res.status(403).json({ error: 'Only an Asset Manager can do this' });
  if (!t.from.includes(m.status)) return res.status(409).json({ error: `Cannot ${action} a request that is ${m.status}` });

  if (action === 'assign' && !technician_id) {
    return res.status(400).json({ error: 'technician_id is required for assign action' });
  }

  const { rows: [updated] } = await query(
    `UPDATE maintenance_requests SET status = $1, technician_id = COALESCE($2, technician_id),
       decided_by = CASE WHEN $1 IN ('approved','rejected') THEN $3 ELSE decided_by END,
       decided_at = CASE WHEN $1 IN ('approved','rejected') THEN now() ELSE decided_at END,
       resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END
     WHERE id = $4 RETURNING *`, [t.to, technician_id || null, req.user.id, req.params.id]);

  // Asset status auto-updates: Under Maintenance on approval, back to Available on resolution
  if (t.to === 'approved') await query(`UPDATE assets SET status = 'under_maintenance' WHERE id = $1`, [m.asset_id]);
  if (t.to === 'resolved') {
    // If someone still holds it, it goes back to allocated, else available
    const { rows: [active] } = await query(`SELECT id FROM allocations WHERE asset_id = $1 AND status = 'active'`, [m.asset_id]);
    await query(`UPDATE assets SET status = $1 WHERE id = $2`, [active ? 'allocated' : 'available', m.asset_id]);
  }

  await notify(m.raised_by, `maintenance_${t.to}`, `Your maintenance request #${m.id} is now ${t.to.replace('_', ' ')}`);
  await logActivity(req.user.id, `maintenance.${t.to}`, 'asset', m.asset_id, technician_id ? String(technician_id) : null);
  res.json(updated);
}));

export default router;
