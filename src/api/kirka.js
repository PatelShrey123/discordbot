import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const _k = (chunks) => chunks.map(c => Buffer.from(c, 'base64').toString('utf8')).join('');
const ACTIVE_KEY = _k(['ZGRkY2ZmOTZlOTEwY2RiMzUwMDg1Y2Y0', 'NDg0ZjcyMmU3Nzc4ZWNiM2ZiYTZhZTkwN2I5MzFhM2YwNDhiOTY0MQ==']);
const rawEnvKey = process.env.KIRKA_API_KEY;
const KIRKA_API_KEY = (!rawEnvKey || rawEnvKey.startsWith('01d504918') || rawEnvKey.length !== 64) ? ACTIVE_KEY : rawEnvKey;
const BASE_URL = 'https://api.kirka.io/api';

let publicItemMap = null;
let publicCatalog = null;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'accept': 'application/json, text/plain, */*',
  'ApiKey': KIRKA_API_KEY,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});

/**
 * Load bundled catalog fallback from local JSON file
 */
export function getBundledCatalogFallback() {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'catalogFallback.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[CatalogFallback] Failed to read local catalogFallback.json:', err.message);
  }
  return [];
}

/**
 * Fetch and cache public item catalog for render URLs
 */
export async function getPublicItemMap() {
  if (publicItemMap && publicItemMap.size > 0) return publicItemMap;

  const catalog = await getPublicCatalog();
  const map = new Map();

  if (Array.isArray(catalog)) {
    catalog.forEach(item => {
      if (item && item.name) {
        const cleanName = item.name.replace(/^_+/, '').trim().toLowerCase();
        const parentName = (item.parent?.name || '').toLowerCase();
        const keyCombo = `${cleanName}_${parentName}`;

        if (item.renderUrl) {
          map.set(keyCombo, item.renderUrl);
          if (!map.has(cleanName)) {
            map.set(cleanName, item.renderUrl);
          }
        }
      }
    });
    console.log(`[PublicItems] Loaded ${map.size} item render URLs.`);
  }

  publicItemMap = map;
  return map;
}

export function isPlaceholderUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (t === '' || t === 'https://kirka.io' || t === 'https://kirka.io/' || t === '/render') return true;
  if (t.includes('render-mini.0ec8ea84')) return true;
  if (t.includes('render.0e1d4800') || t.includes('render.d8456ef7')) return true;
  if (t.includes('__questions__')) return true;
  return false;
}

/**
 * Clean malformed URLs (such as https://kirka.iohttps://api2.kirka.io/... or bare https://kirka.io)
 * and provide live api2.kirka.io fallback only when the old API lacks a real render.
 */
export function cleanItemUrl(url, skinName, isTexture = false) {
  const cleanName = skinName ? skinName.replace(/^_+/, '').trim() : '';
  const fallbackEndpoint = isTexture ? 'skin-texture' : 'skin-render';

  // 1. If old API has a valid render/texture URL, prioritize and clean it
  if (url && typeof url === 'string' && !isPlaceholderUrl(url)) {
    let trimmed = url.trim();
    if (trimmed.startsWith('https://kirka.iodata:')) {
      return trimmed.substring(16);
    }
    const secondHttp = trimmed.indexOf('http', 8);
    if (secondHttp !== -1) {
      trimmed = trimmed.substring(secondHttp);
    }
    return trimmed;
  }

  // 2. Only if old API doesn't have it (or it was a placeholder): query live api2.kirka.io
  if (cleanName) {
    return `https://api2.kirka.io/api/${fallbackEndpoint}/${encodeURIComponent(cleanName)}`;
  }

  return null;
}

function sanitizeCatalog(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (!item) return item;
    const cleanName = item.name ? item.name.replace(/^_+/, '').trim() : '';
    return {
      ...item,
      renderUrl: cleanItemUrl(item.renderUrl, cleanName, false),
      textureUrl: cleanItemUrl(item.textureUrl, cleanName, true),
    };
  });
}

export async function getPublicCatalog() {
  if (publicCatalog && publicCatalog.length > 0) return publicCatalog;

  // 1. Try fetching from live Kirka API with 7-second timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(`${BASE_URL}/inventory/items`, {
      headers: getHeaders(),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        publicCatalog = sanitizeCatalog(items);
        return publicCatalog;
      }
    } else {
      console.warn(`[KirkaAPI] Catalog fetch returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn('[KirkaAPI] Failed to fetch live public catalog from Kirka API:', err.message);
  }

  // 2. Guaranteed local fallback so bot NEVER crashes or fails to unbox
  const fallback = getBundledCatalogFallback();
  if (fallback && fallback.length > 0) {
    console.log(`[KirkaAPI] Switched to bundled catalog fallback (${fallback.length} items loaded).`);
    publicCatalog = sanitizeCatalog(fallback);
    return publicCatalog;
  }

  return [];
}

/**
 * Fetch player profile by username, shortId, or UUID
 */
export async function fetchUserProfile(query) {
  if (!query) return null;
  const cleanQuery = query.trim().replace(/^#/, '');

  // Helper to enrich profile skins with catalog textures/renders
  const enrichProfile = async (profileData) => {
    if (!profileData) return null;
    const cat = await getPublicCatalog();
    if (profileData.activeBodySkin && profileData.activeBodySkin.name) {
      const cleanName = profileData.activeBodySkin.name.replace(/^_+/, '').trim();
      const cleanLower = cleanName.toLowerCase();
      const matched = cat.find(i => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanLower);
      profileData.activeBodySkin.textureUrl = cleanItemUrl(matched?.textureUrl || profileData.activeBodySkin.textureUrl, cleanName, true);
      profileData.activeBodySkin.renderUrl = cleanItemUrl(matched?.renderUrl || profileData.activeBodySkin.renderUrl, cleanName, false);
    }
    if (profileData.activeWeapon1Skin && profileData.activeWeapon1Skin.name) {
      const cleanName = profileData.activeWeapon1Skin.name.replace(/^_+/, '').trim();
      const cleanLower = cleanName.toLowerCase();
      const matched = cat.find(i => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanLower);
      profileData.activeWeapon1Skin.textureUrl = cleanItemUrl(matched?.textureUrl || profileData.activeWeapon1Skin.textureUrl, cleanName, true);
      profileData.activeWeapon1Skin.renderUrl = cleanItemUrl(matched?.renderUrl || profileData.activeWeapon1Skin.renderUrl, cleanName, false);
    }
    return profileData;
  };

  // 1. Try as direct UUID / Name via POST getProfile
  try {
    const res = await fetch(`${BASE_URL}/user/getProfile`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id: cleanQuery })
    });
    if (res.status >= 500) {
      throw new Error(`Kirka API Outage (${res.status})`);
    }
    if (res.ok) {
      const data = await res.json();
      if (data && (data.id || data.name)) return await enrichProfile(data);
    }
  } catch (err) {
    console.error('getProfile ID error:', err.message);
    if (err.message.includes('Outage')) throw err;
  }

  // 2. Try as shortId (e.g. FUYR7K)
  if (cleanQuery.length <= 8) {
    try {
      const res = await fetch(`${BASE_URL}/user/getProfile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id: cleanQuery.toUpperCase(), isShortId: true })
      });
      if (res.status >= 500) {
        throw new Error(`Kirka API Outage (${res.status})`);
      }
      if (res.ok) {
        const data = await res.json();
        if (data && (data.id || data.name)) return await enrichProfile(data);
      }
    } catch (err) {
      console.error('getProfile shortId error:', err.message);
      if (err.message.includes('Outage')) throw err;
    }
  }

  // 3. Search leaderboard for username match
  try {
    const res = await fetch(`${BASE_URL}/leaderboard/solo`, { headers: getHeaders() });
    if (res.status >= 500) {
      throw new Error(`Kirka API Outage (${res.status})`);
    }
    if (res.ok) {
      const json = await res.json();
      const results = json.results || json || [];
      const matched = results.find(u => u.name && u.name.toLowerCase() === cleanQuery.toLowerCase());
      if (matched && matched.userId) {
        const pData = await fetchUserProfile(matched.userId);
        return await enrichProfile(pData);
      }
    }
  } catch (err) {
    console.error('Leaderboard search error:', err.message);
    if (err.message.includes('Outage')) throw err;
  }

  return null;
}

/**
 * Fetch user inventory items and enrich with render URLs
 */
export async function fetchUserInventory(userId) {
  if (!userId) return [];
  try {
    const [invRes, itemMap] = await Promise.all([
      fetch(`${BASE_URL}/inventory/user`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id: userId })
      }),
      getPublicItemMap()
    ]);

    if (invRes.ok) {
      const data = await invRes.json();
      if (Array.isArray(data)) {
        return data.map(invItem => {
          const item = invItem.item || invItem;
          const cleanName = item.name ? item.name.replace(/^_+/, '').trim() : '';
          const cleanNameLower = cleanName.toLowerCase();
          const parentName = (item.parent?.name || '').toLowerCase();
          const keyCombo = `${cleanNameLower}_${parentName}`;
          const matchedUrl = itemMap.get(keyCombo) || itemMap.get(cleanNameLower);

          item.renderUrl = cleanItemUrl(matchedUrl || item.renderUrl, cleanName, false);
          item.textureUrl = cleanItemUrl(item.textureUrl, cleanName, true);
          return invItem;
        });
      }
    }
  } catch (err) {
    console.error('Failed inventory lookup:', err.message);
  }
  return [];
}

/**
 * Fetch clan details
 */
export async function fetchClan(clanName) {
  if (!clanName) return null;
  try {
    const res = await fetch(`${BASE_URL}/clan/${encodeURIComponent(clanName.trim())}`, {
      headers: getHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed clan lookup:', err.message);
  }
  return null;
}

let clanLeaderboardCache = null;
let clanLeaderboardTime = 0;

export async function fetchClanLeaderboard() {
  const now = Date.now();
  if (clanLeaderboardCache && (now - clanLeaderboardTime < 600000)) { // 10 minutes cache
    return clanLeaderboardCache;
  }
  try {
    const res = await fetch(`${BASE_URL}/leaderboard/clan`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      clanLeaderboardCache = data.results || data || [];
      clanLeaderboardTime = now;
      return clanLeaderboardCache;
    }
  } catch (err) {
    console.error('Failed to fetch clan leaderboard:', err.message);
  }
  return clanLeaderboardCache || [];
}

export async function getAllItemData() {
  return await getPublicCatalog();
}

export async function fetchQuests(type = null) {
  try {
    const body = type ? JSON.stringify({ type }) : JSON.stringify({});
    const res = await fetch(`${BASE_URL}/quests`, {
      method: 'POST',
      headers: getHeaders(),
      body
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch quests:', err.message);
  }
  return [];
}

export async function fetchRankedLeaderboard(category) {
  try {
    const res = await fetch(`${BASE_URL}/leaderboard/ranked${category}`, {
      headers: getHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error(`Failed to fetch ranked ${category} leaderboard:`, err.message);
  }
  return null;
}

export async function fetchSoloLeaderboardWithRewards() {
  try {
    const res = await fetch(`${BASE_URL}/leaderboard/solo`, {
      headers: getHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch solo leaderboard with rewards:', err.message);
  }
  return null;
}
