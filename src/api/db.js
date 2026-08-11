// Supabase REST API Database Adapter
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
// Fallback to the verified public anon key if not set in environment variables
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

// No-op for HTTP-based initialization (tables already created via SQL migrate)
export async function initDb() {
  console.log('[Database] Supabase HTTPS REST API initialized successfully!');
}

/**
 * Get user's custom background URL
 */
export async function getUserBackground(userId) {
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

/**
 * Delete user's linked account from database
 */
export async function deleteLinkedAccount(discordId) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/linked_accounts?discord_id=eq.${discordId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    console.error(`[Database] Error deleting linked account for Discord user ${discordId}:`, err.message);
    throw err;
  }
}

