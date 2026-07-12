import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/assetflow';

export const pool = new pg.Pool({
  connectionString,
  // Supabase (and most hosted Postgres) requires SSL; local postgres does not
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);
