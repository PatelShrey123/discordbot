import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const buf = fs.readFileSync('C:/Users/Shrey/.gemini/antigravity/scratch/bliss_price_list.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: ['A', 'B', 'C', 'D', 'E'] });

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

const items = [];
for (const r of rows) {
  const skinName = String(r.A || '').trim();
  if (!skinName || /^test\d*$/i.test(skinName)) continue;
  const rarity = normalizeRarity(r.B);
  const baseValue = parseValue(r.C);
  const obtainableBy = String(r.D || '').trim() || 'All chests';
  const type = normalizeType(r.E);

  items.push({
    'Skin Name': skinName,
    'Skin Rarity': rarity,
    'Bliss Value': baseValue > 0 ? baseValue.toLocaleString('en-US') : 'TBD',
    'Base Value': baseValue,
    'Obtainable By': obtainableBy,
    'Type': type
  });
}

console.log(`Generated ${items.length} items.`);
fs.writeFileSync('C:/Users/Shrey/.gemini/antigravity/scratch/discordbot/src/data/bliss_prices.json', JSON.stringify(items, null, 2), 'utf8');
fs.writeFileSync('C:/Users/Shrey/.gemini/antigravity/scratch/discordbot/src/data/hub_prices.json', JSON.stringify(items, null, 2), 'utf8');
console.log('Saved to bliss_prices.json and hub_prices.json successfully!');
