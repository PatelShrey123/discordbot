const KIRKA_API_KEY = process.env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060';
const BASE_URL = 'https://api.kirka.io/api';

let publicItemMap = null;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'accept': 'application/json, text/plain, */*',
  'ApiKey': KIRKA_API_KEY,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});

/**
 * Fetch and cache public item catalog for render URLs
 */
export async function getPublicItemMap() {
  if (publicItemMap) return publicItemMap;

  const map = new Map();
  try {
    const res = await fetch(`${BASE_URL}/inventory/items`, { headers: getHeaders() });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        items.forEach(item => {
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
    }
  } catch (err) {
    console.error('Failed to fetch public items map:', err.message);
  }

  publicItemMap = map;
  return map;
}

let publicCatalog = null;

export async function getPublicCatalog() {
  if (publicCatalog) return publicCatalog;
  try {
    const res = await fetch(`${BASE_URL}/inventory/items`, { headers: getHeaders() });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        publicCatalog = items;
        return items;
      }
    }
  } catch (err) {
    console.error('Failed to fetch public catalog:', err.message);
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
      const cleanName = profileData.activeBodySkin.name.replace(/^_+/, '').trim().toLowerCase();
      const matched = cat.find(i => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanName);
      if (matched) {
        profileData.activeBodySkin.textureUrl = matched.textureUrl;
        profileData.activeBodySkin.renderUrl = matched.renderUrl;
      }
    }
    if (profileData.activeWeapon1Skin && profileData.activeWeapon1Skin.name) {
      const cleanName = profileData.activeWeapon1Skin.name.replace(/^_+/, '').trim().toLowerCase();
      const matched = cat.find(i => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanName);
      if (matched) {
        profileData.activeWeapon1Skin.textureUrl = matched.textureUrl;
        profileData.activeWeapon1Skin.renderUrl = matched.renderUrl;
      }
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
          if (!item.renderUrl && item.name) {
            const cleanName = item.name.replace(/^_+/, '').trim().toLowerCase();
            const parentName = (item.parent?.name || '').toLowerCase();
            const keyCombo = `${cleanName}_${parentName}`;
            const matchedUrl = itemMap.get(keyCombo) || itemMap.get(cleanName);
            if (matchedUrl) {
              item.renderUrl = matchedUrl;
            }
          }
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

let allItemDataCache = null;

export async function getAllItemData() {
  if (allItemDataCache) return allItemDataCache;
  try {
    const res = await fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/AllItemData.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        allItemDataCache = data;
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to fetch AllItemData:', err.message);
  }
  return [];
}
