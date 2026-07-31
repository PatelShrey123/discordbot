import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchClan } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('clan')
  .setDescription('View Kirka clan statistics and top members')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Kirka clan name')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const clanName = interaction.options.getString('name');

  const clan = await fetchClan(clanName);
  if (!clan) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka clan named **${clanName}**.`
    });
  }

  const memberCount = clan.members ? clan.members.length : (clan.memberCount || 0);
  const totalScore = clan.score ? clan.score.toLocaleString() : '0';

  const embed = new EmbedBuilder()
    .setColor('#a855f7')
    .setTitle(`🛡️ Clan: [${clan.name}]`)
    .setDescription(clan.description || 'Official Kirka Competitive Clan')
    .addFields(
      { name: '👑 Leader', value: clan.leaderName || 'N/A', inline: true },
      { name: '👥 Members', value: `${memberCount}`, inline: true },
      { name: '🏆 Total Score', value: totalScore, inline: true }
    )
    .setFooter({ text: 'Kirka Tracker Bot' })
    .setTimestamp();

  if (clan.members && clan.members.length > 0) {
    const top5 = clan.members.slice(0, 5).map((m, idx) => `${idx + 1}. **${m.name}** (Lvl ${m.level || '?'})`).join('\n');
    embed.addFields({ name: '🌟 Top Members', value: top5 });
  }

  await interaction.editReply({ embeds: [embed] });
}
