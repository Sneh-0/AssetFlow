// Asset Audit (Screen 8): cycles, auditor assignment, verification, discrepancy report, close
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// List all audit cycles with computed stats
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
    const pIdx = params.length;
    params.push(cycle.scope_department_id);
    const pIdx2 = params.length;
    scope.push(`EXISTS (SELECT 1 FROM allocations al JOIN users u ON u.id = al.employee_id
                WHERE al.asset_id = a.id AND al.status = 'active'
                AND (al.department_id = $${pIdx} OR u.department_id = $${pIdx2}))`);
  }
  const { rows: assets } = await query(
    `SELECT a.id, a.asset_tag, a.name, a.status, a.location,
            ar.result, ar.notes, ar.audited_at, au.name AS audited_by_name, au.id AS audited_by_id
     FROM assets a
     LEFT JOIN audit_records ar ON ar.asset_id = a.id AND ar.cycle_id = $1
     LEFT JOIN users au ON au.id = ar.audited_by
     ${scope.length ? 'WHERE ' + scope.join(' AND ') : ''}
     ORDER BY a.asset_tag`, params);

  const { rows: auditors } = await query(
    `SELECT auditor_id FROM audit_assignments WHERE cycle_id = $1`, [req.params.id]);
  const auditor_ids = auditors.map(a => a.auditor_id);

  res.json({ ...cycle, auditor_ids, assets });
}));

// Summary stats for a cycle: per-result counts + per-auditor contribution
router.get('/:id/summary', ah(async (req, res) => {
  const { rows: [cycle] } = await query(`SELECT * FROM audit_cycles WHERE id = $1`, [req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });

  const params = [];
  const scope = [];
  if (cycle.scope_location) { params.push(`%${cycle.scope_location}%`); scope.push(`a.location ILIKE $${params.length}`); }
  if (cycle.scope_department_id) {
    params.push(cycle.scope_department_id);
    const pIdx = params.length;
    params.push(cycle.scope_department_id);
    const pIdx2 = params.length;
    scope.push(`EXISTS (SELECT 1 FROM allocations al JOIN users u ON u.id = al.employee_id
                WHERE al.asset_id = a.id AND al.status = 'active'
                AND (al.department_id = $${pIdx} OR u.department_id = $${pIdx2}))`);
  }

  const { rows: allAssets } = await query(
    `SELECT a.id FROM assets a
     ${scope.length ? 'WHERE ' + scope.join(' AND ') : ''}`,
    params.length > 0 ? params : undefined);

  const totalCount = allAssets.length;

  const [resultCounts, auditorStats] = await Promise.all([
    query(
      `SELECT result, COUNT(*)::int AS count FROM audit_records WHERE cycle_id = $1 GROUP BY result`,
      [req.params.id]),
    query(
      `SELECT u.id, u.name, COUNT(ar.id)::int AS checked
       FROM audit_assignments aa
       JOIN users u ON u.id = aa.auditor_id
       LEFT JOIN audit_records ar ON ar.cycle_id = aa.cycle_id AND ar.audited_by = u.id
       WHERE aa.cycle_id = $1
       GROUP BY u.id, u.name`,
      [req.params.id]),
  ]);

  const counts = { verified: 0, missing: 0, damaged: 0 };
  resultCounts.rows.forEach(r => { counts[r.result] = r.count; });
  counts.unchecked = totalCount - (counts.verified + counts.missing + counts.damaged);

  res.json({ total: totalCount, counts, auditor_stats: auditorStats.rows });
}));

// Create a cycle — open to admin AND asset_manager
router.post('/', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
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

// Update an open cycle — name, dates, auditors (admin/manager only)
router.put('/:id', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { name, start_date, end_date, auditor_ids } = req.body;

  const { rows: [cycle] } = await query(
    `UPDATE audit_cycles SET
       name = COALESCE($1, name),
       start_date = COALESCE($2, start_date),
       end_date = COALESCE($3, end_date)
     WHERE id = $4 AND status = 'open' RETURNING *`,
    [name || null, start_date || null, end_date || null, req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Open audit cycle not found' });

  // Update auditor assignments if provided
  if (Array.isArray(auditor_ids)) {
    await query(`DELETE FROM audit_assignments WHERE cycle_id = $1`, [req.params.id]);
    for (const auditorId of auditor_ids) {
      await query(`INSERT INTO audit_assignments (cycle_id, auditor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cycle.id, auditorId]);
    }
  }

  await logActivity(req.user.id, 'audit.updated', 'audit_cycle', cycle.id, cycle.name);
  res.json(cycle);
}));

// Auditor marks an asset: verified / missing / damaged
router.post('/:id/records', ah(async (req, res) => {
  const { asset_id, result, notes } = req.body;
  if (!['verified', 'missing', 'damaged'].includes(result)) return res.status(400).json({ error: 'result must be verified|missing|damaged' });

  const { rows: [cycle] } = await query(`SELECT * FROM audit_cycles WHERE id = $1 AND status = 'open'`, [req.params.id]);
  if (!cycle) return res.status(404).json({ error: 'Open audit cycle not found (closed cycles are locked)' });

  // Enforce permissions: Admin, Asset Manager, or assigned Auditor
  if (!['admin', 'asset_manager'].includes(req.user.role)) {
    const { rows: assignment } = await query(
      `SELECT 1 FROM audit_assignments WHERE cycle_id = $1 AND auditor_id = $2`,
      [req.params.id, req.user.id]
    );
    if (assignment.length === 0) {
      return res.status(403).json({ error: 'You are not assigned as an auditor for this audit cycle.' });
    }
  }

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

// Discrepancy report for flagged items
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
