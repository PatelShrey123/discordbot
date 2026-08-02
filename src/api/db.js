// Supabase REST API Database Adapter
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// No-op for HTTP-based initialization (tables already created via SQL migrate)
export async function initDb() {
  if (!SUPABASE_KEY) {
    console.warn('[Database] SUPABASE_KEY is not defined. Database operations will be disabled.');
    return;
  }
  console.log('[Database] Supabase HTTPS REST API initialized successfully!');
}

/**
 * Get user's custom background URL
 */
export async function getUserBackground(userId) {
  if (!SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_backgrounds?user_id=eq.${userId}&select=background_url`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (rows && rows.length > 0) {
      return rows[0].background_url;
    }
  } catch (err) {
    console.error(`[Database] Error getting background for user ${userId}:`, err.message);
  }
  return null;
}

/**
 * Upsert user's custom background URL
 */
export async function setUserBackground(userId, bgUrl) {
  if (!SUPABASE_KEY) throw new Error('Database is not initialized');
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_backgrounds`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        background_url: bgUrl,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  if (!SUPABASE_KEY) throw new Error('Database is not initialized');
  try {
    const url = `${SUPABASE_URL}/rest/v1/linked_accounts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        discord_id: discordId,
        kirka_id: kirkaUser.id,
        kirka_username: kirkaUser.name,
        short_id: kirkaUser.shortId,
        linked_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  if (!SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/linked_accounts?discord_id=eq.${discordId}&select=kirka_id,kirka_username,short_id`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (rows && rows.length > 0) {
      return {
        id: rows[0].kirka_id,
        name: rows[0].kirka_username,
        shortId: rows[0].short_id
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
  if (!SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/linked_accounts?short_id=ilike.${kirkaShortId}&select=discord_id`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (rows && rows.length > 0) {
      return rows[0].discord_id;
    }
  } catch (err) {
    console.error(`[Database] Error looking up Discord ID for Kirka account ${kirkaShortId}:`, err.message);
  }
  return null;
}
