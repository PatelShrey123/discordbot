import https from 'https';

export const REGIONS = {
  india: {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    host: 'india.kirka.io',
    aliases: ['in', 'ind', 'india', 'mumbai']
  },
  asia: {
    id: 'asia',
    name: 'Asia',
    flag: '🌏',
    host: 'asia.kirka.io',
    aliases: ['as', 'asia', 'sg', 'singapore', 'tokyo']
  },
  eu: {
    id: 'eu',
    name: 'Europe',
    flag: '🇪🇺',
    host: 'eu.kirka.io',
    aliases: ['eu', 'europe', 'ger', 'germany', 'uk']
  },
  na: {
    id: 'na',
    name: 'North America',
    flag: '🇺🇸',
    host: 'na.kirka.io',
    aliases: ['na', 'us', 'usa', 'america', 'useast', 'uswest']
  },
  sa: {
    id: 'sa',
    name: 'South America',
    flag: '🇧🇷',
    host: 'sa.kirka.io',
    aliases: ['sa', 'br', 'brazil', 'latam']
  }
};

/**
 * Resolves user input string to valid region config
 */
export function resolveRegion(input) {
  if (!input) return REGIONS.india;
  const clean = input.trim().toLowerCase();

  for (const reg of Object.values(REGIONS)) {
    if (reg.aliases.includes(clean) || reg.id === clean || reg.name.toLowerCase() === clean) {
      return reg;
    }
  }

  return REGIONS.india;
}

/**
 * Fetches live active rooms from Kirka's Colyseus cluster
 */
export async function fetchLiveRooms(regionKey = 'india') {
  const reg = resolveRegion(regionKey);

  return new Promise((resolve) => {
    const req = https.get(`https://${reg.host}/matchmake/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rawRooms = JSON.parse(data);
          if (!Array.isArray(rawRooms)) {
            return resolve({ region: reg, rooms: [], totalPlayers: 0 });
          }

          const rooms = rawRooms.map(r => {
            const meta = r.WwwMWn || {};
            const mode = r.name || meta.wMWNwm || 'TDM';
            const map = meta.wWwMnWmN || 'Shipment';
            const players = r.WmwwMWnN || 0;
            const maxPlayers = meta.wWnmwNW || 8;
            const code = r.WMwnWNmw || r.WwMmWnNw || 'LOBBY';

            return {
              mode,
              map,
              title: `${mode}_${map}`,
              players,
              maxPlayers,
              code,
              tag: `${reg.id.toUpperCase()}~${code}`,
              isFull: players >= maxPlayers,
              inRound: meta.inRound___METADATA !== false
            };
          });

          // Sort rooms: non-full rooms with players first, then full rooms, then empty
          rooms.sort((a, b) => {
            if (a.isFull && !b.isFull) return 1;
            if (!a.isFull && b.isFull) return -1;
            return b.players - a.players;
          });

          const totalPlayers = rooms.reduce((sum, r) => sum + r.players, 0);
          resolve({ region: reg, rooms, totalPlayers });
        } catch (err) {
          console.error(`[ServerBrowser] Error parsing response from ${reg.host}:`, err.message);
          resolve({ region: reg, rooms: [], totalPlayers: 0 });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[ServerBrowser] Request to ${reg.host} failed:`, err.message);
      resolve({ region: reg, rooms: [], totalPlayers: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ region: reg, rooms: [], totalPlayers: 0 });
    });
  });
}
