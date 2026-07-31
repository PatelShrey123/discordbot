import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return null;
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

// Initialize database schema
export async function initDb() {
  const activePool = getPool();
  if (!activePool) {
    console.warn('[Database] DATABASE_URL is not set. Custom backgrounds will be disabled.');
    return;
  }
  try {
    const client = await activePool.connect();
    console.log('[Database] Connected to Supabase PostgreSQL successfully!');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_backgrounds (
        user_id VARCHAR(64) PRIMARY KEY,
        background_url TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Database] Schema initialized.');
    client.release();
  } catch (err) {
    console.error('[Database] Failed to connect/initialize database:', err.message);
  }
}

/**
 * Get user's custom background URL
 */
export async function getUserBackground(userId) {
  const activePool = getPool();
  if (!activePool) return null;
  try {
    const res = await activePool.query(
      'SELECT background_url FROM user_backgrounds WHERE user_id = $1',
      [userId]
    );
    if (res.rows.length > 0) {
      return res.rows[0].background_url;
    }
  } catch (err) {
    console.error(`[Database] Error getting background for user ${userId}:`, err.message);
  }
  return null;
}

/**
 * Upsert user's custom background URL
 */
export async function setUserBackground(userId, url) {
  const activePool = getPool();
  if (!activePool) throw new Error('Database is not connected');
  try {
    await activePool.query(`
      INSERT INTO user_backgrounds (user_id, background_url, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET background_url = EXCLUDED.background_url, updated_at = CURRENT_TIMESTAMP
    `, [userId, url]);
    return true;
  } catch (err) {
    console.error(`[Database] Error setting background for user ${userId}:`, err.message);
    throw err;
  }
}
