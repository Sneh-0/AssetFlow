// Resource Booking (Screen 6): time slots with overlap validation
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, logActivity, notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

// ?asset_id= for one resource's calendar; ?mine=true for my bookings
router.get('/', ah(async (req, res) => {
  const where = [`(b.status != 'cancelled' OR $1 = 'include_cancelled')`];
  const params = [req.query.include_cancelled === 'true' ? 'include_cancelled' : ''];
  if (req.query.asset_id) { params.push(req.query.asset_id); where.push(`b.asset_id = $${params.length}`); }
  if (req.query.mine === 'true') { params.push(req.user.id); where.push(`b.booked_by = $${params.length}`); }

  const { rows } = await query(
    `SELECT b.*, a.asset_tag, a.name AS asset_name, u.name AS booked_by_name,
       CASE WHEN b.status = 'cancelled' THEN 'cancelled'
            WHEN now() < b.start_time THEN 'upcoming'
            WHEN now() BETWEEN b.start_time AND b.end_time THEN 'ongoing'
            ELSE 'completed' END AS live_status
     FROM bookings b
     JOIN assets a ON a.id = b.asset_id
     JOIN users u ON u.id = b.booked_by
     WHERE ${where.join(' AND ')}
     ORDER BY b.start_time`, params);
  res.json(rows);
}));

// Create — overlap validation: [start, end) ranges; back-to-back (10:00 after 9:00–10:00) is allowed
router.post('/', ah(async (req, res) => {
  const { asset_id, start_time, end_time, purpose } = req.body;
  if (!asset_id || !start_time || !end_time) return res.status(400).json({ error: 'asset_id, start_time, end_time required' });
  if (new Date(end_time) <= new Date(start_time)) return res.status(400).json({ error: 'end_time must be after start_time' });

  const { rows: [asset] } = await query(`SELECT * FROM assets WHERE id = $1 AND is_bookable = true`, [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Bookable resource not found' });

  const { rows: [clash] } = await query(
    `SELECT b.*, u.name AS booked_by_name FROM bookings b JOIN users u ON u.id = b.booked_by
     WHERE b.asset_id = $1 AND b.status != 'cancelled'
       AND b.start_time < $3 AND b.end_time > $2
     LIMIT 1`, [asset_id, start_time, end_time]);
  if (clash) {
    return res.status(409).json({
      error: `Overlaps an existing booking by ${clash.booked_by_name} (${new Date(clash.start_time).toLocaleString()} – ${new Date(clash.end_time).toLocaleString()})`,
    });
  }

  const { rows: [booking] } = await query(
    `INSERT INTO bookings (asset_id, booked_by, start_time, end_time, purpose)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`, [asset_id, req.user.id, start_time, end_time, purpose || null]);
  await logActivity(req.user.id, 'booking.created', 'asset', asset_id, `${asset.name}`);
  await notify(req.user.id, 'booking_confirmed', `Booking confirmed: ${asset.name}`);
  res.status(201).json(booking);
}));

router.post('/:id/cancel', ah(async (req, res) => {
  const { rows: [booking] } = await query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND booked_by = $2 RETURNING *`,
    [req.params.id, req.user.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found (you can only cancel your own)' });
  await notify(req.user.id, 'booking_cancelled', 'Your booking was cancelled');
  await logActivity(req.user.id, 'booking.cancelled', 'booking', booking.id, null);
  res.json(booking);
}));

// TODO(hackathon): reschedule = cancel + rebook client-side, or add PUT here with the same overlap check
export default router;
