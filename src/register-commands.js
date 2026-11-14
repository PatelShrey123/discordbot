import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as skinCmd from './commands/skin.js';
import * as leaderboardCmd from './commands/leaderboard.js';
import * as hCmd from './commands/h.js';
import * as linkCmd from './commands/link.js';
import * as dbstatusCmd from './commands/dbstatus.js';
import * as unlinkCmd from './commands/unlink.js';
import * as botnameCmd from './commands/botname.js';
import * as botavatarCmd from './commands/botavatar.js';
import * as questsCmd from './commands/quests.js';
import * as rankedCmd from './commands/ranked.js';
import * as tradeCmd from './commands/trade.js';
import * as unboxCmd from './commands/unbox.js';
import * as weaponCmd from './commands/weapon.js';
import * as serversCmd from './commands/servers.js';
import * as storeCmd from './commands/store.js';
import * as storeupdateCmd from './commands/storeupdate.js';
import * as eventsCmd from './commands/events.js';
import * as helpCmd from './commands/help.js';
import * as supportCmd from './commands/support.js';
import * as suggestCmd from './commands/suggest.js';
import * as donateCmd from './commands/donate.js';
import * as fitCmd from './commands/fit.js';
import * as vipCmd from './commands/vip.js';
import * as flipCmd from './commands/flip.js';
import * as chatCmd from './commands/chat.js';
import * as refreshpricesCmd from './commands/refreshprices.js';
import * as newskinsCmd from './commands/newskins.js';
import * as pricelogCmd from './commands/pricelog.js';
import * as textureCmd from './commands/texture.js';
import * as buyCmd from './commands/buy.js';
import * as vipadminCmd from './commands/vipadmin.js';
import * as skineditorCmd from './commands/skineditor.js';
import { isGuildVip, SUPPORT_GUILD_ID, FREE_IN_SUPPORT } from './utils/access.js';

dotenv.config();

// Every regular command (not /buy or /vipadmin). Built lazily: vipadmin imports this file back.
const regular = () => [
  helpCmd,
  profileCmd,
  inventoryCmd,
  clanCmd,
  skinCmd,
  leaderboardCmd,
  hCmd,
  linkCmd,
  dbstatusCmd,
  unlinkCmd,
  botnameCmd,
  botavatarCmd,
  questsCmd,
  rankedCmd,
  tradeCmd,
  unboxCmd,
  weaponCmd,
  serversCmd,
  storeCmd,
  storeupdateCmd,
  eventsCmd,
  supportCmd,
  suggestCmd,
  donateCmd,
  fitCmd,
  vipCmd,
  flipCmd,
  chatCmd,
  refreshpricesCmd,
  newskinsCmd,
  pricelogCmd,
  textureCmd,
  skineditorCmd
];

// Server installs: a copy of a command for one server (per-server commands carry no install settings)
const forGuild = (json) => {
  const { integration_types, contexts, ...rest } = json;
  return rest;
};
// "Add to my apps": a copy that only exists for people who added the app to their account
const forUser = (json) => ({ ...json, integration_types: [1], contexts: [0, 1, 2] });

let restClient = null;
let appId = null;
async function rest() {
  if (restClient) return { rest: restClient, appId };
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is missing in environment variables!');
  restClient = new REST({ version: '10' }).setToken(token);
  appId = (await restClient.get(Routes.user())).id;
  return { rest: restClient, appId };
}

/**
 * Global commands: /buy everywhere, plus every command as a personal-app ("Add to my apps") command.
 * Servers get their commands separately, per server, from syncGuildCommands.
 */
export async function registerCommands() {
  try {
    const { rest: r, appId: id } = await rest();
    const body = [buyCmd.data.toJSON(), ...regular().map((c) => forUser(c.data.toJSON()))];
    // Once Activities are on, Discord adds an Entry Point ("Launch") command, and a bulk update that leaves it
    // out is refused. Keep it, with the bot handling it (APP_HANDLER) so the VIP check applies to it too.
    const existing = await r.get(Routes.applicationCommands(id)).catch(() => []);
    const entry = existing.find((c) => c.type === 4);
    if (entry) {
      body.push({
        name: entry.name,
        description: 'Open the live Skin Editor: everyone can join, watch and paint the same skin',
        type: 4,
        handler: 1,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
      });
    }
    await r.put(Routes.applicationCommands(id), { body });
    console.log(`✅ Registered ${body.length} global commands (/buy + personal-app commands) for ${id}`);
  } catch (error) {
    console.error('❌ Failed to register global slash commands:', error);
  }
}

/** What one server gets: everything if VIP, the free commands in the support server, otherwise nothing. */
export async function syncGuildCommands(client, guildId) {
  const { rest: r, appId: id } = await rest();
  let body = [];
  if (isGuildVip(guildId)) body = regular().map((c) => forGuild(c.data.toJSON()));
  else if (guildId === SUPPORT_GUILD_ID) body = regular().filter((c) => FREE_IN_SUPPORT.has(c.data.name)).map((c) => forGuild(c.data.toJSON()));
  if (guildId === SUPPORT_GUILD_ID) body.push(vipadminCmd.data.toJSON());
  await r.put(Routes.applicationGuildCommands(id, guildId), { body });
  return body.length;
}

/** Every server the bot is in, one after another. */
export async function syncAllGuilds(client) {
  let vip = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const n = await syncGuildCommands(client, guild.id);
      if (isGuildVip(guild.id)) vip++;
      if (n) console.log(`[Commands] ${guild.name}: ${n} command(s)`);
    } catch (err) {
      console.warn(`[Commands] Could not set commands for ${guild.name} (${guild.id}):`, err.message);
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  console.log(`✅ Server commands synced: ${vip} VIP server(s) of ${client.guilds.cache.size}`);
}

// Allow direct script execution: `node src/register-commands.js` (global commands only; servers sync when the bot starts)
if (process.argv[1] && process.argv[1].endsWith('register-commands.js')) {
  registerCommands();
}
