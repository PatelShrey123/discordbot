import { saveLinkedAccount } from '../api/db.js';

// Map of temporary active verification codes: token -> { discordId }
export const pendingLinks = new Map();

let ws = null;
let clientInstance = null;

export function startChatListener(client) {
  clientInstance = client;
  connectWebSocket();
}

function connectWebSocket() {
  if (ws) {
    try {
      ws.close();
    } catch (e) {}
  }

  console.log('[ChatListener] Connecting to Kirka Lobby Chat WebSocket (wss://chat.kirka.io)...');
  
  // Use Node 22 global native WebSocket
  ws = new WebSocket('wss://chat.kirka.io');

  ws.onopen = () => {
    console.log('[ChatListener] Connected to wss://chat.kirka.io successfully!');
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);

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
  };

  ws.onerror = (error) => {
    console.error('[ChatListener] WebSocket encountered error:', error.message || error);
  };

  ws.onclose = () => {
    console.warn('[ChatListener] WebSocket disconnected. Retrying connection in 5 seconds...');
    ws = null;
    setTimeout(connectWebSocket, 5000);
  };
}
