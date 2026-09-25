// Watches the Hub Valuation sheet and posts every change to a Discord channel.
//
// It keeps its own snapshot on disk and diffs each poll against it, so a change is announced once
// and only once. On a cold boot with no snapshot it records the current sheet silently rather than
// dumping a thousand "new skin" posts into the channel.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { getBoltPriceMap, clearPriceCache, getLastPriceSource } from '../api/boltPrices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'priceSnapshot.json');

// The changelog channel. Overridable so a test server can point somewhere else.
const CHANNEL_ID = process.env.PRICE_LOG_CHANNEL_ID || '1552982849433641051';
const POLL_MS = 5 * 60 * 1000;
// A sane sheet has ~1000 rows. Anything far below that is a failed export, and diffing against it
// would report the whole list as deleted, so it is ignored.
const MIN_ROWS = 500;
// Discord allows 10 embeds per message; a big repricing pass is chunked rather than dropped.
const MAX_EMBEDS = 10;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const RARITY_COLOUR = {
  mythical: 0xe74c3c,
  legendary: 0xf1c40f,
  epic: 0x9b59b6,
  rare: 0x3498db,
  uncommon: 0x2ecc71,
  common: 0x95a5a6,
};

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US'));

function readSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  } catch (err) {
    console.warn('[PriceNotifier] Could not read snapshot:', err.message);
  }
  return null;
}

function writeSnapshot(snapshot) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot), 'utf8');
  } catch (err) {
    console.warn('[PriceNotifier] Could not write snapshot:', err.message);
  }
}

/**
 * getBoltPriceMap stores each item twice — once under "name_type" and once under the bare name —
 * so only the composite keys are kept here, otherwise every change is counted twice.
 */
function toSnapshot(priceMap) {
  const out = {};
  for (const [key, item] of priceMap) {
    if (!key.includes('_') || !item?.skinName) continue;
    out[key] = { n: item.skinName, t: item.type, r: item.rarity, v: item.baseValue ?? null };
  }
  return out;
}

function diff(before, after) {
  const changed = [];
  const added = [];
  const removed = [];

  for (const [key, cur] of Object.entries(after)) {
    const prev = before[key];
    if (!prev) { added.push(cur); continue; }
    // 0 and null both mean "no price" in the sheet; treat them alike so TBD rows do not flap
    const a = prev.v || null;
    const b = cur.v || null;
    if (a !== b) changed.push({ ...cur, from: a, to: b, pct: a && b ? Math.round(((b - a) / a) * 1000) / 10 : null });
  }
  for (const [key, prev] of Object.entries(before)) {
    if (!after[key]) removed.push(prev);
  }
  return { changed, added, removed };
}

/**
 * Identifies one announcement. The snapshot lives on Render's disk, which is wiped on every deploy
 * and is not shared if more than one instance is briefly alive during one - either of which lets
 * the same change be detected twice. The channel is the one piece of state every instance can see,
 * so what has already been posted is read back from it and skipped.
 */
const signatureOf = (kind, name, from, to) => `${kind}|${name}|${from}|${to}`;

/** Signatures of the price changes already announced in the channel's recent history. */
async function alreadyAnnounced(channel) {
  const seen = new Set();
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const msg of messages.values()) {
      if (msg.createdTimestamp < cutoff) continue;
      for (const e of msg.embeds) {
        const title = e.title || '';
        const m = title.match(/\(ID: (.+)\)$/);
        if (!m) continue;
        const name = m[1];
        const kind = title.startsWith('New Skin Change') ? 'changed'
          : title.startsWith('New Skin Added') ? 'added'
          : title.startsWith('Skin Removed') ? 'removed' : null;
        if (!kind) continue;
        const value = e.fields?.[0]?.value ?? '';
        const vals = [...value.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
        if (kind === 'changed' && vals.length >= 2) seen.add(signatureOf('changed', name, vals[0], vals[1]));
        else if (kind === 'added' && vals.length >= 1) seen.add(signatureOf('added', name, '', vals[0]));
        else if (kind === 'removed' && vals.length >= 1) seen.add(signatureOf('removed', name, vals[0], ''));
      }
    }
  } catch (err) {
    console.warn('[PriceNotifier] Could not read channel history, posting without the duplicate check:', err.message);
  }
  return seen;
}

function buildEmbeds({ changed, added, removed }) {
  const colour = (r) => RARITY_COLOUR[String(r || '').toLowerCase()] ?? 0x5865f2;
  const embeds = [];

  for (const c of changed) {
    const up = (c.pct ?? 0) > 0;
    embeds.push(new EmbedBuilder()
      .setColor(colour(c.r))
      .setTitle(`New Skin Change Detected (ID: ${c.n})`)
      .setDescription(`A change has been detected for skin: **${c.n}**`)
      .addFields({
        name: 'Hub Value',
        value: `Hub Value: "${fmt(c.from)}" → "${fmt(c.to)}"${c.pct !== null ? `\n${up ? '📈' : '📉'} ${up ? '+' : ''}${c.pct}%` : ''}`,
      })
      .setFooter({ text: `${c.t || 'Unknown'} · ${c.r || 'Unknown'}` })
      .setTimestamp(new Date()));
  }

  for (const a of added) {
    embeds.push(new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`New Skin Added (ID: ${a.n})`)
      .setDescription(`A new skin has been added to the list: **${a.n}**`)
      .addFields({ name: 'Hub Value', value: `Hub Value: "${a.v ? fmt(a.v) : 'TBD'}"` })
      .setFooter({ text: `${a.t || 'Unknown'} · ${a.r || 'Unknown'}` })
      .setTimestamp(new Date()));
  }

  for (const r of removed) {
    embeds.push(new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`Skin Removed (ID: ${r.n})`)
      .setDescription(`This skin is no longer on the list: **${r.n}**`)
      .addFields({ name: 'Hub Value', value: `Hub Value: "${fmt(r.v)}" → "—"` })
      .setFooter({ text: `${r.t || 'Unknown'} · ${r.r || 'Unknown'}` })
      .setTimestamp(new Date()));
  }

  return embeds;
}

/** One poll: compare the sheet with the stored snapshot and announce whatever moved. */
export async function checkPriceChanges(client, { announce = true } = {}) {
  clearPriceCache(); // the sheet is the point of the check, so never serve it from cache
  const priceMap = await getBoltPriceMap();
  const after = toSnapshot(priceMap);
  const rowCount = Object.keys(after).length;

  const source = getLastPriceSource();

  if (rowCount < MIN_ROWS) {
    console.warn(`[PriceNotifier] Only ${rowCount} rows — skipping this check.`);
    return { skipped: true, source, rowCount, changed: 0, added: 0, removed: 0 };
  }

  // Reading the bundled file means the sheet was unreachable. It never changes, so the check would
  // silently never fire; say so rather than reporting "no changes".
  if (source !== 'sheet') {
    console.warn('[PriceNotifier] Prices came from the local fallback, not the sheet — skipping.');
    return { noSheet: true, source, rowCount, changed: 0, added: 0, removed: 0 };
  }

  const before = readSnapshot();
  if (!before) {
    writeSnapshot(after);
    console.log(`[PriceNotifier] Baseline recorded (${rowCount} items), nothing announced.`);
    return { baseline: true, source, rowCount, changed: 0, added: 0, removed: 0 };
  }

  const result = diff(before, after);
  const total = result.changed.length + result.added.length + result.removed.length;
  if (!total) return { source, rowCount, changed: 0, added: 0, removed: 0 };

  if (announce) {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
      // the snapshot is deliberately not saved, so the change is retried on the next poll
      console.warn(`[PriceNotifier] Channel ${CHANNEL_ID} unreachable — keeping the change for next time.`);
      return { error: 'channel', source, rowCount, changed: 0, added: 0, removed: 0 };
    }
    // drop anything the channel already shows, so a lost snapshot cannot repost it
    const posted = await alreadyAnnounced(channel);
    const fresh = {
      changed: result.changed.filter((c) => !posted.has(signatureOf('changed', c.n, fmt(c.from), fmt(c.to)))),
      added: result.added.filter((a) => !posted.has(signatureOf('added', a.n, '', a.v ? fmt(a.v) : 'TBD'))),
      removed: result.removed.filter((r) => !posted.has(signatureOf('removed', r.n, fmt(r.v), ''))),
    };
    const skipped = total - (fresh.changed.length + fresh.added.length + fresh.removed.length);
    if (skipped > 0) console.log(`[PriceNotifier] ${skipped} change(s) already in the channel — not reposting.`);

    const embeds = buildEmbeds(fresh);
    for (let i = 0; i < embeds.length; i += MAX_EMBEDS) {
      await channel.send({ embeds: embeds.slice(i, i + MAX_EMBEDS) }).catch((e) =>
        console.error('[PriceNotifier] Failed to post:', e.message));
    }

    writeSnapshot(after);
    console.log(`[PriceNotifier] ${fresh.changed.length} changed, ${fresh.added.length} added, ${fresh.removed.length} removed.`);
    return {
      source, rowCount, skipped,
      changed: fresh.changed.length, added: fresh.added.length, removed: fresh.removed.length,
    };
  }

  writeSnapshot(after);
  console.log(`[PriceNotifier] ${result.changed.length} changed, ${result.added.length} added, ${result.removed.length} removed.`);
  return { source, rowCount, changed: result.changed.length, added: result.added.length, removed: result.removed.length };
}

export function startPriceNotifier(client) {
  console.log(`🏷️  [PriceNotifier] Watching the Hub Valuation sheet (every ${POLL_MS / 60000} minutes) → channel ${CHANNEL_ID}`);
  setTimeout(() => checkPriceChanges(client).catch((e) => console.error('[PriceNotifier]', e.message)), 20000);
  setInterval(() => checkPriceChanges(client).catch((e) => console.error('[PriceNotifier]', e.message)), POLL_MS);
}
