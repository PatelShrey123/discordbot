import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as compareCmd from './commands/compare.js';
import * as skinCmd from './commands/skin.js';
import * as leaderboardCmd from './commands/leaderboard.js';

dotenv.config();

const commands = [
  profileCmd.data.toJSON(),
  inventoryCmd.data.toJSON(),
  clanCmd.data.toJSON(),
  compareCmd.data.toJSON(),
  skinCmd.data.toJSON(),
  leaderboardCmd.data.toJSON()
];

export async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN is missing in environment variables!');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Registering global Discord slash commands...');
    // Fetch current user bot ID
    const botUser = await rest.get(Routes.user());
    const clientId = botUser.id;

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log(`✅ Successfully registered ${commands.length} global slash commands for Client ID: ${clientId}`);
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

// Allow direct script execution: `node src/register-commands.js`
if (process.argv[1] && process.argv[1].endsWith('register-commands.js')) {
  registerCommands();
}
