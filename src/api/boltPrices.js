import fs from 'fs';

let cachedPriceMap = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// 'live' | 'local' | null — which source last populated the map
let lastSource = null;
export function getLastPriceSource() { return lastSource; }

const UPSTREAM_PRICE_URL = 'https://kirka.lukeskywalk.com/priceList.json';

const rarityMap = {
  'M': 'Mythical',
  'L': 'Legendary',
  'E': 'Epic',
  'R': 'Rare',
  'C': 'Common'
};

const FALLBACK_PRICES = {
  "grayscale_character": 50000000,
  "gazer_character": 35000000,
  "golem_character": 15000000,
  "crispy_character": 5000000,
  "rub1x_ar-9": 575000,
  "cornfield_bayonet": 400000,
  "cyb3r_bayonet": 350000,
  "moonlight_mac-10": 200000,
  "burger_character": 187500,
  "astra_lar": 150000,
  "crystalized_revolver": 80000,
  "spearmint_character": 50000,
  "darkift_character": 35000,
  "imgerror_character": 35000,
  "vivid_lar": 35000,
  "cyberpunk_mac-10": 25000,
  "eva_mac-10": 20000,
  "destiny_character": 15000,
  "fire_mac-10": 15000,
  "normal map_ar-9": 15000,
  "snowman_character": 15000,
  "lux_mac-10": 10000,
  "murdered_revolver": 10000,
  "metallic rainbow_lar": 10000,
  "terminator_lar": 10000
};

export function formatValueShort(val) {
  if (!val || isNaN(val) || val <= 0) return '0';
  if (val >= 1_000_000_000) {
    return (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
  }
  if (val >= 1_000_000) {
    return (val / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
  }
  if (val >= 1_000) {
    const k = val / 1_000;
    return k >= 100 ? Math.round(k) + 'K' : k.toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return val.toLocaleString();
}

export function formatValueLong(val) {
  if (!val || isNaN(val) || val <= 0) return '0';
  if (val >= 1_000_000_000) {
    return (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + ' Billion';
  }
  if (val >= 1_000_000) {
    return (val / 1_000_000).toFixed(2).replace(/\.00$/, '') + ' Million';
  }
  if (val >= 1_000) {
    return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return val.toLocaleString();
}

export function clearPriceCache() {
  cachedPriceMap = null;
  lastFetchTime = 0;
}

export async function getBoltPriceMap() {
  const now = Date.now();
  if (cachedPriceMap && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPriceMap;
  }

  const map = new Map();
  let loaded = false;

  // 1. Direct fetch from upstream live market price feed (Bolt & Community Valuation)
  try {
    const res = await fetch(UPSTREAM_PRICE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' }
    });
    if (res.ok) {
      const boltList = await res.json();
      if (Array.isArray(boltList) && boltList.length > 500) {
        for (const item of boltList) {
          const rawRarity = item.rarity || 'C';
          const rarity = rarityMap[rawRarity] || rawRarity;
          const val = (item.bolt && item.bolt > 0) ? item.bolt : (item.average && item.average > 0 ? item.average : (item.fate || 0));
          const skinName = (item.itemName || '').trim();
          const type = (item.type || '').trim();
          const obtainableBy = 'All chests';
          const itemObj = { skinName, rarity, baseValue: val, type, obtainableBy };

          const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
          const keyNameOnly = skinName.toLowerCase();
          map.set(keyWithType, itemObj);
          if (!map.has(keyNameOnly)) {
            map.set(keyNameOnly, itemObj);
          }
        }
        console.log(`[HubPrices] Successfully loaded ${map.size} items from live market feed.`);
        loaded = true;
        lastSource = 'live';
      }
    }
  } catch (e) {
    console.warn('[HubPrices] Live market feed fetch failed, falling back to local database:', e.message);
  }

  // 2. Offline / Local fallback database
  if (!loaded) {
    try {
      const raw = fs.readFileSync(new URL('../data/hub_prices.json', import.meta.url), 'utf8');
      const rows = JSON.parse(raw);
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          const skinName = (row['Skin Name'] || '').trim();
          const rarity = (row['Skin Rarity'] || '').trim();
          const baseValueStr = (row['Hub Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
          const baseValue = parseInt(baseValueStr, 10) || 0;
          const type = (row['Type'] || '').trim();
          const obtainableBy = (row['Obtainable By'] || 'N/A').trim();

          const itemObj = {
            skinName,
            rarity,
            baseValue,
            type,
            obtainableBy
          };

          const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
          const keyNameOnly = skinName.toLowerCase();

          map.set(keyWithType, itemObj);
          if (!map.has(keyNameOnly)) {
            map.set(keyNameOnly, itemObj);
          }
        });
        console.log(`[HubPrices] Successfully loaded ${map.size} items from local Hub Pricing database.`);
        lastSource = 'local';
        loaded = true;
      }
    } catch (err) {
      console.error('[HubPrices] Failed to read local hub_prices.json:', err.message);
    }
  }

  // Populate fallback defaults if missing
  Object.entries(FALLBACK_PRICES).forEach(([key, val]) => {
    if (!map.has(key)) {
      map.set(key, { skinName: key, rarity: 'Mythical', baseValue: val, type: '' });
    }
  });

  cachedPriceMap = map;
  lastFetchTime = now;
  return map;
}

export function getItemPrice(priceMap, item) {
  if (!item || !item.name) return 0;
  const cleanName = item.name.replace(/^_+/, '').trim().toLowerCase();
  const typeName = (item.type === 'BODY_SKIN' ? 'character' : item.parent?.name || '').toLowerCase();

  const keyWithType = `${cleanName}_${typeName}`;
  if (priceMap.has(keyWithType)) {
    return priceMap.get(keyWithType).baseValue || 0;
  }
  if (priceMap.has(cleanName)) {
    return priceMap.get(cleanName).baseValue || 0;
  }

  return 0;
}
