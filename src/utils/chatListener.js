import { saveLinkedAccount } from '../api/db.js';
import WebSocket from 'ws';

// Map of temporary active verification codes: token -> { discordId }
export const pendingLinks = new Map();

const REGIONS = [
  { name: 'Global', url: 'wss://chat.kirka.io' }
];

const wsInstances = new Map();
let clientInstance = null;

// Rolling buffer of what the global chat has said lately, so /chat can answer instantly
// without opening another socket. Holds only what fits on screen, nothing is persisted.
const CHAT_BUFFER_MAX = 80;
const chatBuffer = [];

function pushChat(entry) {
  chatBuffer.push(entry);
  if (chatBuffer.length > CHAT_BUFFER_MAX) chatBuffer.splice(0, chatBuffer.length - CHAT_BUFFER_MAX);
}

/** Most recent chat lines, oldest first. `limit` caps how many come back. */
export function getRecentChat(limit = 15, includeTrades = true) {
  const rows = includeTrades ? chatBuffer : chatBuffer.filter((m) => m.type === 2);
  return rows.slice(-limit);
}

export function getChatBufferSize() {
  return chatBuffer.length;
}

export function startChatListener(client) {
  clientInstance = client;
  REGIONS.forEach(region => {
    connectRegionWebSocket(region);
  });
}

export function getWebSocketStatus() {
  const status = [];
  REGIONS.forEach(region => {
    const ws = wsInstances.get(region.name);
    let state = 'NOT_STARTED';
    if (ws) {
      switch (ws.readyState) {
        case 0: state = 'CONNECTING'; break;
        case 1: state = 'OPEN'; break;
        case 2: state = 'CLOSING'; break;
        case 3: state = 'CLOSED'; break;
      }
    }
    status.push({ name: region.name, state });
  });
  return status;
}

// ws applies no handshake timeout of its own. If the upgrade hangs — which is what a silently
// dropped connection from a datacenter IP looks like — the socket sits in CONNECTING forever,
// 'close' never fires, and the retry below never runs. One hung handshake killed the listener for
// the life of the process. Both a handshakeTimeout and a watchdog now turn that into a retry.
const HANDSHAKE_TIMEOUT_MS = 15000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const retryCounts = new Map();

function connectRegionWebSocket(region) {
  console.log(`[ChatListener] Connecting to Kirka ${region.name} Chat WebSocket (${region.url})...`);

  // Origin matches what a browser sends; Kirka accepts anonymous connections but a datacenter IP
  // with no Origin is the sort of request an edge proxy is most likely to sit on.
  const ws = new WebSocket(region.url, {
    handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    headers: { Origin: 'https://kirka.io', 'User-Agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' },
  });
  wsInstances.set(region.name, ws);

  // belt and braces: if the socket is still CONNECTING after the timeout, force it closed so the
  // close handler schedules a retry
  const watchdog = setTimeout(() => {
    if (ws.readyState === 0) {
      console.warn(`[ChatListener] ${region.name} handshake hung for ${HANDSHAKE_TIMEOUT_MS / 1000}s — forcing a retry.`);
      try { ws.terminate(); } catch { /* already gone */ }
    }
  }, HANDSHAKE_TIMEOUT_MS + 2000);
  ws.once('close', () => clearTimeout(watchdog));
  ws.once('open', () => clearTimeout(watchdog));

  ws.on('open', () => {
    retryCounts.set(region.name, 0);
    console.log(`[ChatListener] Connected to Kirka ${region.name} WebSocket successfully!`);
  });

  ws.on('message', async (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // Keep every displayable line: type 2 = player chat, type 13 = server/trade notices.
      // type 3 is the backlog Kirka sends on connect, which arrives as a list.
      const remember = (m) => {
        if (!m || typeof m.message !== 'string' || !m.message.trim()) return;
        if (m.type !== 2 && m.type !== 13) return;
        pushChat({
          type: m.type,
          name: m.user?.name || null,
          shortId: m.user?.shortId || null,
          level: m.user?.level ?? null,
          role: m.user?.role || 'USER',
          message: m.message,
          at: Date.now(),
        });
      };
      if (data.type === 3 && Array.isArray(data.messages)) data.messages.forEach(remember);
      else remember(data);

      // type 2 is general user chat messages in the Kirka server lobby
      if (data.type === 2 && data.user && typeof data.message === 'string') {
        const text = data.message.trim();

        // Check if the chat message matches a pending verification token
        if (pendingLinks.has(text)) {
          const { discordId } = pendingLinks.get(text);
          const kirkaUser = data.user; // { id, shortId, name }

          console.log(`[ChatListener] Verification matched! Discord User: ${discordId} -> Kirka: ${kirkaUser.name} (#${kirkaUser.shortId})`);

          // 1. Save link in Supabase Postgres
          await saveLinkedAccount(discordId, kirkaUser);

          // 2. Remove from active pending map
          pendingLinks.delete(text);

          // 3. Send successful verification DM to user
          try {
            const discordUser = await clientInstance.users.fetch(discordId);
            if (discordUser) {
              await discordUser.send(`🎉 **Verification Successful!** Your Discord account is now linked to Kirka profile **${kirkaUser.name}** (\`#${kirkaUser.shortId}\`).\n\nYou can now run \`/profile\` or \`/inventory\` without typing your name!`);
            }
          } catch (dmErr) {
            console.warn(`[ChatListener] Failed to send DM to linked user ${discordId}:`, dmErr.message);
          }
        }
      }
    } catch (err) {
      // Ignore parse/process errors
    }
  });

  ws.on('error', (error) => {
    console.error(`[ChatListener] WebSocket ${region.name} error:`, error.message || error);
  });

  ws.on('close', () => {
    wsInstances.set(region.name, null);
    // back off when the far end keeps refusing, so a sustained block is not hammered every 5s
    const n = (retryCounts.get(region.name) ?? 0) + 1;
    retryCounts.set(region.name, n);
    const delay = Math.min(RETRY_BASE_MS * 2 ** (n - 1), RETRY_MAX_MS);
    console.warn(`[ChatListener] WebSocket ${region.name} disconnected (attempt ${n}). Retrying in ${delay / 1000}s...`);
    setTimeout(() => connectRegionWebSocket(region), delay);
  });
}
