import fs from 'fs';

let cachedPriceMap = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// 'sheet' | 'local' | null — which source last populated the map
let lastSource = null;
export function getLastPriceSource() { return lastSource; }

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

  // 0. Website API feed (if HUB_PRICES_API_URL is configured, loads merged prices directly)
  const apiUrl = process.env.HUB_PRICES_API_URL || (process.env.WEBSITE_URL ? `${process.env.WEBSITE_URL}/api/prices` : null);
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 500) {
          data.forEach(row => {
            const skinName = (row['Skin Name'] || '').trim();
            const rarity = (row['Skin Rarity'] || '').trim();
            const baseValueStr = (row['Hub Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
            const baseValue = parseInt(baseValueStr, 10) || 0;
            const type = (row['Type'] || '').trim();
            const obtainableBy = (row['Obtainable By'] || 'N/A').trim();
            const itemObj = { skinName, rarity, baseValue, type, obtainableBy };
            map.set(`${skinName.toLowerCase()}_${type.toLowerCase()}`, itemObj);
            if (!map.has(skinName.toLowerCase())) map.set(skinName.toLowerCase(), itemObj);
          });
          console.log(`[HubPrices] Successfully loaded ${map.size} items from KirkaHub Website API.`);
          loaded = true;
        }
      }
    } catch (e) {
      console.warn('[HubPrices] Website API fetch failed, falling back to sheet:', e.message);
    }
  }

  // 1. Google Sheet feed (if HUB_PRICES_SHEET_URL is configured in .env)
  const sheetUrl = process.env.HUB_PRICES_SHEET_URL;
  if (!loaded && sheetUrl) {
    try {
      const res = await fetch(sheetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' } });
      if (res.ok) {
        const csvText = await res.text();
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length > 500) {
          const parseRow = (r) => {
            const result = [];
            let inQuotes = false;
            let entry = '';
            for (let i = 0; i < r.length; i++) {
              const c = r[i];
              if (c === '"') inQuotes = !inQuotes;
              else if (c === ',' && !inQuotes) { result.push(entry.trim()); entry = ''; }
              else entry += c;
            }
            result.push(entry.trim());
            return result;
          };
          const headers = parseRow(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const vals = parseRow(lines[i]);
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
            const skinName = (row['Skin Name'] || '').trim();
            const rarity = (row['Skin Rarity'] || '').trim();
            // Hub Value is the column the list is maintained in; Base Value is the older header.
            // The website reads them in this order, and the bot must agree or the two quote different prices.
            const baseValueStr = (row['Hub Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
            const baseValue = parseInt(baseValueStr, 10) || 0;
            const type = (row['Type'] || '').trim();
            const obtainableBy = (row['Obtainable By'] || 'N/A').trim();
            const itemObj = { skinName, rarity, baseValue, type, obtainableBy };
            map.set(`${skinName.toLowerCase()}_${type.toLowerCase()}`, itemObj);
            if (!map.has(skinName.toLowerCase())) map.set(skinName.toLowerCase(), itemObj);
          }
          console.log(`[HubPrices] Successfully loaded ${map.size} items from base Google Sheet.`);
          loaded = true;
          lastSource = 'sheet';

          // Apply custom overrides from PRICE_OVERRIDES_SHEET_URL if configured
          const overrideUrl = process.env.PRICE_OVERRIDES_SHEET_URL;
          if (overrideUrl) {
            try {
              const ovRes = await fetch(overrideUrl, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' } });
              if (ovRes.ok) {
                const ovText = await ovRes.text();
                const ovLines = ovText.split(/\r?\n/).filter(l => l.trim() !== '');
                if (ovLines.length >= 2) {
                  const ovHeaders = parseRow(ovLines[0]);
                  let overrideCount = 0;
                  for (let i = 1; i < ovLines.length; i++) {
                    const vals = parseRow(ovLines[i]);
                    const row = {};
                    ovHeaders.forEach((h, idx) => { row[h] = vals[idx] || ''; });
                    const skinName = (row['Skin Name'] || '').trim();
                    if (!skinName) continue;
                    const baseValueStr = (row['Hub Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
                    const baseValue = parseInt(baseValueStr, 10);
                    const type = (row['Type'] || '').trim();
                    const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
                    const keyNameOnly = skinName.toLowerCase();

                    const existing = map.get(keyWithType) || map.get(keyNameOnly) || { skinName, type, rarity: 'Common', obtainableBy: 'N/A' };
                    const merged = { ...existing };
                    if (!isNaN(baseValue)) merged.baseValue = baseValue;
                    if (row['Skin Rarity']) merged.rarity = row['Skin Rarity'].trim();
                    if (row['Obtainable By']) merged.obtainableBy = row['Obtainable By'].trim();

                    if (type) map.set(keyWithType, merged);
                    map.set(keyNameOnly, merged);
                    overrideCount++;
                  }
                  console.log(`[HubPrices] Applied ${overrideCount} custom price overrides to bot.`);
                  lastSource = 'sheet-with-overrides';
                }
              }
            } catch (ovErr) {
              console.warn('[HubPrices] Override sheet fetch failed:', ovErr.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[HubPrices] Sheet fetch failed, falling back to local json:', e.message);
    }
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
          const baseValueStr = (row['Base Value'] || row['Hub Value'] || '').toString().replace(/,/g, '');
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
      }
    } catch (err) {
      console.error('[HubPrices] Failed to read local hub_prices.json:', err.message);
    }
  }

  // 3. Our own edits, applied on top of whichever source loaded above.
  //    The website applies the same overrides the same way, from the same sheet, so the bot and
  //    the site can never quote different numbers for the same skin.
  await applyOverrides(map);

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

/**
 * Price overrides.
 *
 * The base list may not be ours to edit, so corrections live in a small separate sheet that we
 * own and can share edit access to. Only two columns are required - "Skin Name" and "Hub Value" -
 * though including "Type" is strongly advised, since without it an override applies to every
 * skin sharing that name.
 *
 * A skin not present in the base list is added, so this can introduce skins as well as reprice
 * them. A broken or unreachable override sheet is ignored rather than allowed to take prices
 * down with it.
 */
async function applyOverrides(map) {
  const url = process.env.PRICE_OVERRIDES_SHEET_URL;
  if (!url) return;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const lines = (await res.text()).split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return;

    const parseRow = (r) => {
      const out = [];
      let inQuotes = false;
      let entry = '';
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { out.push(entry.trim()); entry = ''; }
        else entry += c;
      }
      out.push(entry.trim());
      return out;
    };

    const headers = parseRow(lines[0]);
    let applied = 0;

    for (let i = 1; i < lines.length; i++) {
      const vals = parseRow(lines[i]);
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      const skinName = (row['Skin Name'] || '').trim();
      if (!skinName) continue;

      const valueStr = (row['Hub Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
      const baseValue = parseInt(valueStr, 10);
      if (!Number.isFinite(baseValue)) continue;

      const type = (row['Type'] || '').trim();
      const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
      const keyNameOnly = skinName.toLowerCase();

      // keep whatever the base row already knew, and change only what the override states
      const existing = map.get(keyWithType) || map.get(keyNameOnly) || {};
      const itemObj = {
        skinName,
        rarity: (row['Skin Rarity'] || '').trim() || existing.rarity || '',
        baseValue,
        type: type || existing.type || '',
        obtainableBy: (row['Obtainable By'] || '').trim() || existing.obtainableBy || 'N/A',
      };

      map.set(keyWithType, itemObj);
      map.set(keyNameOnly, itemObj);
      applied++;
    }

    if (applied) console.log(`[HubPrices] ${applied} price override(s) applied.`);
  } catch (e) {
    console.warn('[HubPrices] override sheet unavailable, using base prices only:', e.message);
  }
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
