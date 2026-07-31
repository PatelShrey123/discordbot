import { Client, GatewayIntentBits, Collection } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';

import { registerCommands } from './register-commands.js';
import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as compareCmd from './commands/compare.js';

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
client.commands.set(compareCmd.data.name, compareCmd);

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log(`🌐 Bot active in ${client.guilds.cache.size} server(s).`);

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
