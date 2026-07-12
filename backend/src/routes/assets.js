// Asset Registration & Directory (Screen 4)
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, logActivity, nextAssetTag } from '../helpers.js';

const router = Router();

// Public scan endpoint — NO auth, must be before router.use(requireAuth) and before /:id
router.get('/scan/:tag', ah(async (req, res) => {
  const { rows: [asset] } = await query(
    `SELECT a.*, c.name AS category_name FROM assets a
     JOIN categories c ON c.id = a.category_id
     WHERE a.asset_tag = $1`, [req.params.tag]);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const { rows: [allocation] } = await query(
    `SELECT al.*, u.name AS employee_name, u.email AS employee_email,
            d.name AS department_name, by_u.name AS allocated_by_name
     FROM allocations al
     LEFT JOIN users u ON u.id = al.employee_id
     LEFT JOIN departments d ON d.id = COALESCE(al.department_id, u.department_id)
     LEFT JOIN users by_u ON by_u.id = al.allocated_by
     WHERE al.asset_id = $1 AND al.status = 'active'`, [asset.id]);

  const { rows: maintenance } = await query(
    `SELECT m.status, m.issue, m.priority, m.created_at, m.resolved_at, u.name AS raised_by_name
     FROM maintenance_requests m JOIN users u ON u.id = m.raised_by
     WHERE m.asset_id = $1 ORDER BY m.created_at DESC LIMIT 10`, [asset.id]);

  const { rows: history } = await query(
    `SELECT al.*, u.name AS employee_name, d.name AS department_name, by_u.name AS allocated_by_name
     FROM allocations al
     LEFT JOIN users u ON u.id = al.employee_id
     LEFT JOIN departments d ON d.id = al.department_id
     LEFT JOIN users by_u ON by_u.id = al.allocated_by
     WHERE al.asset_id = $1 ORDER BY al.allocated_at DESC`, [asset.id]);

  const { rows: transfers } = await query(
    `SELECT t.*, a.asset_tag, rb.name AS requested_by_name,
            te.name AS to_employee_name, td.name AS to_department_name
     FROM transfer_requests t
     JOIN assets a ON a.id = t.asset_id
     JOIN users rb ON rb.id = t.requested_by
     LEFT JOIN users te ON te.id = t.to_employee_id
     LEFT JOIN departments td ON td.id = t.to_department_id
     WHERE t.asset_id = $1 ORDER BY t.created_at DESC`, [asset.id]);

  const { rows: audits } = await query(
    `SELECT ar.result, ar.notes, ar.audited_at, ac.name AS cycle_name, u.name AS audited_by_name
     FROM audit_records ar
     JOIN audit_cycles ac ON ac.id = ar.cycle_id
     JOIN users u ON u.id = ar.audited_by
     WHERE ar.asset_id = $1 ORDER BY ar.audited_at DESC`, [asset.id]);

  res.json({ asset, allocation: allocation || null, maintenance, history, transfers, audits });
}));

router.use(requireAuth);

// Search/filter: ?q=<tag|serial|name>&category=&status=&location=&bookable=true
router.get('/', ah(async (req, res) => {
  const { q, category, status, location, bookable, department } = req.query;
  const where = [];
  const params = [];
  if (q) { params.push(`%${q}%`); where.push(`(a.asset_tag ILIKE $${params.length} OR a.serial_number ILIKE $${params.length} OR a.name ILIKE $${params.length})`); }
  if (category) { params.push(category); where.push(`a.category_id = $${params.length}`); }
  if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
  if (location) { params.push(`%${location}%`); where.push(`a.location ILIKE $${params.length}`); }
  if (bookable === 'true') where.push(`a.is_bookable = true`);
  if (department) {
    params.push(department);
    where.push(`EXISTS (
      SELECT 1 FROM allocations al2
      JOIN users u2 ON u2.id = al2.employee_id
      WHERE al2.asset_id = a.id AND al2.status = 'active'
      AND (al2.department_id = $${params.length} OR u2.department_id = $${params.length})
    )`);
  }

  const { rows } = await query(
    `SELECT a.*, c.name AS category_name,
            holder.name AS holder_name, hd.name AS holder_department
     FROM assets a
     JOIN categories c ON c.id = a.category_id
     LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'active'
     LEFT JOIN users holder ON holder.id = al.employee_id
     LEFT JOIN departments hd ON hd.id = al.department_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY a.asset_tag`, params);
  res.json(rows);
}));

// Per-asset detail + full allocation & maintenance history
router.get('/:id', ah(async (req, res) => {
  const { rows: [asset] } = await query(
    `SELECT a.*, c.name AS category_name FROM assets a JOIN categories c ON c.id = a.category_id WHERE a.id = $1`,
    [req.params.id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const { rows: allocations } = await query(
    `SELECT al.*, u.name AS employee_name, d.name AS department_name, by_u.name AS allocated_by_name
     FROM allocations al
     LEFT JOIN users u ON u.id = al.employee_id
     LEFT JOIN departments d ON d.id = al.department_id
     LEFT JOIN users by_u ON by_u.id = al.allocated_by
     WHERE al.asset_id = $1 ORDER BY al.allocated_at DESC`, [req.params.id]);

  const { rows: maintenance } = await query(
    `SELECT m.*, u.name AS raised_by_name FROM maintenance_requests m
     JOIN users u ON u.id = m.raised_by WHERE m.asset_id = $1 ORDER BY m.created_at DESC`, [req.params.id]);

  res.json({ ...asset, allocations, maintenance });
}));

router.post('/', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { name, category_id, serial_number, acquisition_date, acquisition_cost,
          condition, location, image_url, is_bookable, custom_values,
          brand, model, vendor, warranty_expiry } = req.body;
  if (!name || !category_id) return res.status(400).json({ error: 'name and category_id are required' });

  const tag = await nextAssetTag();
  const { rows: [asset] } = await query(
    `INSERT INTO assets (asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost,
                         condition, location, image_url, is_bookable, custom_values, created_by,
                         brand, model, vendor, warranty_expiry)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'good'),$8,$9,COALESCE($10,false),COALESCE($11::jsonb,'{}'::jsonb),$12,
             $13,$14,$15,$16) RETURNING *`,
    [tag, name, category_id, serial_number || null, acquisition_date || null, acquisition_cost || null,
     condition, location || null, image_url || null, is_bookable, custom_values || null, req.user.id,
     brand || null, model || null, vendor || null, warranty_expiry || null]);
  await logActivity(req.user.id, 'asset.created', 'asset', asset.id, `${tag} ${name}`);
  res.status(201).json(asset);
}));

router.delete('/:id', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { rows: [active] } = await query(
    `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'active'`, [req.params.id]);
  if (active) return res.status(409).json({ error: 'Cannot delete an asset that is currently allocated. Return it first.' });

  const { rows: [asset] } = await query(`DELETE FROM assets WHERE id = $1 RETURNING *`, [req.params.id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  await logActivity(req.user.id, 'asset.deleted', 'asset', req.params.id, `${asset.asset_tag} ${asset.name}`);
  res.json({ ok: true });
}));

// Edit details or manually transition lifecycle status (lost/retired/disposed etc.)
router.put('/:id', requireRole('admin', 'asset_manager'), ah(async (req, res) => {
  const { name, condition, location, status, is_bookable, image_url, brand, model, vendor, warranty_expiry } = req.body;
  const valid = ['available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed'];
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { rows: [asset] } = await query(
    `UPDATE assets SET name = COALESCE($1, name), condition = COALESCE($2, condition),
       location = COALESCE($3, location), status = COALESCE($4, status),
       is_bookable = COALESCE($5, is_bookable), image_url = COALESCE($6, image_url),
       brand = COALESCE($7, brand), model = COALESCE($8, model),
       vendor = COALESCE($9, vendor), warranty_expiry = COALESCE($10, warranty_expiry)
     WHERE id = $11 RETURNING *`,
    [name, condition, location, status, is_bookable, image_url, brand, model, vendor, warranty_expiry, req.params.id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  await logActivity(req.user.id, 'asset.updated', 'asset', asset.id, `${asset.asset_tag}${status ? ' → ' + status : ''}`);
  res.json(asset);
}));

export default router;
