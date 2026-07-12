// Dashboard KPIs (Screen 2), Notifications & Activity Log (Screen 10), Reports (Screen 9)
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', ah(async (req, res) => {
  const [kpis, overdue, upcoming] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM assets WHERE status = 'available') AS assets_available,
      (SELECT COUNT(*) FROM assets WHERE status = 'allocated') AS assets_allocated,
      (SELECT COUNT(*) FROM maintenance_requests WHERE status IN ('approved','assigned','in_progress')) AS maintenance_active,
      (SELECT COUNT(*) FROM bookings WHERE status != 'cancelled' AND now() BETWEEN start_time AND end_time) AS active_bookings,
      (SELECT COUNT(*) FROM transfer_requests WHERE status = 'pending') AS pending_transfers,
      (SELECT COUNT(*) FROM allocations WHERE status = 'active' AND expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS upcoming_returns,
      (SELECT COUNT(*) FROM allocations WHERE status = 'active' AND expected_return_date < CURRENT_DATE) AS overdue_returns`),
    query(`SELECT al.id, al.expected_return_date, a.asset_tag, a.name AS asset_name, u.name AS employee_name
           FROM allocations al JOIN assets a ON a.id = al.asset_id LEFT JOIN users u ON u.id = al.employee_id
           WHERE al.status = 'active' AND al.expected_return_date < CURRENT_DATE
           ORDER BY al.expected_return_date LIMIT 10`),
    query(`SELECT al.id, al.expected_return_date, a.asset_tag, a.name AS asset_name, u.name AS employee_name
           FROM allocations al JOIN assets a ON a.id = al.asset_id LEFT JOIN users u ON u.id = al.employee_id
           WHERE al.status = 'active' AND al.expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           ORDER BY al.expected_return_date LIMIT 10`),
  ]);
  res.json({ kpis: kpis.rows[0], overdue_returns: overdue.rows, upcoming_returns: upcoming.rows });
}));

router.get('/notifications', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  res.json(rows);
}));

router.post('/notifications/read-all', ah(async (req, res) => {
  await query(`UPDATE notifications SET read = true WHERE user_id = $1`, [req.user.id]);
  res.json({ ok: true });
}));

router.get('/activity', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT l.*, u.name AS user_name FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC LIMIT 100`);
  res.json(rows);
}));

// Reports & Analytics (Screen 9) — recharts + booking heatmap
router.get('/reports', ah(async (req, res) => {
  const [byStatus, byDept, maintFreq, mostUsed, heatmap] = await Promise.all([
    query(`SELECT status, COUNT(*)::int AS count FROM assets GROUP BY status ORDER BY count DESC`),
    query(`SELECT COALESCE(d.name, ud.name, 'Unassigned') AS department, COUNT(*)::int AS count
           FROM allocations al
           LEFT JOIN departments d ON d.id = al.department_id
           LEFT JOIN users u ON u.id = al.employee_id
           LEFT JOIN departments ud ON ud.id = u.department_id
           WHERE al.status = 'active' GROUP BY 1 ORDER BY count DESC`),
    query(`SELECT a.asset_tag, a.name, COUNT(m.id)::int AS requests
           FROM maintenance_requests m JOIN assets a ON a.id = m.asset_id
           GROUP BY a.id ORDER BY requests DESC LIMIT 10`),
    query(`SELECT a.asset_tag, a.name, COUNT(al.id)::int AS allocation_count
           FROM assets a LEFT JOIN allocations al ON al.asset_id = a.id
           GROUP BY a.id ORDER BY allocation_count DESC LIMIT 10`),
    query(`SELECT EXTRACT(DOW FROM start_time)::int AS day,
                  EXTRACT(HOUR FROM start_time)::int AS hour,
                  COUNT(*)::int AS count
           FROM bookings WHERE status != 'cancelled'
           GROUP BY 1, 2 ORDER BY 1, 2`),
  ]);
  res.json({
    assets_by_status: byStatus.rows,
    department_allocation: byDept.rows,
    maintenance_frequency: maintFreq.rows,
    most_used_assets: mostUsed.rows,
    booking_heatmap: heatmap.rows,
  });
}));

export default router;
