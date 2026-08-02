let cachedPriceMap = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

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

export async function getBoltPriceMap() {
  const now = Date.now();
  if (cachedPriceMap && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPriceMap;
  }

  const map = new Map();
  const url = 'https://opensheet.elk.sh/1pxMSoaSo8FYv-OIJ26HpSj8EDy7EDRmatHyQW24o6E4/1';

  try {
    const res = await fetch(url);
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          const skinName = (row['Skin Name'] || '').trim();
          const rarity = (row['Skin Rarity'] || '').trim();
          const baseValueStr = (row['Base Value'] || '').toString().replace(/,/g, '');
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
        console.log(`[BoltPrices] Successfully loaded ${map.size} items from Bolt Pricing Sheet.`);
      }
    }
  } catch (err) {
    console.error('[BoltPrices] Failed to fetch live sheet, using fallback price map:', err.message);
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
