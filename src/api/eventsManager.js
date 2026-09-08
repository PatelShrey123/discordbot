import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedData = null;

export function loadEventsData() {
  if (cachedData) return cachedData;
  try {
    const dataPath = path.join(__dirname, '../data/eventsData.json');
    if (fs.existsSync(dataPath)) {
      cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return cachedData;
    }
  } catch (err) {
    console.error('[EventsManager] Failed to load eventsData.json:', err.message);
  }
  return { events: [], clanwars: [], stores: [], limited: [] };
}

export function getEventQuests(query = '') {
  const data = loadEventsData();
  const events = data.events || [];
  if (!query || query.trim() === '' || query.toLowerCase() === 'latest' || query.toLowerCase() === '2026') {
    const priority = ['27th event', '26th event', 'summer daily streak', '25th event', '24th event', '23rd event'];
    const filtered = events.filter(e => {
      const t = e.title.toLowerCase();
      return priority.some(p => t.includes(p));
    });
    return filtered.sort((a, b) => {
      const aIdx = priority.findIndex(p => a.title.toLowerCase().includes(p));
      const bIdx = priority.findIndex(p => b.title.toLowerCase().includes(p));
      return aIdx - bIdx;
    });
  }

  const q = query.trim().toLowerCase();
  return events.filter(e => {
    if (e.title.toLowerCase().includes(q)) return true;
    return e.items.some(it => it.name.toLowerCase().includes(q));
  });
}

export function getClanWars(query = '') {
  const data = loadEventsData();
  const wars = data.clanwars || [];
  if (!query || query.trim() === '' || query.toLowerCase() === 'latest' || query.toLowerCase() === '2026') {
    return wars.slice(-6).reverse();
  }

  const q = query.trim().toLowerCase();
  return wars.filter(w => {
    if (w.title.toLowerCase().includes(q)) return true;
    return w.items.some(it => it.name.toLowerCase().includes(q));
  }).reverse();
}

export function getStoresAndRanked(query = '') {
  const data = loadEventsData();
  const stores = data.stores || [];
  if (!query || query.trim() === '' || query.toLowerCase() === 'latest' || query.toLowerCase() === '2026') {
    return stores.filter(s => {
      const t = s.title.toLowerCase();
      return t.includes('2026') || t.includes('ranked') || t.includes('panda') || t.includes('jungle') || t.includes('fallout');
    }).reverse();
  }

  const q = query.trim().toLowerCase();
  return stores.filter(s => {
    if (s.title.toLowerCase().includes(q)) return true;
    return s.items.some(it => it.name.toLowerCase().includes(q));
  }).reverse();
}
