import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { isOwner, isGuildVip, isPermanentGuild, addGuild, removeGuild, addUser, removeUser, listVip } from '../utils/access.js';
import { syncGuildCommands } from '../register-commands.js';

// Owner only. Registered in the support server alone, hidden from everyone but admins there.
export const data = new SlashCommandBuilder()
  .setName('vipadmin')
  .setDescription('Owner: manage KirkaHub VIP servers and users')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((s) => s.setName('servers').setDescription('Every server the bot is in, with its ID and VIP status'))
  .addSubcommand((s) =>
    s
      .setName('addserver')
      .setDescription('Unlock every command for a server')
      .addStringOption((o) => o.setName('server_id').setDescription('Server ID (see /vipadmin servers)').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Who paid, how much, until when'))
  )
  .addSubcommand((s) =>
    s
      .setName('removeserver')
      .setDescription('Take VIP away from a server')
      .addStringOption((o) => o.setName('server_id').setDescription('Server ID').setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName('adduser')
      .setDescription('Give someone personal VIP (KirkaHub as their own app)')
      .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Who paid, how much, until when'))
  )
  .addSubcommand((s) =>
    s
      .setName('removeuser')
      .setDescription('Take personal VIP away from someone')
      .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
  )
  .addSubcommand((s) => s.setName('list').setDescription('Every VIP server and user'));

export async function execute(interaction) {
  if (!isOwner(interaction.user.id)) {
    return interaction.reply({ content: '⛔ Only the KirkaHub owner can use this.', flags: 64 });
  }
  const sub = interaction.options.getSubcommand();
  const client = interaction.client;
  await interaction.deferReply({ flags: 64 });

  try {
    if (sub === 'servers') {
      const lines = [...client.guilds.cache.values()]
        .sort((a, b) => b.memberCount - a.memberCount)
        .map((g) => `${isGuildVip(g.id) ? '✅' : '🔒'} **${g.name}**: \`${g.id}\` (${g.memberCount} members)`);
      const text = lines.join('\n') || 'The bot is in no servers.';
      return interaction.editReply(text.length > 1900 ? text.slice(0, 1900) + '\n…' : text);
    }

    if (sub === 'addserver' || sub === 'removeserver') {
      const id = interaction.options.getString('server_id', true).trim();
      if (!/^\d{15,25}$/.test(id)) return interaction.editReply('That doesn\'t look like a server ID.');
      const guild = client.guilds.cache.get(id);
      const name = guild?.name || 'a server the bot is not in yet';
      if (sub === 'addserver') {
        const note = interaction.options.getString('note') || '';
        const added = await addGuild(id, `${guild?.name || ''} ${note}`.trim());
        if (guild) await syncGuildCommands(client, id);
        return interaction.editReply(added ? `✅ **${name}** is now VIP.${guild ? ' Its commands are live.' : ' Its commands appear as soon as the bot joins.'}` : `**${name}** was already VIP.`);
      }
      if (isPermanentGuild(id)) return interaction.editReply(`**${name}** has lifetime VIP, set in the bot's code (PERMANENT_GUILDS in src/utils/access.js). Remove it there.`);
      const removed = await removeGuild(id);
      if (guild) await syncGuildCommands(client, id);
      return interaction.editReply(removed ? `🔒 **${name}** is no longer VIP. Only \`/buy\` is left there.` : `**${name}** wasn't VIP.`);
    }

    if (sub === 'adduser' || sub === 'removeuser') {
      const user = interaction.options.getUser('user', true);
      if (sub === 'adduser') {
        const note = interaction.options.getString('note') || '';
        const added = await addUser(user.id, `${user.username} ${note}`.trim());
        return interaction.editReply(added ? `✅ ${user} has personal VIP: KirkaHub works for them anywhere through "Add to my apps".` : `${user} already had personal VIP.`);
      }
      const removed = await removeUser(user.id);
      return interaction.editReply(removed ? `🔒 ${user} no longer has personal VIP.` : `${user} didn't have personal VIP.`);
    }

    if (sub === 'list') {
      const { guilds, users, ready } = listVip();
      const embed = new EmbedBuilder()
        .setColor('#facc15')
        .setTitle('KirkaHub VIP')
        .addFields(
          { name: `Servers (${guilds.length})`, value: guilds.map(([id, v]) => `\`${id}\` ${v.note}`).join('\n').slice(0, 1024) || 'None' },
          { name: `Personal (${users.length})`, value: users.map(([id, v]) => `<@${id}> ${v.note}`).join('\n').slice(0, 1024) || 'None' }
        );
      if (!ready) embed.setFooter({ text: 'Warning: the VIP channel could not be read, so this list may be incomplete.' });
      return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error('[VipAdmin]', err);
    return interaction.editReply(`⚠️ ${err.message}`);
  }
}
