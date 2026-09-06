import dotenv from 'dotenv';
import { getPublicCatalog, fetchUserInventory } from './kirka.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

/**
 * Indexes a player's inventory items into the skin_owners table permanently.
 * Skips default starter weapons to keep database storage tiny (<1% of Supabase free limit).
 */
export async function indexPlayerInventory(player, inventory) {
  if (!player || !player.id || !Array.isArray(inventory) || inventory.length === 0) return;

  try {
    // 1. Check if player has linked their Discord account
    let isLinked = false;
    try {
      let linkCheckUrl = `${SUPABASE_URL}/rest/v1/linked_accounts?kirka_id=eq.${encodeURIComponent(player.id)}&select=discord_id&limit=1`;
      if (player.shortId) {
        linkCheckUrl = `${SUPABASE_URL}/rest/v1/linked_accounts?or=(kirka_id.eq.${encodeURIComponent(player.id)},short_id.ilike.${encodeURIComponent(player.shortId)})&select=discord_id&limit=1`;
      }
      const linkRes = await fetch(linkCheckUrl, { headers });
      if (linkRes.ok) {
        const rows = await linkRes.json();
        isLinked = Array.isArray(rows) && rows.length > 0;
      }
    } catch {
      // Continue with isLinked = false on lookup error
    }

    // 2. Group items in inventory by skin_id
    const itemCounts = new Map();
    for (const entry of inventory) {
      const item = entry.item || entry;
      if (!item || !item.id || !item.name) continue;

      // Filter out base common weapons (e.g. Shark, Vita with 2.9M copies) to prevent DB clutter
      const rarity = (item.rarity || '').toUpperCase();
      const totalOwned = item.totalOwned || 0;
      if (rarity === 'COMMON' && totalOwned > 10000) continue;

      const skinId = item.id;
      const skinName = item.name.replace(/^_+/, '').trim();
      const amount = entry.amount || 1;

      if (!itemCounts.has(skinId)) {
        itemCounts.set(skinId, { skinId, skinName, amount: 0 });
      }
      itemCounts.get(skinId).amount += amount;
    }

    if (itemCounts.size === 0) return;

    // 3. Prepare rows for batch upsert
    const rowsToUpsert = [];
    for (const { skinId, skinName, amount } of itemCounts.values()) {
      rowsToUpsert.push({
        skin_id: skinId,
        skin_name: skinName,
        player_id: player.id,
        player_name: player.name || 'Unknown',
        player_short_id: player.shortId || '',
        amount,
        is_linked: isLinked,
        last_updated: new Date().toISOString()
      });
    }

    // 4. Upsert in batches of 50 via Supabase REST API
    const batchSize = 50;
    for (let i = 0; i < rowsToUpsert.length; i += batchSize) {
      const batch = rowsToUpsert.slice(i, i + batchSize);
      await fetch(`${SUPABASE_URL}/rest/v1/skin_owners`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(batch)
      });
    }
  } catch (err) {
    console.warn(`[OwnerIndexer] Error indexing inventory for ${player?.name}:`, err.message);
  }
}

/**
 * Retrieves all tracked owners for a specific skin from the database.
 */
export async function getSkinOwners(skinNameOrId) {
  const cleanQuery = skinNameOrId.trim();

  // 1. Resolve exact skin from official catalog
  const catalog = await getPublicCatalog();
  const matchedItem = catalog.find(i => 
    (i.id === cleanQuery) || 
    (i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanQuery.toLowerCase())
  );

  const targetSkinId = matchedItem ? matchedItem.id : cleanQuery;
  const targetSkinName = matchedItem ? matchedItem.name.replace(/^_+/, '').trim() : cleanQuery;
  const totalOwned = matchedItem ? (matchedItem.totalOwned || 0) : 0;

  // 2. Query skin_owners from Supabase REST API
  try {
    const queryUrl = `${SUPABASE_URL}/rest/v1/skin_owners?or=(skin_id.eq.${encodeURIComponent(targetSkinId)},skin_name.ilike.${encodeURIComponent(targetSkinName)})&order=amount.desc,player_name.asc`;
    const res = await fetch(queryUrl, { headers });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase REST Error HTTP ${res.status}: ${errText}`);
    }

    const rows = await res.json();
    const owners = (Array.isArray(rows) ? rows : []).map(r => ({
      name: r.player_name,
      shortId: r.player_short_id,
      count: r.amount,
      isLinked: Boolean(r.is_linked)
    }));

    const cachedTotalCopies = owners.reduce((sum, o) => sum + o.count, 0);

    return {
      item: matchedItem,
      skinName: targetSkinName,
      totalOwned,
      cachedTotalCopies,
      owners
    };
  } catch (err) {
    console.error('[OwnerIndexer] Error fetching skin owners from REST API:', err.message);
    throw err;
  }
}

/**
 * Background crawler to seed and update top leaderboard players into skin_owners.
 */
export async function seedTopPlayers() {
  console.log('🔄 [OwnerIndexer] Starting background indexing of top leaderboard players...');
  try {
    const allPlayers = [];
    // Crawl first 4 pages of solo leaderboard (up to 80 top players)
    for (let page = 1; page <= 4; page++) {
      try {
        const res = await fetch(`https://api.kirka.io/api/leaderboard/solo?limit=20&page=${page}`, {
          headers: {
            'ApiKey': process.env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060'
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.results || data || [];
          if (Array.isArray(list)) allPlayers.push(...list);
        }
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[OwnerIndexer] Discovered ${allPlayers.length} leaderboard candidates to index.`);

    for (let i = 0; i < allPlayers.length; i++) {
      const p = allPlayers[i];
      if (!p.userId) continue;

      try {
        const inv = await fetchUserInventory(p.userId);
        if (Array.isArray(inv) && inv.length > 0) {
          await indexPlayerInventory({ id: p.userId, name: p.name, shortId: '' }, inv);
        }
      } catch {
        // Continue silently on individual rate limits
      }

      await new Promise(resolve => setTimeout(resolve, 400));
    }
    console.log('✅ [OwnerIndexer] Finished background indexing top players!');
  } catch (err) {
    console.warn('[OwnerIndexer] Background player crawl error:', err.message);
  }
}
