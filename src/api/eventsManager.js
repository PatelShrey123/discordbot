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

function parseRangesAndNumbers(title) {
  const ranges = [];
  const numbers = [];

  // Match ranges like "22nd-29th", "22-29", "22nd - 29th"
  const rangeRegex = /(\d+)(?:st|nd|rd|th)?\s*[-–—]\s*(\d+)(?:st|nd|rd|th)?/gi;
  let rMatch;
  while ((rMatch = rangeRegex.exec(title)) !== null) {
    const s = parseInt(rMatch[1], 10);
    const e = parseInt(rMatch[2], 10);
    ranges.push({ min: Math.min(s, e), max: Math.max(s, e) });
  }

  // Match all numbers / ordinals: e.g. "17th", "18th", "48th", "0th"
  const numRegex = /\b(\d+)(?:st|nd|rd|th)?\b/gi;
  let nMatch;
  while ((nMatch = numRegex.exec(title)) !== null) {
    numbers.push(parseInt(nMatch[1], 10));
  }

  return { ranges, numbers };
}

function titleMatchesNumber(title, num) {
  const { ranges, numbers } = parseRangesAndNumbers(title);
  for (const r of ranges) {
    if (num >= r.min && num <= r.max) return true;
  }
  return numbers.includes(num);
}

function titleMatchesRange(title, qMin, qMax) {
  const { ranges, numbers } = parseRangesAndNumbers(title);
  for (const r of ranges) {
    if (Math.max(r.min, qMin) <= Math.min(r.max, qMax)) return true;
  }
  return numbers.some(n => n >= qMin && n <= qMax);
}

function itemMatchesQuery(it, q) {
  return (
    (it.name && it.name.toLowerCase().includes(q)) ||
    (it.type && it.type.toLowerCase().includes(q)) ||
    (it.rarity && it.rarity.toLowerCase().includes(q)) ||
    (it.req && it.req.toLowerCase().includes(q))
  );
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
  if (q === 'all') {
    return [...events].reverse();
  }

  const cleaned = q
    .replace(/^[.#/]+/, '')
    .replace(/^(?:events?)\s*/i, '')
    .trim();

  const rangeMatch = cleaned.match(/^(\d+)(?:st|nd|rd|th)?\s*[-–—]\s*(\d+)(?:st|nd|rd|th)?$/i);
  let qMin = null, qMax = null;
  if (rangeMatch) {
    qMin = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
    qMax = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
  }

  const numMatch = !rangeMatch && (cleaned.match(/^(\d+)(?:st|nd|rd|th)?$/i) || q.match(/^event(\d+)$/i));
  const targetNum = numMatch ? parseInt(numMatch[1], 10) : null;

  return events.filter(e => {
    if (targetNum !== null) {
      return titleMatchesNumber(e.title, targetNum);
    }
    if (qMin !== null && qMax !== null) {
      return titleMatchesRange(e.title, qMin, qMax);
    }
    if (e.title.toLowerCase().includes(q)) return true;
    return e.items.some(it => itemMatchesQuery(it, q));
  });
}

export function getClanWars(query = '') {
  const data = loadEventsData();
  const wars = data.clanwars || [];
  if (!query || query.trim() === '' || query.toLowerCase() === 'latest' || query.toLowerCase() === '2026') {
    return wars.slice(-6).reverse();
  }

  const q = query.trim().toLowerCase();
  if (q === 'all') {
    return [...wars].reverse();
  }

  const cleaned = q
    .replace(/^[.#/]+/, '')
    .replace(/^(?:clan\s*wars?|clanwar|cw|wars?)\s*/i, '')
    .trim();

  const rangeMatch = cleaned.match(/^(\d+)(?:st|nd|rd|th)?\s*[-–—]\s*(\d+)(?:st|nd|rd|th)?$/i);
  let qMin = null, qMax = null;
  if (rangeMatch) {
    qMin = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
    qMax = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
  }

  const numMatch = !rangeMatch && (cleaned.match(/^(\d+)(?:st|nd|rd|th)?$/i) || q.match(/^cw(\d+)$/i));
  const targetNum = numMatch ? parseInt(numMatch[1], 10) : null;

  return wars.filter(w => {
    if (targetNum !== null) {
      return titleMatchesNumber(w.title, targetNum);
    }
    if (qMin !== null && qMax !== null) {
      return titleMatchesRange(w.title, qMin, qMax);
    }
    if (w.title.toLowerCase().includes(q)) return true;
    return w.items.some(it => itemMatchesQuery(it, q));
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
  if (q === 'all') {
    return [...stores].reverse();
  }

  const cleaned = q
    .replace(/^[.#/]+/, '')
    .replace(/^(?:seasons?|stores?|ranked)\s*/i, '')
    .trim();

  const rangeMatch = cleaned.match(/^(\d+)(?:st|nd|rd|th)?\s*[-–—]\s*(\d+)(?:st|nd|rd|th)?$/i);
  let qMin = null, qMax = null;
  if (rangeMatch) {
    qMin = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
    qMax = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
  }

  const numMatch = !rangeMatch && cleaned.match(/^(\d+)(?:st|nd|rd|th)?$/i);
  const targetNum = numMatch ? parseInt(numMatch[1], 10) : null;

  return stores.filter(s => {
    if (targetNum !== null) {
      return titleMatchesNumber(s.title, targetNum);
    }
    if (qMin !== null && qMax !== null) {
      return titleMatchesRange(s.title, qMin, qMax);
    }
    if (s.title.toLowerCase().includes(q)) return true;
    return s.items.some(it => itemMatchesQuery(it, q));
  }).reverse();
}
