// Live Skin Editor rooms, served from the bot's web server at /live-skin.
// Everyone in a room (a Discord Activity in one channel, or a ?room= link on kirkahub.online) sees one skin.
// The first person in is the host and paints; the others watch, unless the host lets everyone paint,
// optionally with a limit on how many pixels each person may paint (the host is never limited).
// Pixel changes are relayed as they happen, tagged with who made them, and the room keeps its latest
// skin and who painted each pixel, so late joiners get both at once.
// Rooms live in memory; a restart clears them, which is fine for sessions that last minutes.
import { WebSocketServer } from 'ws';

const PATH = '/live-skin';
const TOKEN_PATH = '/live-skin/token';
const MAX_ROOMS = 200;
const MAX_PER_ROOM = 25;
const MAX_LIMIT = 10000;
const ALLOWED_ORIGIN = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|([a-z0-9-]+\.)?kirkahub\.online|\d+\.discordsays\.com)$/i;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1532695214634831872';

// id -> {
//   clients: Map<ws, name>, host: ws | null, open: boolean, limit: number (0 = no limit), round: number,
//   skin: { model, size, pixels: Buffer } | null, owners: Map<pixel, name>, used: Map<name, Set<pixel>>, emptySince
// }
const rooms = new Map();

const send = (ws, msg) => {
  if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
};
const keyOf = (skin) => `${skin.model}/${skin.size}`;

/** Who painted what, as { name: [pixel, ...] }. */
function ownersOf(room) {
  const out = {};
  for (const [i, name] of room.owners) (out[name] ||= []).push(i);
  return out;
}
const fullOf = (room) => ({
  type: 'full',
  model: room.skin.model,
  size: room.skin.size,
  pixels: room.skin.pixels.toString('base64'),
  owners: ownersOf(room),
});

const isLimited = (room, ws) => room.limit > 0 && ws !== room.host;
const usedBy = (room, name) => {
  let set = room.used.get(name);
  if (!set) room.used.set(name, (set = new Set()));
  return set;
};

/** Tells everyone who's here, who the host is, whether they may paint, and how many pixels they have. */
function announce(room) {
  const names = [...room.clients.values()];
  const host = room.host ? room.clients.get(room.host) : null;
  for (const [c, name] of room.clients) {
    send(c, { type: 'people', names, host });
    send(c, { type: 'role', host: c === room.host, open: room.open, limit: room.limit });
    sendQuota(room, c, name);
  }
}

function sendQuota(room, ws, name) {
  send(ws, { type: 'quota', limit: isLimited(room, ws) ? room.limit : 0, round: room.round, used: [...(room.used.get(name) || [])] });
}

const canPaint = (room, ws) => ws === room.host || room.open;

/**
 * Applies a list of [i, r, g, b, a] from one painter. A limited painter only gets pixels they already own
 * a slot for, or new ones while slots are left. Returns the accepted and the refused pixels.
 */
function applyPixels(room, ws, name, px) {
  const accepted = [];
  const refused = [];
  const limited = isLimited(room, ws);
  const used = limited ? usedBy(room, name) : null;
  const data = room.skin.pixels;
  for (const p of px) {
    if (!Array.isArray(p)) continue;
    const [i, r, g, b, a] = p;
    const o = i * 4;
    if (!Number.isInteger(o) || o < 0 || o + 3 >= data.length) continue;
    if (limited && !used.has(i)) {
      if (used.size >= room.limit) {
        refused.push(i);
        continue;
      }
      used.add(i);
    }
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    room.owners.set(i, name);
    accepted.push([i, r, g, b, a]);
  }
  return { accepted, refused };
}

/** Puts a painter's refused pixels back to what the room has. */
function refuse(room, ws, refused) {
  if (!refused.length) return;
  const d = room.skin.pixels;
  send(ws, { type: 'diff', key: keyOf(room.skin), px: refused.map((i) => [i, d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]) });
}

export function attachLiveSkin(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== PATH) return socket.destroy();
    const origin = req.headers.origin || '';
    if (origin && !ALLOWED_ORIGIN.test(origin)) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, url));
  });

  wss.on('connection', (ws, url) => {
    const id = (url.searchParams.get('room') || '').slice(0, 40);
    const name = (url.searchParams.get('name') || 'Painter').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || 'Painter';
    if (!/^[a-z0-9-]{3,40}$/i.test(id)) return ws.close(1008, 'bad room');
    let room = rooms.get(id);
    if (!room) {
      if (rooms.size >= MAX_ROOMS) return ws.close(1013, 'busy');
      room = { clients: new Map(), host: null, open: false, limit: 0, round: 1, skin: null, owners: new Map(), used: new Map(), emptySince: 0 };
      rooms.set(id, room);
    }
    if (room.clients.size >= MAX_PER_ROOM) return ws.close(1013, 'room full');
    room.clients.set(ws, name);
    room.emptySince = 0;
    if (!room.host) room.host = ws; // first one in (or back into an empty room) runs it

    send(ws, { type: 'role', host: ws === room.host, open: room.open, limit: room.limit });
    send(ws, room.skin ? fullOf(room) : { type: 'empty' });
    announce(room);

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }

      if (msg.type === 'open') {
        // the host's settings: may others paint, and how many pixels each
        if (ws !== room.host) return;
        room.open = !!msg.open;
        const limit = Number(msg.limit);
        if (Number.isInteger(limit) && limit >= 0 && limit <= MAX_LIMIT && limit !== room.limit) {
          room.limit = limit;
          room.used.clear(); // a new limit starts everyone from zero
          room.round++;
        }
        return announce(room);
      }
      if (msg.type === 'new-round') {
        if (ws !== room.host) return;
        room.used.clear();
        room.round++;
        return announce(room);
      }

      if (msg.type !== 'full' && msg.type !== 'diff') return;
      if (!canPaint(room, ws)) {
        // a watcher's change: ignored, and they get the real skin back
        if (room.skin) send(ws, fullOf(room));
        return;
      }

      if (msg.type === 'full') {
        const pixels = Buffer.from(String(msg.pixels || ''), 'base64');
        if (![64, 128].includes(msg.size) || pixels.length !== msg.size * msg.size * 4) return;
        const model = msg.model === 'default' ? 'default' : 'slim';
        const sameKey = room.skin && keyOf(room.skin) === `${model}/${msg.size}`;

        if (isLimited(room, ws)) {
          // a limited painter can't swap the whole skin: their changes count pixel by pixel
          if (!room.skin || !sameKey) return room.skin && send(ws, fullOf(room));
          const px = [];
          const old = room.skin.pixels;
          for (let o = 0; o < pixels.length; o += 4) {
            if (pixels[o] !== old[o] || pixels[o + 1] !== old[o + 1] || pixels[o + 2] !== old[o + 2] || pixels[o + 3] !== old[o + 3]) {
              px.push([o / 4, pixels[o], pixels[o + 1], pixels[o + 2], pixels[o + 3]]);
            }
          }
          const { accepted, refused } = applyPixels(room, ws, name, px);
          if (accepted.length) for (const c of room.clients.keys()) if (c !== ws) send(c, { type: 'diff', key: keyOf(room.skin), px: accepted, by: name });
          if (refused.length) send(ws, fullOf(room));
          return sendQuota(room, ws, name);
        }

        // whoever sends a whole skin made every pixel that changed; a new model or size starts the record over
        if (sameKey) {
          const old = room.skin.pixels;
          for (let o = 0; o < pixels.length; o += 4) {
            if (pixels[o] !== old[o] || pixels[o + 1] !== old[o + 1] || pixels[o + 2] !== old[o + 2] || pixels[o + 3] !== old[o + 3]) room.owners.set(o / 4, name);
          }
        } else {
          room.owners.clear();
        }
        room.skin = { model, size: msg.size, pixels };
        const out = JSON.stringify(fullOf(room));
        for (const c of room.clients.keys()) if (c !== ws) send(c, out);
        return;
      }

      // diff. No skin yet (the first painter dropped before sending one): ask this painter for the whole skin
      if (!room.skin) return send(ws, { type: 'need-full' });
      if (!Array.isArray(msg.px) || msg.key !== keyOf(room.skin)) return;
      const { accepted, refused } = applyPixels(room, ws, name, msg.px);
      if (accepted.length) {
        const out = JSON.stringify({ type: 'diff', key: msg.key, px: accepted, by: name });
        for (const c of room.clients.keys()) if (c !== ws) send(c, out);
      }
      refuse(room, ws, refused);
      if (isLimited(room, ws)) sendQuota(room, ws, name);
    });

    ws.on('close', () => {
      room.clients.delete(ws);
      if (room.host === ws) {
        room.host = room.clients.keys().next().value || null; // the next one in takes over
        if (room.host && !room.skin) send(room.host, { type: 'need-full' });
      }
      if (room.clients.size === 0) room.emptySince = Date.now();
      else announce(room);
    });
  });

  // empty rooms are kept 10 minutes, so someone who drops out comes back to the same skin
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) if (room.emptySince && now - room.emptySince > 10 * 60 * 1000) rooms.delete(id);
  }, 60 * 1000).unref();

  console.log(`🎨 Live Skin Editor rooms on ${PATH}`);
}

/**
 * POST /live-skin/token {code}: the Discord Activity swaps the code from authorize() for an access token, so
 * it can show people's Discord names. Needs DISCORD_CLIENT_SECRET; without it the editor uses made-up names.
 * Returns true when it handled the request.
 */
export function handleLiveSkinToken(req, res) {
  if (!req.url?.startsWith(TOKEN_PATH)) return false;
  const reply = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return reply(405, { error: 'POST only' }), true;
  const secret = process.env.DISCORD_CLIENT_SECRET;
  if (!secret) return reply(503, { error: 'not set up' }), true;

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 4096) req.destroy();
  });
  req.on('end', async () => {
    try {
      const { code } = JSON.parse(raw || '{}');
      if (typeof code !== 'string' || !code || code.length > 200) return reply(400, { error: 'no code' });
      const r = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: secret, grant_type: 'authorization_code', code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.access_token) {
        console.warn('live skin token exchange failed:', r.status, data.error || '');
        return reply(400, { error: 'exchange failed' });
      }
      reply(200, { access_token: data.access_token });
    } catch (err) {
      console.warn('live skin token error:', err.message);
      reply(500, { error: 'failed' });
    }
  });
  return true;
}
