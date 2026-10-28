import fs from 'fs';
import * as XLSX from 'xlsx';

export const BLISS_ONEDRIVE_URL = 'https://1drv.ms/x/c/a081ba7e636a43b5/IQDnj0Ik5m4JRrtdGuvTO8e9ATJvwjSJquOkm9vCFKZp5rA?e=yLq12L';

let lastSource = null;
export function getLastBlissSource() { return lastSource; }

const TYPES = ['Character', 'Bayonet', 'VITA', 'Shark', 'SCAR', 'AR-9', 'Revolver', 'MAC-10', 'LAR', 'Weatie', 'Tomahawk', 'M60', 'Chest', 'Card'];
const TYPE_BY_LOWER = new Map(TYPES.map((t) => [t.toLowerCase(), t]));
function normalizeType(raw) {
  const t = String(raw || '').replace(/\?/g, '').trim();
  return TYPE_BY_LOWER.get(t.toLowerCase()) || t || 'Unknown';
}

function normalizeRarity(raw) {
  const r = String(raw || '').trim().toLowerCase();
  return r ? r[0].toUpperCase() + r.slice(1) : 'Common';
}

function parseValue(raw) {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return Math.round(raw);
  const s = String(raw).trim();
  if (!s || /^(tbd|n\/?a|-|\?+)$/i.test(s)) return 0;
  const num = Number(s.replace(/[,.]/g, ''));
  return Number.isFinite(num) ? Math.round(num) : 0;
}

async function fetchWorkbookBuffer() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Strategy 1: Anonymous session redirect
  try {
    const r1 = await fetch(BLISS_ONEDRIVE_URL, { redirect: 'manual', headers: { 'User-Agent': ua } });
    const loc1 = r1.headers.get('location');
    if (loc1) {
      const r2 = await fetch(loc1, { redirect: 'manual', headers: { 'User-Agent': ua } });
      const cookieHeaders = r2.headers.getSetCookie ? r2.headers.getSetCookie() : [r2.headers.get('set-cookie')].filter(Boolean);
      const cookieStr = cookieHeaders.map(c => c.split(';')[0]).join('; ');

      const m = loc1.match(/resid=([A-Z0-9]+)!s?([a-f0-9-]+)/i);
      const uniqueId = m ? m[2] : '24428fe7-6ee6-4609-bb5d-1aebd33bc7bd';

      const downloadUrl = `https://onedrive.live.com/personal/a081ba7e636a43b5/_layouts/15/download.aspx?UniqueId=${uniqueId}`;
      const r3 = await fetch(downloadUrl, {
        headers: {
          'User-Agent': ua,
          'Cookie': cookieStr
        }
      });
      if (r3.ok) {
        const buf = Buffer.from(await r3.arrayBuffer());
        if (buf.length > 5000) return buf;
      }
    }
  } catch (err) {
    console.warn('[BlissSheet] Anonymous session download attempt failed:', err.message);
  }

  // Strategy 2: Badger guest token
  try {
    const GUEST_TOKEN_URL = 'https://api-badgerp.svc.ms/v1.0/token';
    const GUEST_APP_ID = '5cbed6ac-a083-4e14-b191-b4ba07653de2';
    const API = 'https://my.microsoftpersonalcontent.com/_api/v2.0';
    const shareId = 'u!' + Buffer.from(BLISS_ONEDRIVE_URL).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');

    const tokRes = await fetch(GUEST_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: GUEST_APP_ID }),
    });
    if (tokRes.ok) {
      const { token } = await tokRes.json();
      if (token) {
        const itemRes = await fetch(`${API}/shares/${shareId}/driveitem?$select=name,lastModifiedDateTime,@content.downloadUrl`, {
          headers: { Authorization: `Badger ${token}`, Prefer: 'autoredeem' },
        });
        if (itemRes.ok) {
          const item = await itemRes.json();
          const dlUrl = item['@content.downloadUrl'];
          if (dlUrl) {
            const dlRes = await fetch(dlUrl);
            if (dlRes.ok) {
              const buf = Buffer.from(await dlRes.arrayBuffer());
              if (buf.length > 5000) return buf;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[BlissSheet] Badger download attempt failed:', err.message);
  }

  throw new Error('All OneDrive download attempts failed');
}

export async function getBlissPriceMap() {
  const map = new Map();
  let loaded = false;

  try {
    const buf = await fetchWorkbookBuffer();
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: ['A', 'B', 'C', 'D', 'E'] });

    if (Array.isArray(rows) && rows.length >= 500) {
      for (const row of rows) {
        const skinName = String(row.A || '').trim();
        if (!skinName || /^test\d*$/i.test(skinName)) continue;
        const rarity = normalizeRarity(row.B);
        const baseValue = parseValue(row.C);
        const obtainableBy = String(row.D || '').trim() || 'All chests';
        const type = normalizeType(row.E);

        const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
        const keyNameOnly = skinName.toLowerCase();

        const itemObj = { skinName, rarity, baseValue, type, obtainableBy };
        map.set(keyWithType, itemObj);
        if (!map.has(keyNameOnly)) {
          map.set(keyNameOnly, itemObj);
        }
      }
      console.log(`[BlissSheet] Successfully loaded ${map.size} items from live Bliss Price List workbook.`);
      loaded = true;
      lastSource = 'live';
    }
  } catch (e) {
    console.warn('[BlissSheet] Live workbook fetch failed, falling back to local snapshot:', e.message);
  }

  if (!loaded) {
    try {
      const raw = fs.readFileSync(new URL('../data/bliss_prices.json', import.meta.url), 'utf8');
      const rows = JSON.parse(raw);
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          const skinName = String(row['Skin Name'] || '').trim();
          const rarity = normalizeRarity(row['Skin Rarity']);
          const baseValueStr = (row['Bliss Value'] || row['Base Value'] || '').toString().replace(/,/g, '');
          const baseValue = parseInt(baseValueStr, 10) || 0;
          const type = normalizeType(row['Type']);
          const keyWithType = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
          const keyNameOnly = skinName.toLowerCase();
          const obtainableBy = String(row['Obtainable By'] || 'All chests').trim();

          const itemObj = { skinName, rarity, baseValue, type, obtainableBy };
          map.set(keyWithType, itemObj);
          if (!map.has(keyNameOnly)) {
            map.set(keyNameOnly, itemObj);
          }
        });
        console.log(`[BlissSheet] Successfully loaded ${map.size} items from local bliss_prices.json snapshot.`);
        lastSource = 'local';
        loaded = true;
      }
    } catch (err) {
      console.error('[BlissSheet] Failed to read bliss_prices.json snapshot:', err.message);
    }
  }

  return map;
}
