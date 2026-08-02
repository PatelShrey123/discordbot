import { Client, GatewayIntentBits, Collection } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

import { registerCommands } from './register-commands.js';
import { getPublicCatalog, fetchClanLeaderboard, getAllItemData } from './api/kirka.js';
import { getBoltPriceMap } from './api/boltPrices.js';
import { initDb } from './api/db.js';
import { startChatListener } from './utils/chatListener.js';
import { createSkinEmbed } from './commands/skin.js';

import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as skinCmd from './commands/skin.js';
import * as leaderboardCmd from './commands/leaderboard.js';
import * as hCmd from './commands/h.js';
import * as linkCmd from './commands/link.js';
import * as dbstatusCmd from './commands/dbstatus.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing! Please specify DISCORD_TOKEN in .env or Render environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
client.commands.set(profileCmd.data.name, profileCmd);
client.commands.set(inventoryCmd.data.name, inventoryCmd);
client.commands.set(clanCmd.data.name, clanCmd);
client.commands.set(skinCmd.data.name, skinCmd);
client.commands.set(leaderboardCmd.data.name, leaderboardCmd);
client.commands.set(hCmd.data.name, hCmd);
client.commands.set(linkCmd.data.name, linkCmd);
client.commands.set(dbstatusCmd.data.name, dbstatusCmd);

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log(`🌐 Bot active in ${client.guilds.cache.size} server(s).`);

  // Initialize Supabase Database Connection
  await initDb();

  // Initialize Chat WebSocket Listener
  startChatListener(client);

  // Warm up all API caches in background concurrently
  console.log('🔥 Warming up API caches (Google Sheets, Kirka Catalog, Leaderboard, AllItemData)...');
  Promise.all([
    getPublicCatalog(),
    getBoltPriceMap(),
    fetchClanLeaderboard(),
    getAllItemData()
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
// Support prefix command trigger: .skin [name]
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  console.log(`[MessageReceived] From: ${message.author.tag}, Content: "${content}"`);

  if (content.toLowerCase().startsWith('.skin ')) {
    const searchName = content.substring(6).trim().toLowerCase();
    console.log(`[MessageReceived] Matched .skin! Query: "${searchName}"`);
    if (!searchName) return;

    try {
      const [catalog, priceMap, allItemData] = await Promise.all([
        getPublicCatalog(),
        getBoltPriceMap(),
        getAllItemData()
      ]);

      // Find exact or closest match in catalog
      let matchedItem = catalog.find(item => 
        item.name && item.name.replace(/^_+/, '').trim().toLowerCase() === searchName
      );

      // Partial match fallback
      if (!matchedItem) {
        matchedItem = catalog.find(item => 
          item.name && item.name.toLowerCase().includes(searchName)
        );
      }

      if (!matchedItem) {
        return message.reply(`❌ Could not find a skin/item matching **${content.substring(6).trim()}**.`);
      }

      const embed = createSkinEmbed(matchedItem, priceMap, allItemData);
      await message.reply({
        embeds: [embed]
      });
    } catch (err) {
      console.error('Error in message prefix skin command:', err);
      await message.reply(`⚠️ Failed to retrieve skin details.`);
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
