// Live Skin Editor rooms, served from the bot's web server at /live-skin.
// Everyone in a room (a Discord Activity in one channel, or a ?room= link on kirkahub.online) sees one skin.
// The first person in is the host and paints; the others watch, unless the host lets everyone paint.
// Pixel changes are relayed as they happen, and the room keeps its latest skin so late joiners get it at once.
// Rooms live in memory; a restart clears them, which is fine for sessions that last minutes.
import { WebSocketServer } from 'ws';

const PATH = '/live-skin';
const MAX_ROOMS = 200;
const MAX_PER_ROOM = 25;
const ALLOWED_ORIGIN = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|([a-z0-9-]+\.)?kirkahub\.online|\d+\.discordsays\.com)$/i;

// id -> { clients: Map<ws, name>, host: ws | null, open: boolean, skin: { model, size, pixels: Buffer } | null, emptySince }
const rooms = new Map();

const send = (ws, msg) => {
  if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
};
const fullOf = (room) => ({ type: 'full', model: room.skin.model, size: room.skin.size, pixels: room.skin.pixels.toString('base64') });

/** Tells everyone who's here, who the host is, and whether they may paint. */
function announce(room) {
  const names = [...room.clients.values()];
  const host = room.host ? room.clients.get(room.host) : null;
  for (const c of room.clients.keys()) {
    send(c, { type: 'people', names, host });
    send(c, { type: 'role', host: c === room.host, open: room.open });
  }
}

const canPaint = (room, ws) => ws === room.host || room.open;

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
    const name = (url.searchParams.get('name') || 'Painter').replace(/[\u0000-\u001f]/g, '').slice(0, 32) || 'Painter';
    if (!/^[a-z0-9-]{3,40}$/i.test(id)) return ws.close(1008, 'bad room');
    let room = rooms.get(id);
    if (!room) {
      if (rooms.size >= MAX_ROOMS) return ws.close(1013, 'busy');
      room = { clients: new Map(), host: null, open: false, skin: null, emptySince: 0 };
      rooms.set(id, room);
    }
    if (room.clients.size >= MAX_PER_ROOM) return ws.close(1013, 'room full');
    room.clients.set(ws, name);
    room.emptySince = 0;
    if (!room.host) room.host = ws; // first one in (or back into an empty room) runs it

    send(ws, { type: 'role', host: ws === room.host, open: room.open });
    send(ws, room.skin ? fullOf(room) : { type: 'empty' });
    announce(room);

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }

      if (msg.type === 'open') {
        if (ws !== room.host) return;
        room.open = !!msg.open;
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
        room.skin = { model: msg.model === 'default' ? 'default' : 'slim', size: msg.size, pixels };
      } else {
        // no skin yet (the first painter dropped before sending one): ask this painter for the whole skin
        if (!room.skin) return send(ws, { type: 'need-full' });
        if (!Array.isArray(msg.px) || msg.key !== `${room.skin.model}/${room.skin.size}`) return;
        for (const p of msg.px) {
          if (!Array.isArray(p)) continue;
          const [i, r, g, b, a] = p;
          const o = i * 4;
          if (!Number.isInteger(o) || o < 0 || o + 3 >= room.skin.pixels.length) continue;
          room.skin.pixels[o] = r; room.skin.pixels[o + 1] = g; room.skin.pixels[o + 2] = b; room.skin.pixels[o + 3] = a;
        }
      }
      const out = String(data);
      for (const c of room.clients.keys()) if (c !== ws) send(c, out);
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
