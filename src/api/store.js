import https from 'https';

const API2_BASE = 'https://api2.kirka.io/api';

/**
 * Perform a GET request to api2.kirka.io
 */
function api2Get(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${API2_BASE}${endpoint}`;
    const req = https.get(url, {
      headers: {
        'Origin': 'https://kirka.io',
        'Referer': 'https://kirka.io/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`API responded with status ${res.statusCode}: ${data}`));
          }
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Request timed out after 8 seconds'));
    });
  });
}

/**
 * Fetch all active store bundles (including the daily/random shop and limited edition drops)
 */
export async function fetchStoreBundles() {
  try {
    const data = await api2Get('/wwMnWNm/wMwnmWWN');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[StoreAPI] Error fetching bundles:', err.message);
    return [];
  }
}

/**
 * Fetch all active complete sets (e.g. Blast Set, etc.)
 */
export async function fetchStoreSets() {
  try {
    const data = await api2Get('/wwMnWNm/wwMnWNWm');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[StoreAPI] Error fetching sets:', err.message);
    return [];
  }
}

/**
 * Fetch card packs and chests
 */
export async function fetchStoreCardsAndChests() {
  try {
    const data = await api2Get('/wwMnWNm/wNnmMW');
    return data || { wNnmM: [], wnMwmWW: [] };
  } catch (err) {
    console.error('[StoreAPI] Error fetching cards & chests:', err.message);
    return { wNnmM: [], wnMwmWW: [] };
  }
}

/**
 * Helper to get clean render URL for any skin or character name
 */
export function getSkinRenderUrl(skinName) {
  if (!skinName) return null;
  const clean = skinName.replace(/^_+/, '').trim();
  return `https://api2.kirka.io/api/skin-render/${encodeURIComponent(clean)}`;
}

/**
 * Parse an individual bundle item into a clean representation
 */
function parseStoreItem(item, bundleEndsAt) {
  const skin = item.wwMmnWNW;
  let rawName = skin?.wwMmWnW || 'Item';
  // If name is obfuscated consumable code like 'wmWwMn', label as 'Name Change'
  if (rawName === 'wmWwMn') {
    rawName = 'Name Change';
  }

  const isCharacter = item.wwMmWWn === 'CHARACTER' || !skin?.wnMNwmWW;
  const weapon = isCharacter ? 'Character' : (skin?.wnMNwmWW?.wwMmWnW || 'Weapon');
  const price = item.wNnmWw || 0;
  const rarity = skin?.wnMwWmWN || 'UNKNOWN';

  // Limited edition units calculation (matches Kirka client logic)
  const isLimited = item.wMmWw !== null && item.wMmWw !== undefined;
  const totalUnits = isLimited ? item.wMmWw : null;
  const soldUnits = isLimited ? (item.wmnwN || 0) : 0;
  let remainingUnits = null;
  if (isLimited) {
    if (item.wWnwWmNM !== null && item.wWnwWmNM !== undefined) {
      remainingUnits = Math.max(item.wWnwWmNM, 0);
    } else {
      remainingUnits = Math.max((totalUnits || 0) - soldUnits, 0);
    }
  }

  const isSoldOut = isLimited && remainingUnits !== null && remainingUnits <= 0;
  const endsAt = item.wnNWmw || bundleEndsAt || null;

  return {
    id: skin?.WwwnmW || item.WwwnmW,
    name: rawName,
    type: item.wwMmWWn || (isCharacter ? 'CHARACTER' : 'SKIN'),
    weapon,
    rarity,
    priceDiamonds: price,
    isLimited,
    totalUnits,
    soldUnits,
    remainingUnits,
    isSoldOut,
    endsAt,
    renderUrl: getSkinRenderUrl(rawName)
  };
}

/**
 * Parse and structure the complete live store data
 */
export async function getParsedStore() {
  const [bundles, sets, cardsAndChests] = await Promise.all([
    fetchStoreBundles(),
    fetchStoreSets(),
    fetchStoreCardsAndChests()
  ]);

  const limitedDrops = [];
  const dailyShop = [];
  const activeBundles = [];

  for (const b of bundles) {
    const allItems = [...(b.wmWwMnW || []), ...(b.wNmMWwW || [])];
    const parsedItems = allItems.map(it => parseStoreItem(it, b.wnNWmw));

    // Separate limited drops
    for (const it of parsedItems) {
      if (it.isLimited) {
        limitedDrops.push(it);
      }
    }

    if (b.wwMmWnW === 'Random') {
      // The daily/regular shop cards
      for (const it of parsedItems) {
        if (!it.isLimited) {
          dailyShop.push(it);
        }
      }
    } else {
      activeBundles.push({
        id: b.WwwnmW,
        name: b.wwMmWnW,
        startsAt: b.wmnNwWM,
        endsAt: b.wnNWmw,
        items: parsedItems
      });
    }
  }

  // Parse complete sets (e.g. Blast Set)
  const parsedSets = sets.map(s => {
    const items = (s.wNnmMW || []).map(it => {
      const skin = it.wwMmnWNW;
      return {
        id: skin?.WwwnmW,
        name: skin?.wwMmWnW,
        rarity: skin?.wnMwWmWN,
        weapon: skin?.wnMNwmWW?.wwMmWnW || 'Weapon',
        renderUrl: getSkinRenderUrl(skin?.wwMmWnW)
      };
    });

    return {
      id: s.WwwnmW,
      name: s.wwMmWnW,
      priceDiamonds: s.wMWwnmW || 0,
      bannerImage: s.wNmnMWw ? `https://kirka.io/assets/img/${s.wNmnMWw}` : null,
      startsAt: s.wmnNwWM,
      endsAt: s.wnNWmw,
      items
    };
  });

  // Parse Chests
  const chests = (cardsAndChests.wnMwmWW || []).map(c => ({
    id: c.WwwnmW,
    name: c.wwMmWnW,
    priceDiamonds: c.wNnmWw || 0,
    itemsCount: parseInt(c.wNwWmWnM || '1', 10),
    image: c.wMmWwW ? `https://kirka.io/assets/img/${c.wMmWwW}` : null
  }));

  return {
    limitedDrops,
    dailyShop,
    featuredSet: parsedSets[0] || null,
    sets: parsedSets,
    activeBundles,
    chests,
    updatedAt: new Date().toISOString()
  };
}
