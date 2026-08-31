import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchClan } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('clanactivity')
  .setDescription('Check monthly XP contribution and find inactive members in a Kirka clan')
  .addStringOption(option =>
    option.setName('clan')
      .setDescription('Name of the clan to check')
      .setRequired(true)
  );

function buildClanActivityEmbed(clan) {
  const embed = new EmbedBuilder()
    .setColor('#0ea5e9')
    .setTitle(`📊 Clan Activity Report: [${clan.name.toUpperCase()}]`)
    .setTimestamp();

  if (!clan || !clan.members || clan.members.length === 0) {
    embed.setDescription('No member data found for this clan.');
    return embed;
  }

  const members = clan.members;
  const activeMembers = members.filter(m => m.monthScores > 0);
  const inactiveMembers = members.filter(m => m.monthScores === 0);

  // Sort inactive members by level/name
  inactiveMembers.sort((a, b) => (b.user?.level || 0) - (a.user?.level || 0));
  // Sort active members by score contribution
  activeMembers.sort((a, b) => b.monthScores - a.monthScores);

  const activeCount = activeMembers.length;
  const inactiveCount = inactiveMembers.length;
  const totalCount = members.length;
  
  const activePct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  embed.setDescription(
    `📝 **Description:** *"${clan.description || 'No description'}"*\n\n` +
    `📈 **Activity Summary:**\n` +
    `• **Roster Fill:** \`${totalCount} / 25\` members\n` +
    `• **Active (Gained XP):** \`${activeCount} (${activePct}%)\`\n` +
    `• **Inactive (0 XP):** \`${inactiveCount} (${100 - activePct}%)\`\n` +
    `• **Monthly Clan War Score:** \`${Number(clan.monthScores || 0).toLocaleString()} XP\`\n` +
    `• **Leaderboard Position:** \`#${clan.currentClanWarPosition || 'Unranked'}\``
  );

  // 1. List Inactive Members (Red-alert list for owners to kick)
  if (inactiveCount > 0) {
    const inactiveList = inactiveMembers.map(m => 
      `• **${m.user.name}** (Lvl ${m.user.level}) — *Joined: ${new Date(m.createdAt).toLocaleDateString()}*`
    ).slice(0, 15).join('\n'); // limit to first 15 to avoid embed text limits
    
    embed.addFields({
      name: `🚨 Inactive Roster Check (${inactiveCount} players at 0 XP)`,
      value: inactiveList + (inactiveCount > 15 ? `\n*...and ${inactiveCount - 15} more*` : '')
    });
  } else {
    embed.addFields({
      name: '🚨 Inactive Roster Check',
      value: '✅ 100% of clan members are active this month! Amazing!'
    });
  }

  // 2. List Top 3 Contributors
  if (activeCount > 0) {
    const top3List = activeMembers.slice(0, 3).map((m, idx) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `${medals[idx]} **${m.user.name}** — +${Number(m.monthScores).toLocaleString()} XP`;
    }).join('\n');

    embed.addFields({
      name: '🏆 Top Monthly Contributors',
      value: top3List
    });
  }

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const clanName = interaction.options.getString('clan');

  try {
    const clan = await fetchClan(clanName);
    if (!clan) {
      return interaction.editReply(`❌ Could not find a Kirka clan named **${clanName}**.`);
    }
    const embed = buildClanActivityEmbed(clan);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing clanactivity command:', err);
    await interaction.editReply('❌ Failed to retrieve clan activity details. Please try again later.');
  }
}

export async function executePrefix(message, args) {
  const clanName = args.join(' ').trim();
  if (!clanName) {
    return message.reply('❌ Please specify a clan name: `.clanactivity [name]`');
  }

  await message.channel.sendTyping();

  try {
    const clan = await fetchClan(clanName);
    if (!clan) {
      return message.reply(`❌ Could not find a Kirka clan named **${clanName}**.`);
    }
    const embed = buildClanActivityEmbed(clan);
    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing clanactivity prefix command:', err);
    await message.reply('⚠️ Failed to retrieve clan activity details.');
  }
}
