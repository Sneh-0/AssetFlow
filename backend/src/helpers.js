import { query } from './db.js';

// Wrap async route handlers so thrown errors hit the error middleware (Express 4)
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export async function notify(userId, type, message) {
  if (!userId) return;
  await query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)`, [userId, type, message]);
}

export async function logActivity(userId, action, entityType, entityId, details) {
  await query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, entityType, entityId, details]
  );
}

export async function nextAssetTag() {
  const { rows } = await query(`SELECT asset_tag FROM assets ORDER BY id DESC LIMIT 1`);
  const last = rows[0] ? parseInt(rows[0].asset_tag.split('-')[1], 10) : 0;
  return `AF-${String(last + 1).padStart(4, '0')}`;
}
