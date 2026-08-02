import { saveLinkedAccount } from '../api/db.js';
import WebSocket from 'ws';

// Map of temporary active verification codes: token -> { discordId }
export const pendingLinks = new Map();

const REGIONS = [
  { name: 'EU', url: 'wss://chat-eu.kirka.io' },
  { name: 'US', url: 'wss://chat-us.kirka.io' },
  { name: 'AS', url: 'wss://chat-as.kirka.io' }
];

let clientInstance = null;

export function startChatListener(client) {
  clientInstance = client;
  REGIONS.forEach(region => {
    connectRegionWebSocket(region);
  });
}

function connectRegionWebSocket(region) {
  console.log(`[ChatListener] Connecting to Kirka ${region.name} Chat WebSocket (${region.url})...`);
  
  const ws = new WebSocket(region.url);

  ws.on('open', () => {
    console.log(`[ChatListener] Connected to Kirka ${region.name} WebSocket successfully!`);
  });

  ws.on('message', async (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // type 2 is general user chat messages in the Kirka server lobby
      if (data.type === 2 && data.user && typeof data.message === 'string') {
        const text = data.message.trim();

        // Check if the chat message matches a pending verification token
        if (pendingLinks.has(text)) {
          const { discordId } = pendingLinks.get(text);
          const kirkaUser = data.user; // { id, shortId, name }

          console.log(`[ChatListener] Verification matched on ${region.name}! Discord User: ${discordId} -> Kirka: ${kirkaUser.name} (#${kirkaUser.shortId})`);

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
    console.warn(`[ChatListener] WebSocket ${region.name} disconnected. Retrying in 5 seconds...`);
    setTimeout(() => connectRegionWebSocket(region), 5000);
  });
}
