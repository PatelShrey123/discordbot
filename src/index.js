import { Client, GatewayIntentBits, Collection } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';

import { registerCommands } from './register-commands.js';
import { getPublicCatalog, fetchClanLeaderboard } from './api/kirka.js';
import { getBoltPriceMap } from './api/boltPrices.js';
import { initDb } from './api/db.js';
import { startChatListener } from './utils/chatListener.js';
import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as skinCmd from './commands/skin.js';
import * as leaderboardCmd from './commands/leaderboard.js';
import * as hCmd from './commands/h.js';
import * as linkCmd from './commands/link.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing! Please specify DISCORD_TOKEN in .env or Render environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
client.commands.set(profileCmd.data.name, profileCmd);
client.commands.set(inventoryCmd.data.name, inventoryCmd);
client.commands.set(clanCmd.data.name, clanCmd);
client.commands.set(skinCmd.data.name, skinCmd);
client.commands.set(leaderboardCmd.data.name, leaderboardCmd);
client.commands.set(hCmd.data.name, hCmd);
client.commands.set(linkCmd.data.name, linkCmd);

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log(`🌐 Bot active in ${client.guilds.cache.size} server(s).`);

  // Initialize Supabase Database Connection
  await initDb();

  // Initialize Chat WebSocket Listener
  startChatListener(client);

  // Warm up all API caches in background concurrently
  console.log('🔥 Warming up API caches (Google Sheets, Kirka Catalog, Leaderboard)...');
  Promise.all([
    getPublicCatalog(),
    getBoltPriceMap(),
    fetchClanLeaderboard()
  ]).then(() => {
    console.log('✅ API cache warmup complete! Bot is fully primed and ready for instant replies.');
  }).catch(err => {
    console.warn('⚠️ Warning: Cache warmup encountered an error:', err.message);
  });

  // Auto-register slash commands on startup
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing command /${interaction.commandName}:`, error);
    const replyMsg = { content: '⚠️ There was an error while executing this command!', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyMsg);
    } else {
      await interaction.reply(replyMsg);
    }
  }
});

// Start lightweight HTTP server for Render.com health checks
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'online', bot: client.user ? client.user.tag : 'initializing' }));
}).listen(PORT, () => {
  console.log(`📡 Health-check server listening on port ${PORT}`);
});

client.login(token);
