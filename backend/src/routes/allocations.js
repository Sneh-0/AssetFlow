// Asset Allocation & Transfer (Screen 5): conflict rule, transfer workflow, return flow, overdue flagging
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// ?mine=true → only my allocations; ?overdue=true → past expected return date
router.get('/', ah(async (req, res) => {
  const where = [`1=1`];
  const params = [];
  if (req.query.mine === 'true') { params.push(req.user.id); where.push(`al.employee_id = $${params.length}`); }
  if (req.query.active === 'true') where.push(`al.status = 'active'`);
  if (req.query.overdue === 'true') where.push(`al.status = 'active' AND al.expected_return_date < CURRENT_DATE`);

  const { rows } = await query(
    `SELECT al.*, a.asset_tag, a.name AS asset_name, u.name AS employee_name, d.name AS department_name,
            (al.status = 'active' AND al.expected_return_date < CURRENT_DATE) AS is_overdue
     FROM allocations al
     JOIN assets a ON a.id = al.asset_id
     LEFT JOIN users u ON u.id = al.employee_id
     LEFT JOIN departments d ON d.id = al.department_id
     WHERE ${where.join(' AND ')}
     ORDER BY al.allocated_at DESC`, params);
  res.json(rows);
}));

// Allocate — THE conflict rule: blocked if already held, respond with holder + hint to request transfer
router.post('/', requireRole('admin', 'asset_manager', 'dept_head'), ah(async (req, res) => {
  const { asset_id, employee_id, department_id, expected_return_date } = req.body;
  if (!asset_id || (!employee_id && !department_id)) {
    return res.status(400).json({ error: 'asset_id and an employee_id or department_id are required' });
  }

  const { rows: [existing] } = await query(
    `SELECT al.id, u.name AS holder_name, d.name AS holder_department
     FROM allocations al
     LEFT JOIN users u ON u.id = al.employee_id
     LEFT JOIN departments d ON d.id = al.department_id
     WHERE al.asset_id = $1 AND al.status = 'active'`, [asset_id]);
  if (existing) {
    return res.status(409).json({
      error: `Asset is currently held by ${existing.holder_name || existing.holder_department}`,
      held_by: existing.holder_name || existing.holder_department,
      allocation_id: existing.id,
      hint: 'Raise a transfer request instead',
    });
  }

  const { rows: [asset] } = await query(`SELECT * FROM assets WHERE id = $1`, [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (asset.status !== 'available') return res.status(409).json({ error: `Asset is ${asset.status}, not available` });

  const { rows: [alloc] } = await query(
    `INSERT INTO allocations (asset_id, employee_id, department_id, allocated_by, expected_return_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [asset_id, employee_id || null, department_id || null, req.user.id, expected_return_date || null]);
  await query(`UPDATE assets SET status = 'allocated' WHERE id = $1`, [asset_id]);
  await logActivity(req.user.id, 'allocation.created', 'asset', asset_id, `${asset.asset_tag} allocated`);
  await notify(employee_id, 'asset_assigned', `${asset.name} (${asset.asset_tag}) has been assigned to you`);
  res.status(201).json(alloc);
}));

// Return flow: mark returned + condition notes, asset reverts to Available
router.post('/:id/return', ah(async (req, res) => {
  const { return_notes, condition } = req.body;
  const { rows: [alloc] } = await query(
    `UPDATE allocations SET status = 'returned', returned_at = now(), return_notes = $1
     WHERE id = $2 AND status = 'active' RETURNING *`, [return_notes || null, req.params.id]);
  if (!alloc) return res.status(404).json({ error: 'Active allocation not found' });

  await query(`UPDATE assets SET status = 'available', condition = COALESCE($1, condition) WHERE id = $2`,
    [condition, alloc.asset_id]);
  await logActivity(req.user.id, 'allocation.returned', 'asset', alloc.asset_id, return_notes);
  res.json(alloc);
}));

// ---- Transfer workflow: Requested → Approved → Re-allocated ----
router.get('/transfers', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, a.asset_tag, a.name AS asset_name, rb.name AS requested_by_name,
            te.name AS to_employee_name, te.department_id AS to_employee_dept_id,
            td.name AS to_department_name, db.name AS decided_by_name
     FROM transfer_requests t
     JOIN assets a ON a.id = t.asset_id
     JOIN users rb ON rb.id = t.requested_by
     LEFT JOIN users te ON te.id = t.to_employee_id
     LEFT JOIN departments td ON td.id = t.to_department_id
     LEFT JOIN users db ON db.id = t.decided_by
     ORDER BY t.created_at DESC`);
  res.json(rows);
}));

router.post('/transfers', ah(async (req, res) => {
  const { asset_id, to_employee_id, to_department_id, reason } = req.body;
  const { rows: [current] } = await query(
    `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'active'`, [asset_id]);
  if (!current) return res.status(400).json({ error: 'Asset is not allocated — allocate it directly instead' });

  const { rows: [t] } = await query(
    `INSERT INTO transfer_requests (asset_id, from_allocation_id, requested_by, to_employee_id, to_department_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [asset_id, current.id, req.user.id, to_employee_id || null, to_department_id || null, reason || null]);
  await logActivity(req.user.id, 'transfer.requested', 'asset', asset_id, reason);
  res.status(201).json(t);
}));

// Approve/reject (Asset Manager or Department Head). Approval re-allocates automatically.
router.put('/transfers/:id', requireRole('admin', 'asset_manager', 'dept_head'), ah(async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

  const { rows: [t] } = await query(
    `UPDATE transfer_requests SET status = $1, decided_by = $2, decided_at = now()
     WHERE id = $3 AND status = 'pending' RETURNING *`,
    [action === 'approve' ? 'approved' : 'rejected', req.user.id, req.params.id]);
  if (!t) return res.status(404).json({ error: 'Pending transfer not found' });

  if (action === 'approve') {
    // Close old allocation, open new one — history updates automatically
    await query(`UPDATE allocations SET status = 'returned', returned_at = now(), return_notes = 'Transferred'
                 WHERE id = $1`, [t.from_allocation_id]);
    await query(
      `INSERT INTO allocations (asset_id, employee_id, department_id, allocated_by)
       VALUES ($1, $2, $3, $4)`, [t.asset_id, t.to_employee_id, t.to_department_id, req.user.id]);
    await query(`UPDATE assets SET status = 'allocated' WHERE id = $1`, [t.asset_id]);
    await notify(t.to_employee_id, 'transfer_approved', `A transferred asset has been assigned to you`);
  }
  await notify(t.requested_by, `transfer_${t.status}`, `Your transfer request was ${t.status}`);
  await logActivity(req.user.id, `transfer.${t.status}`, 'asset', t.asset_id, null);
  res.json(t);
}));

export default router;
