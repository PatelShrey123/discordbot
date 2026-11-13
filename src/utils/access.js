// KirkaHub VIP access: who may use the bot.
//
// - VIP servers get every command, registered just for that server.
// - The support server gets only the free commands below (plus /buy).
// - Every other server only sees /buy.
// - "Add to my apps" (user install) is sold separately: Discord can't hide those commands per person,
//   so they stay listed and the bot answers with the /buy message unless the user is a VIP user.
//
// The lists live as messages in a private channel of the support server, so they survive restarts
// (the free Render instance loses local files on every deploy). One message per entry:
//   guild:<id> <note>    or    user:<id> <note>
// The owner manages them with /vipadmin; deleting a message there by hand also removes the entry.
import { ChannelType, PermissionFlagsBits } from 'discord.js';

export const SUPPORT_GUILD_ID = process.env.SUPPORT_GUILD_ID || '1545037736543653919';
export const SUPPORT_INVITE = 'https://discord.gg/3zStCadBtP';
export const FREE_IN_SUPPORT = new Set(['profile', 'inventory', 'link', 'unlink']);
/** Commands that run for anyone, anywhere. */
export const ALWAYS_ALLOWED = new Set(['buy']);
/** Owner-only command, registered in the support server alone. */
export const ADMIN_COMMAND = 'vipadmin';

const CHANNEL_NAME = 'kirkahub-vip-access';

const vipGuilds = new Map(); // id -> { note, messageId }
const vipUsers = new Map();
let channel = null;
let ownerIds = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));
let ready = false;

export const isOwner = (userId) => ownerIds.has(userId);
export const ownerMention = () => (ownerIds.size ? `<@${[...ownerIds][0]}>` : 'the KirkaHub owner');
export const isGuildVip = (id) => !!id && vipGuilds.has(id);
export const isUserVip = (id) => !!id && (vipUsers.has(id) || ownerIds.has(id));
export const listVip = () => ({ guilds: [...vipGuilds.entries()], users: [...vipUsers.entries()], ready });

/** Can this user run this command here? */
export function canUse(commandName, userId, guildId) {
  if (ALWAYS_ALLOWED.has(commandName)) return true;
  if (commandName === ADMIN_COMMAND) return isOwner(userId);
  // if the list couldn't be read, don't lock out paying servers: let everyone through and log it
  if (!ready) return true;
  if (isUserVip(userId)) return true;
  if (isGuildVip(guildId)) return true;
  if (guildId === SUPPORT_GUILD_ID && FREE_IN_SUPPORT.has(commandName)) return true;
  return false;
}

function parse(msg) {
  const m = /^(guild|user):(\d{15,25})(?:\s+(.*))?$/s.exec(msg.content.trim());
  if (!m) return;
  (m[1] === 'guild' ? vipGuilds : vipUsers).set(m[2], { note: (m[3] || '').trim(), messageId: msg.id });
}

/** Called once the client is ready: find the owner, find or make the private channel, read the list. */
export async function initAccess(client) {
  try {
    const app = await client.application.fetch();
    if (app.owner?.members) for (const id of app.owner.members.keys()) ownerIds.add(id);
    else if (app.owner?.id) ownerIds.add(app.owner.id);
  } catch (err) {
    console.error('[Access] Could not read the application owner:', err.message);
  }

  const guild = client.guilds.cache.get(SUPPORT_GUILD_ID) || (await client.guilds.fetch(SUPPORT_GUILD_ID).catch(() => null));
  if (!guild) {
    console.error(`[Access] The bot is not in the support server ${SUPPORT_GUILD_ID}: VIP lists can't be stored.`);
    return;
  }
  const channels = await guild.channels.fetch().catch(() => null);
  channel = channels?.find((c) => c && c.type === ChannelType.GuildText && c.name === CHANNEL_NAME) || null;
  if (!channel) {
    try {
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: 'KirkaHub VIP list. One message per VIP server or user. Managed with /vipadmin. Deleting a message removes that VIP.',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
        ],
      });
      console.log(`[Access] Created #${CHANNEL_NAME} in the support server.`);
    } catch (err) {
      console.error(`[Access] Could not create #${CHANNEL_NAME} (give the bot Manage Channels in the support server):`, err.message);
      return;
    }
  }

  // read every entry the bot has written
  let before;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    for (const msg of batch.values()) if (msg.author.id === client.user.id) parse(msg);
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  ready = true;
  console.log(`[Access] ${vipGuilds.size} VIP server(s), ${vipUsers.size} VIP user(s), owner(s): ${[...ownerIds].join(', ') || 'unknown'}`);

  // an entry deleted by hand in the channel is removed too
  client.on('messageDelete', (msg) => {
    if (msg.channelId !== channel?.id) return;
    for (const map of [vipGuilds, vipUsers]) for (const [id, v] of map) if (v.messageId === msg.id) map.delete(id);
  });
}

async function add(map, kind, id, note) {
  if (!channel) throw new Error(`The #${CHANNEL_NAME} channel isn't available, so the change can't be saved.`);
  if (map.has(id)) return false;
  const msg = await channel.send({ content: `${kind}:${id} ${note || ''}`.trim(), allowedMentions: { parse: [] } });
  map.set(id, { note: note || '', messageId: msg.id });
  return true;
}
async function remove(map, id) {
  const entry = map.get(id);
  if (!entry) return false;
  map.delete(id);
  if (channel) await channel.messages.delete(entry.messageId).catch(() => {});
  return true;
}

export const addGuild = (id, note) => add(vipGuilds, 'guild', id, note);
export const removeGuild = (id) => remove(vipGuilds, id);
export const addUser = (id, note) => add(vipUsers, 'user', id, note);
export const removeUser = (id) => remove(vipUsers, id);

/** The message people get when something is locked. */
export function buyMessage({ forUser = false } = {}) {
  return [
    '🔒 **KirkaHub is VIP-only now.**',
    forUser
      ? `Using KirkaHub as a personal app (in any server and in DMs) needs **personal VIP**. DM ${ownerMention()} to get it.`
      : `This server doesn't have KirkaHub VIP yet. DM ${ownerMention()} to unlock every command for this server.`,
    ...(forUser ? [] : [`Want KirkaHub everywhere you go, through "Add to my apps"? That's personal VIP, sold separately. DM ${ownerMention()} as well.`]),
    `You can try \`/profile\` and \`/inventory\` (and \`/link\` your account) for free in the KirkaHub support server: ${SUPPORT_INVITE}`,
  ].join('\n');
}
