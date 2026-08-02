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
    console.warn('[Database] DATABASE_URL is not set. Custom backgrounds and linking will be disabled.');
    return;
  }
  try {
    const client = await activePool.connect();
    console.log('[Database] Connected to Supabase PostgreSQL successfully!');
    
    // Create user_backgrounds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_backgrounds (
        user_id VARCHAR(64) PRIMARY KEY,
        background_url TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create linked_accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS linked_accounts (
        discord_id VARCHAR(64) PRIMARY KEY,
        kirka_id VARCHAR(64) NOT NULL,
        kirka_username VARCHAR(128) NOT NULL,
        short_id VARCHAR(16) NOT NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

/**
 * Save user's linked account in database
 */
export async function saveLinkedAccount(discordId, kirkaUser) {
  const activePool = getPool();
  if (!activePool) throw new Error('Database is not connected');
  try {
    await activePool.query(`
      INSERT INTO linked_accounts (discord_id, kirka_id, kirka_username, short_id, linked_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (discord_id)
      DO UPDATE SET kirka_id = EXCLUDED.kirka_id, kirka_username = EXCLUDED.kirka_username, short_id = EXCLUDED.short_id, linked_at = CURRENT_TIMESTAMP
    `, [discordId, kirkaUser.id, kirkaUser.name, kirkaUser.shortId]);
    return true;
  } catch (err) {
    console.error(`[Database] Error saving linked account for Discord user ${discordId}:`, err.message);
    throw err;
  }
}

/**
 * Get user's linked account details
 */
export async function getLinkedAccount(discordId) {
  const activePool = getPool();
  if (!activePool) return null;
  try {
    const res = await activePool.query(
      'SELECT kirka_id, kirka_username, short_id FROM linked_accounts WHERE discord_id = $1',
      [discordId]
    );
    if (res.rows.length > 0) {
      return {
        id: res.rows[0].kirka_id,
        name: res.rows[0].kirka_username,
        shortId: res.rows[0].short_id
      };
    }
  } catch (err) {
    console.error(`[Database] Error getting linked account for Discord user ${discordId}:`, err.message);
  }
  return null;
}

/**
 * Get Discord ID linked to a Kirka short ID
 */
export async function getDiscordLinkedToKirka(kirkaShortId) {
  const activePool = getPool();
  if (!activePool) return null;
  try {
    const res = await activePool.query(
      'SELECT discord_id FROM linked_accounts WHERE UPPER(short_id) = UPPER($1)',
      [kirkaShortId]
    );
    if (res.rows.length > 0) {
      return res.rows[0].discord_id;
    }
  } catch (err) {
    console.error(`[Database] Error looking up Discord ID for Kirka account ${kirkaShortId}:`, err.message);
  }
  return null;
}
