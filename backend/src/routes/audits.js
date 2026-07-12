// Asset Audit (Screen 8): cycles, auditor assignment, verification, discrepancy report, close
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT ac.*, d.name AS department_name, u.name AS created_by_name,
       (SELECT COUNT(*) FROM audit_records ar WHERE ar.cycle_id = ac.id) AS records_count,
       (SELECT COUNT(*) FROM audit_records ar WHERE ar.cycle_id = ac.id AND ar.result != 'verified') AS discrepancy_count,
       (SELECT json_agg(json_build_object('id', au.id, 'name', au.name))
          FROM audit_assignments aa JOIN users au ON au.id = aa.auditor_id WHERE aa.cycle_id = ac.id) AS auditors
     FROM audit_cycles ac
     LEFT JOIN departments d ON d.id = ac.scope_department_id
     JOIN users u ON u.id = ac.created_by
     ORDER BY ac.created_at DESC`);
  res.json(rows);
}));

// Cycle detail: assets in scope + their audit records (the working checklist for auditors)
router.get('/:id', ah(async (req, res) => {
  const { rows: [cycle] } = await query(`SELECT * FROM audit_cycles WHERE id = $1`, [req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });

  const params = [req.params.id];
  const scope = [];
  if (cycle.scope_location) { params.push(`%${cycle.scope_location}%`); scope.push(`a.location ILIKE $${params.length}`); }
  if (cycle.scope_department_id) {
    params.push(cycle.scope_department_id);
    scope.push(`EXISTS (SELECT 1 FROM allocations al JOIN users u ON u.id = al.employee_id
                WHERE al.asset_id = a.id AND al.status = 'active'
                AND (al.department_id = $${params.length} OR u.department_id = $${params.length}))`);
  }
  const { rows: assets } = await query(
    `SELECT a.id, a.asset_tag, a.name, a.status, a.location,
            ar.result, ar.notes, ar.audited_at, au.name AS audited_by_name
     FROM assets a
     LEFT JOIN audit_records ar ON ar.asset_id = a.id AND ar.cycle_id = $1
     LEFT JOIN users au ON au.id = ar.audited_by
     ${scope.length ? 'WHERE ' + scope.join(' AND ') : ''}
     ORDER BY a.asset_tag`, params);
  res.json({ ...cycle, assets });
}));

router.post('/', requireRole('admin'), ah(async (req, res) => {
  const { name, scope_department_id, scope_location, start_date, end_date, auditor_ids } = req.body;
  if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date required' });

  const { rows: [cycle] } = await query(
    `INSERT INTO audit_cycles (name, scope_department_id, scope_location, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, scope_department_id || null, scope_location || null, start_date, end_date, req.user.id]);

  for (const auditorId of auditor_ids || []) {
    await query(`INSERT INTO audit_assignments (cycle_id, auditor_id) VALUES ($1, $2)`, [cycle.id, auditorId]);
    await notify(auditorId, 'audit_assigned', `You've been assigned as auditor on: ${name}`);
  }
  await logActivity(req.user.id, 'audit.created', 'audit_cycle', cycle.id, name);
  res.status(201).json(cycle);
}));

// Auditor marks an asset: verified / missing / damaged
router.post('/:id/records', ah(async (req, res) => {
  const { asset_id, result, notes } = req.body;
  if (!['verified', 'missing', 'damaged'].includes(result)) return res.status(400).json({ error: 'result must be verified|missing|damaged' });

  const { rows: [cycle] } = await query(`SELECT * FROM audit_cycles WHERE id = $1 AND status = 'open'`, [req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Open audit cycle not found (closed cycles are locked)' });

  const { rows: [record] } = await query(
    `INSERT INTO audit_records (cycle_id, asset_id, result, notes, audited_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (cycle_id, asset_id) DO UPDATE SET result = $3, notes = $4, audited_by = $5, audited_at = now()
     RETURNING *`, [req.params.id, asset_id, result, notes || null, req.user.id]);
  if (result !== 'verified') {
    await logActivity(req.user.id, 'audit.discrepancy', 'asset', asset_id, `${result}: ${notes || ''}`);
  }
  res.status(201).json(record);
}));

// Auto-generated discrepancy report for flagged items
router.get('/:id/discrepancies', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT ar.*, a.asset_tag, a.name AS asset_name, a.location, u.name AS audited_by_name
     FROM audit_records ar
     JOIN assets a ON a.id = ar.asset_id
     JOIN users u ON u.id = ar.audited_by
     WHERE ar.cycle_id = $1 AND ar.result != 'verified'
     ORDER BY ar.result, a.asset_tag`, [req.params.id]);
  res.json(rows);
}));

// Close cycle — locks it and updates asset statuses (missing → lost)
router.post('/:id/close', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { rows: [cycle] } = await query(
    `UPDATE audit_cycles SET status = 'closed', closed_at = now() WHERE id = $1 AND status = 'open' RETURNING *`,
    [req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Open audit cycle not found' });

  await query(
    `UPDATE assets SET status = 'lost' WHERE id IN
     (SELECT asset_id FROM audit_records WHERE cycle_id = $1 AND result = 'missing')`, [req.params.id]);
  await logActivity(req.user.id, 'audit.closed', 'audit_cycle', cycle.id, cycle.name);
  res.json(cycle);
}));

export default router;
