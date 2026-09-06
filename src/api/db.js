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

/**
 * Resolves a Kirka query from user input, Discord mention, or Discord ID.
 * Supports:
 * - Direct Discord mention: <@123456789012345678> or <@!123456789012345678>
 * - Discord User object from message.mentions.users
 * - Text tag like @username (searches guild members for linked account)
 * - Raw Discord user ID (17-20 digits)
 * - Empty query (falls back to author's linked account)
 * - Standard Kirka username, shortId, or UUID
 *
 * @param {string} rawInput - The input string (e.g. "@tooexpert", "CrackedYOU", "<@728104078428733452>")
 * @param {object} context - { message, interaction, defaultToAuthor = true }
 * @returns {Promise<{ query: string, targetDiscordId?: string, isMention?: boolean, linked?: object, error?: string }>}
 */
export async function resolveKirkaTarget(rawInput, context = {}) {
  const { message, interaction, defaultToAuthor = true } = context;
  const authorId = interaction?.user?.id || message?.author?.id;

  let input = (rawInput || '').trim();

  // 1. Check for Discord user mention in message.mentions.users
  if (message && message.mentions && message.mentions.users && message.mentions.users.size > 0) {
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
      const linked = await getLinkedAccount(mentionedUser.id);
      if (!linked) {
        return {
          error: `❌ <@${mentionedUser.id}> hasn't linked their Kirka account yet. They can link using \`/link\` or \`.link\`.`
        };
      }
      return {
        query: linked.shortId || linked.name,
        targetDiscordId: mentionedUser.id,
        isMention: true,
        linked
      };
    }
  }

  // 2. Check for Discord mention pattern in input string: <@123456789012345678> or <@!123456789012345678>
  const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) {
    const discordId = mentionMatch[1];
    const linked = await getLinkedAccount(discordId);
    if (!linked) {
      return {
        error: `❌ <@${discordId}> hasn't linked their Kirka account yet. They can link using \`/link\` or \`.link\`.`
      };
    }
    return {
      query: linked.shortId || linked.name,
      targetDiscordId: discordId,
      isMention: true,
      linked
    };
  }

  // 3. Check if input is a raw Discord user ID (17-20 digits)
  if (/^\d{17,20}$/.test(input)) {
    const linked = await getLinkedAccount(input);
    if (linked) {
      return {
        query: linked.shortId || linked.name,
        targetDiscordId: input,
        isMention: true,
        linked
      };
    }
  }

  // 4. Check if input starts with @ (e.g. "@tooexpert" typed without mention)
  if (input.startsWith('@')) {
    const cleanTag = input.slice(1).trim().toLowerCase();
    const guild = message?.guild || interaction?.guild;
    if (guild && cleanTag) {
      try {
        const members = await guild.members.fetch({ query: cleanTag, limit: 5 }).catch(() => null);
        if (members && members.size > 0) {
          const match = members.find(m => 
            m.user.username.toLowerCase() === cleanTag || 
            (m.nickname && m.nickname.toLowerCase() === cleanTag)
          ) || members.first();

          if (match) {
            const linked = await getLinkedAccount(match.id);
            if (linked) {
              return {
                query: linked.shortId || linked.name,
                targetDiscordId: match.id,
                isMention: true,
                linked
              };
            } else {
              return {
                error: `❌ <@${match.id}> hasn't linked their Kirka account yet. They can link using \`/link\` or \`.link\`.`
              };
            }
          }
        }
      } catch (err) {
        console.warn('[UserResolver] Guild member lookup failed:', err.message);
      }
    }
  }

  // 5. If no query provided, fallback to author's own linked account
  if (!input) {
    if (!defaultToAuthor || !authorId) {
      return { error: '❌ Please specify a Kirka username, short ID, or mention a user.' };
    }
    const linked = await getLinkedAccount(authorId);
    if (!linked) {
      return {
        error: `❌ You haven't linked a Kirka account yet. Use \`/link\` or \`.link\` to bind your profile, or search for a player (e.g. \`.inv CrackedYOU\`).`
      };
    }
    return {
      query: linked.shortId || linked.name,
      targetDiscordId: authorId,
      isSelf: true,
      linked
    };
  }

  // 6. Direct Kirka username or ID
  return { query: input };
}


