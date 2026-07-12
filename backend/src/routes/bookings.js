// Resource Booking (Screen 6): time slots with overlap validation and approval workflow
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// ?asset_id= for one resource's calendar; ?mine=true for my bookings
router.get('/', ah(async (req, res) => {
  const where = [];
  const params = [];
  const isManager = ['admin', 'asset_manager'].includes(req.user.role);

  if (req.query.asset_id) {
    // Viewing a specific resource's calendar/schedule: only show approved bookings
    params.push(req.query.asset_id);
    where.push(`b.asset_id = $${params.length}`);
    where.push(`b.status = 'approved'`);
  } else if (req.query.mine === 'true') {
    // Viewing my own bookings: show all statuses (pending, approved, rejected, cancelled)
    params.push(req.user.id);
    where.push(`b.booked_by = $${params.length}`);
    if (req.query.include_cancelled !== 'true') {
      where.push(`b.status != 'cancelled'`);
    }
  } else if (isManager) {
    // Admin or Asset Manager viewing the registry to approve/manage bookings: show all
    if (req.query.include_cancelled !== 'true') {
      where.push(`b.status != 'cancelled'`);
    }
  } else {
    // Regular employee viewing general bookings list: only show approved ones
    where.push(`b.status = 'approved'`);
  }

  const { rows } = await query(
    `SELECT b.*, a.asset_tag, a.name AS asset_name, u.name AS booked_by_name,
       CASE WHEN b.status = 'cancelled' THEN 'cancelled'
            WHEN b.status = 'rejected' THEN 'rejected'
            WHEN b.status = 'pending' THEN 'pending'
            WHEN now() < b.start_time THEN 'upcoming'
            WHEN now() BETWEEN b.start_time AND b.end_time THEN 'ongoing'
            ELSE 'completed' END AS live_status
     FROM bookings b
     JOIN assets a ON a.id = b.asset_id
     JOIN users u ON u.id = b.booked_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY b.start_time`, params);
  res.json(rows);
}));

// Create — default state is 'pending'. Checks clash with already 'approved' bookings.
router.post('/', ah(async (req, res) => {
  const { asset_id, start_time, end_time, purpose } = req.body;
  if (!asset_id || !start_time || !end_time) return res.status(400).json({ error: 'asset_id, start_time, end_time required' });
  if (new Date(end_time) <= new Date(start_time)) return res.status(400).json({ error: 'end_time must be after start_time' });

  const { rows: [asset] } = await query(`SELECT * FROM assets WHERE id = $1 AND is_bookable = true`, [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Bookable resource not found' });

  // Overlap validation: only clash with approved bookings
  const { rows: [clash] } = await query(
    `SELECT b.*, u.name AS booked_by_name FROM bookings b JOIN users u ON u.id = b.booked_by
     WHERE b.asset_id = $1 AND b.status = 'approved'
       AND b.start_time < $3 AND b.end_time > $2
     LIMIT 1`, [asset_id, start_time, end_time]);
  if (clash) {
    return res.status(409).json({
      error: `Overlaps an existing booking by ${clash.booked_by_name} (${new Date(clash.start_time).toLocaleString()} – ${new Date(clash.end_time).toLocaleString()})`,
    });
  }

  const { rows: [booking] } = await query(
    `INSERT INTO bookings (asset_id, booked_by, start_time, end_time, purpose, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`, [asset_id, req.user.id, start_time, end_time, purpose || null]);

  await logActivity(req.user.id, 'booking.created', 'asset', asset_id, `${asset.name} (pending approval)`);
  await notify(req.user.id, 'booking_requested', `Booking requested (pending approval): ${asset.name}`);
  res.status(201).json(booking);
}));

// Cancel booking (Only owned bookings in pending/approved states)
router.post('/:id/cancel', ah(async (req, res) => {
  const { rows: [booking] } = await query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND booked_by = $2 AND status IN ('pending', 'approved') RETURNING *`,
    [req.params.id, req.user.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found or cannot be cancelled' });
  
  await notify(req.user.id, 'booking_cancelled', 'Your booking was cancelled');
  await logActivity(req.user.id, 'booking.cancelled', 'booking', booking.id, null);
  res.json(booking);
}));

// Approve a booking (Admin/Manager only)
router.post('/:id/approve', ah(async (req, res) => {
  if (!['admin', 'asset_manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admins or asset managers can approve bookings' });
  }

  const { rows: [booking] } = await query(`SELECT * FROM bookings WHERE id = $1`, [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Only pending bookings can be approved' });

  // Double check overlap on approval
  const { rows: [clash] } = await query(
    `SELECT b.*, u.name AS booked_by_name FROM bookings b JOIN users u ON u.id = b.booked_by
     WHERE b.asset_id = $1 AND b.status = 'approved' AND b.id != $2
       AND b.start_time < $4 AND b.end_time > $3
     LIMIT 1`, [booking.asset_id, booking.id, booking.start_time, booking.end_time]);

  if (clash) {
    return res.status(409).json({
      error: `Cannot approve. Overlaps with an approved booking by ${clash.booked_by_name} (${new Date(clash.start_time).toLocaleString()} – ${new Date(clash.end_time).toLocaleString()})`,
    });
  }

  const { rows: [approved] } = await query(
    `UPDATE bookings SET status = 'approved' WHERE id = $1 RETURNING *`, [req.params.id]);

  const { rows: [asset] } = await query(`SELECT name FROM assets WHERE id = $1`, [approved.asset_id]);

  await logActivity(req.user.id, 'booking.approved', 'booking', approved.id, `Approved booking for ${asset?.name || approved.asset_id}`);
  await notify(approved.booked_by, 'booking_confirmed', `Your booking for ${asset?.name || approved.asset_id} was approved`);

  res.json(approved);
}));

// Reject a booking (Admin/Manager only)
router.post('/:id/reject', ah(async (req, res) => {
  if (!['admin', 'asset_manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admins or asset managers can reject bookings' });
  }

  const { rows: [booking] } = await query(`SELECT * FROM bookings WHERE id = $1`, [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Only pending bookings can be rejected' });

  const { rows: [rejected] } = await query(
    `UPDATE bookings SET status = 'rejected' WHERE id = $1 RETURNING *`, [req.params.id]);

  const { rows: [asset] } = await query(`SELECT name FROM assets WHERE id = $1`, [rejected.asset_id]);

  await logActivity(req.user.id, 'booking.rejected', 'booking', rejected.id, `Rejected booking for ${asset?.name || rejected.asset_id}`);
  await notify(rejected.booked_by, 'booking_rejected', `Your booking request for ${asset?.name || rejected.asset_id} was rejected`);

  res.json(rejected);
}));

export default router;
