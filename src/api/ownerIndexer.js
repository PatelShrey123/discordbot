import pg from 'pg';
import dotenv from 'dotenv';
import { getPublicCatalog, fetchUserInventory } from './kirka.js';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Shrey%4013569@db.bxebfeyqchjukibgfeqs.supabase.co:5432/postgres';
const pool = new pg.Pool({ connectionString });

/**
 * Indexes a player's inventory items into the skin_owners table permanently.
 */
export async function indexPlayerInventory(player, inventory) {
  if (!player || !player.id || !Array.isArray(inventory) || inventory.length === 0) return;

  const client = await pool.connect();
  try {
    // Check if player is linked
    const linkedCheck = await client.query(
      'SELECT 1 FROM linked_accounts WHERE kirka_id = $1 OR short_id ILIKE $2 LIMIT 1;',
      [player.id, player.shortId || '']
    );
    const isLinked = linkedCheck.rows.length > 0;

    // Group items in inventory by skin_id
    const itemCounts = new Map();
    for (const entry of inventory) {
      const item = entry.item || entry;
      if (!item || !item.id || !item.name) continue;

      const skinId = item.id;
      const skinName = item.name.replace(/^_+/, '').trim();
      const amount = entry.amount || 1;

      if (!itemCounts.has(skinId)) {
        itemCounts.set(skinId, { skinId, skinName, amount: 0 });
      }
      itemCounts.get(skinId).amount += amount;
    }

    // Upsert into skin_owners
    for (const { skinId, skinName, amount } of itemCounts.values()) {
      await client.query(
        `INSERT INTO skin_owners (skin_id, skin_name, player_id, player_name, player_short_id, amount, is_linked, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (skin_id, player_id) 
         DO UPDATE SET 
           amount = EXCLUDED.amount,
           player_name = EXCLUDED.player_name,
           player_short_id = EXCLUDED.player_short_id,
           is_linked = EXCLUDED.is_linked,
           last_updated = NOW();`,
        [skinId, skinName, player.id, player.name || 'Unknown', player.shortId || '', amount, isLinked]
      );
    }
  } catch (err) {
    console.warn(`[OwnerIndexer] Error indexing inventory for ${player.name}:`, err.message);
  } finally {
    client.release();
  }
}

/**
 * Retrieves all tracked owners for a specific skin from the database.
 */
export async function getSkinOwners(skinNameOrId) {
  const client = await pool.connect();
  try {
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

    // 2. Query skin_owners from database
    const res = await client.query(
      `SELECT player_name, player_short_id, amount, is_linked, last_updated 
       FROM skin_owners 
       WHERE skin_id = $1 OR LOWER(skin_name) = LOWER($2)
       ORDER BY amount DESC, player_name ASC;`,
      [targetSkinId, targetSkinName]
    );

    const owners = res.rows.map(r => ({
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
    console.error('[OwnerIndexer] Error fetching skin owners:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Background crawler to seed and update top leaderboard players into skin_owners.
 */
export async function seedTopPlayers() {
  console.log('🔄 [OwnerIndexer] Starting background indexing of top leaderboard players...');
  try {
    const res = await fetch('https://api.kirka.io/api/leaderboard/solo', {
      headers: {
        'ApiKey': process.env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060'
      }
    });

    if (!res.ok) return;
    const data = await res.json();
    const players = data.results || data || [];

    // Crawl top 40 players in chunks of 5
    for (let i = 0; i < Math.min(players.length, 40); i++) {
      const p = players[i];
      if (!p.userId) continue;

      try {
        const inv = await fetchUserInventory(p.userId);
        if (Array.isArray(inv) && inv.length > 0) {
          await indexPlayerInventory({ id: p.userId, name: p.name, shortId: '' }, inv);
        }
      } catch {
        // Continue silently on individual player rate-limits
      }

      // Small delay between requests to be friendly to Kirka API
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('✅ [OwnerIndexer] Finished background indexing top players!');
  } catch (err) {
    console.warn('[OwnerIndexer] Background player crawl error:', err.message);
  }
}
