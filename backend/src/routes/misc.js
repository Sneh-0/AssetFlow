// Dashboard KPIs (Screen 2), Notifications & Activity Log (Screen 10), Reports (Screen 9)
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', ah(async (req, res) => {
  const isManager = ['admin', 'asset_manager'].includes(req.user.role);

  const [kpis, overdue, upcoming, pendingBookings, myAssets, recentActivity, bookingTimeline] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM assets WHERE status = 'available') AS assets_available,
      (SELECT COUNT(*) FROM assets WHERE status = 'allocated') AS assets_allocated,
      (SELECT COUNT(*) FROM maintenance_requests WHERE status IN ('approved','assigned','in_progress')) AS maintenance_active,
      (SELECT COUNT(*) FROM bookings WHERE status != 'cancelled' AND now() BETWEEN start_time AND end_time) AS active_bookings,
      (SELECT COUNT(*) FROM transfer_requests WHERE status = 'pending') AS pending_transfers,
      (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings_count,
      (SELECT COUNT(*) FROM maintenance_requests WHERE status IN ('pending','approved','assigned','in_progress')) AS pending_maintenance_count,
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
    query(
      isManager
        ? `SELECT b.id, b.start_time, b.end_time, b.status, b.purpose, a.asset_tag, a.name AS asset_name, u.name AS booked_by_name
           FROM bookings b
           JOIN assets a ON a.id = b.asset_id
           JOIN users u ON u.id = b.booked_by
           WHERE b.status = 'pending'
           ORDER BY b.created_at DESC LIMIT 10`
        : `SELECT b.id, b.start_time, b.end_time, b.status, b.purpose, a.asset_tag, a.name AS asset_name, u.name AS booked_by_name
           FROM bookings b
           JOIN assets a ON a.id = b.asset_id
           JOIN users u ON u.id = b.booked_by
           WHERE b.booked_by = $1 AND b.status != 'cancelled'
           ORDER BY b.start_time LIMIT 10`,
      isManager ? undefined : [req.user.id],
    ),
    query(`SELECT al.id, al.expected_return_date, a.asset_tag, a.name AS asset_name, c.name AS category_name
           FROM allocations al
           JOIN assets a ON a.id = al.asset_id
           LEFT JOIN categories c ON c.id = a.category_id
           WHERE al.employee_id = $1 AND al.status = 'active'
           ORDER BY al.expected_return_date IS NULL, al.expected_return_date ASC LIMIT 10`, [req.user.id]),
    query(`SELECT l.*, u.name AS user_name
           FROM activity_logs l
           LEFT JOIN users u ON u.id = l.user_id
           ORDER BY l.created_at DESC LIMIT 10`),
    query(`SELECT b.id, b.start_time, b.end_time, b.purpose,
                 a.name AS asset_name, a.asset_tag,
                 u.name AS booked_by_name
           FROM bookings b
           JOIN assets a ON a.id = b.asset_id
           LEFT JOIN users u ON u.id = b.booked_by
           WHERE b.status = 'approved'
             AND b.start_time < CURRENT_DATE + INTERVAL '1 day'
             AND b.end_time >= CURRENT_DATE
           ORDER BY b.start_time ASC`),
  ]);

  const dashboardKpis = kpis.rows[0] || {};

  res.json({
    kpis: dashboardKpis,
    pending_bookings: pendingBookings.rows,
    my_assets: myAssets.rows,
    recent_activity: recentActivity.rows,
    booking_timeline: bookingTimeline.rows,
    overdue_returns: overdue.rows,
    upcoming_returns: upcoming.rows,
  });
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

// Reports & Analytics (Screen 9) — starter queries; P4 extends these
router.get('/reports', ah(async (req, res) => {
  const [byStatus, byDept, maintFreq, mostUsed, bookingHeatmap, idleAssets, warrantyExpiring] = await Promise.all([
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
    query(`SELECT EXTRACT(DOW FROM b.start_time)::int AS day_of_week,
                 EXTRACT(HOUR FROM b.start_time)::int AS hour_of_day,
                 COUNT(*)::int AS booking_count,
                 COALESCE(json_agg(json_build_object(
                   'booked_by_name', u.name,
                   'asset_name', a.name,
                   'asset_tag', a.asset_tag,
                   'purpose', b.purpose,
                   'start_time', b.start_time,
                   'end_time', b.end_time
                 ) ORDER BY b.start_time) FILTER (WHERE b.id IS NOT NULL), '[]'::json) AS bookings
           FROM bookings b
           JOIN assets a ON a.id = b.asset_id
           LEFT JOIN users u ON u.id = b.booked_by
           WHERE b.status = 'approved' AND b.start_time >= CURRENT_DATE - INTERVAL '45 days'
           GROUP BY 1, 2
           ORDER BY 1, 2`),
    query(`SELECT a.asset_tag, a.name, c.name AS category_name, COUNT(al.id)::int AS allocation_count
           FROM assets a
           JOIN categories c ON c.id = a.category_id
           LEFT JOIN allocations al ON al.asset_id = a.id
           WHERE a.status NOT IN ('retired', 'disposed', 'lost')
           GROUP BY a.id, c.name
           HAVING COUNT(al.id) = 0
           ORDER BY a.asset_tag LIMIT 10`),
    query(`SELECT asset_tag, name, warranty_expiry, (warranty_expiry < CURRENT_DATE) AS expired
           FROM assets
           WHERE warranty_expiry IS NOT NULL
             AND warranty_expiry < CURRENT_DATE + 90
             AND status NOT IN ('retired', 'disposed', 'lost')
           ORDER BY warranty_expiry LIMIT 10`),
  ]);
  res.json({
    assets_by_status: byStatus.rows,
    department_allocation: byDept.rows,
    maintenance_frequency: maintFreq.rows,
    most_used_assets: mostUsed.rows,
    bookings_heatmap: bookingHeatmap.rows,
    idle_assets: idleAssets.rows,
    warranty_expiring: warrantyExpiring.rows,
  });
}));

export default router;
