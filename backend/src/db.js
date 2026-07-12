import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/assetflow';

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool = new pg.Pool({
  connectionString,
  // Supabase (and most hosted Postgres) requires SSL; local postgres does not
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Serverless functions run many short-lived instances, so keep each pool tiny
  // and release idle connections quickly to avoid exhausting the database.
  // Use a pooled/pgbouncer connection string (Supabase port 6543) in production.
  max: isLocal ? 10 : 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const query = (text, params) => pool.query(text, params);
