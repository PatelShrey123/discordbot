import { 
  SlashCommandBuilder, 
  AttachmentBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { fetchClan } from '../api/kirka.js';
import { renderClanRosterPage } from '../canvas/clanRoster.js';

const KIRKA_API_KEY = process.env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060';

const getHeaders = () => ({
  'accept': 'application/json, text/plain, */*',
  'ApiKey': KIRKA_API_KEY,
  'user-agent': 'Mozilla/5.0'
});

export const data = new SlashCommandBuilder()
  .setName('clan')
  .setDescription('View Kirka clan statistics and roster')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Kirka clan name')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const queryClan = interaction.options.getString('name');

  // 1. Fetch Clan details
  const clan = await fetchClan(queryClan);
  if (!clan) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka clan named **${queryClan}**.`
    });
  }

  // 2. Fetch Leaderboard Rank
  let rank = 0;
  try {
    const lbRes = await fetch('https://api.kirka.io/api/leaderboard/clan', { headers: getHeaders() });
    if (lbRes.ok) {
      const lbData = await lbRes.json();
      const results = lbData.results || lbData || [];
      const idx = results.findIndex(c => c.name && c.name.toLowerCase() === clan.name.toLowerCase());
      if (idx !== -1) {
        rank = idx + 1;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch clan rank:', err.message);
  }

  const members = clan.members || [];
  const leaders = members.filter(m => m.role === 'LEADER');
  const officers = members.filter(m => m.role === 'OFFICER');
  const newbies = members.filter(m => m.role === 'NEWBIE');

  const leaderName = leaders.length > 0 ? (leaders[0].user?.name || 'Unknown') : 'Unknown';

  // Compute total elements to determine total pages
  const totalElements = 
    (leaders.length > 0 ? 1 : 0) + leaders.length +
    (officers.length > 0 ? 1 : 0) + officers.length +
    (newbies.length > 0 ? 1 : 0) + newbies.length;

  let totalPages = 1;
  if (totalElements > 25) {
    totalPages = 1 + Math.ceil((totalElements - 25) / 30);
  }

  let currentPage = 0;

  // Render Page function
  const createPageMessage = async (pageIdx) => {
    const cardBuffer = await renderClanRosterPage(clan, rank, pageIdx, totalPages);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'clan-roster.png' });

    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle(`🛡️ Clan: ${clan.name}`)
      .setDescription(clan.description || '*No clan description set.*')
      .addFields(
        { name: 'Clan Name', value: `\`${clan.name}\``, inline: true },
        { name: 'Score', value: `\`${(clan.allScores || 0).toLocaleString()}\``, inline: true },
        { name: 'Members', value: `\`${members.length}\``, inline: true },
        { name: 'Leader', value: `\`${leaderName}\``, inline: true }
      );

    if (clan.discordLink) {
      embed.addFields({ name: 'Clan Discord', value: `[Clan Discord](${clan.discordLink})`, inline: true });
    }

    embed.setImage('attachment://clan-roster.png');

    // Create Action Buttons Row
    const row = new ActionRowBuilder();

    const prevButton = new ButtonBuilder()
      .setCustomId('clan_prev')
      .setLabel('Prev Page')
      .setStyle(ButtonStyle.Success)
      .setDisabled(pageIdx === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId('clan_next')
      .setLabel('Next Page')
      .setStyle(ButtonStyle.Success)
      .setDisabled(pageIdx === totalPages - 1);

    const trackerButton = new ButtonBuilder()
      .setLabel('Clan Tracker')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kirka.io/clan/${encodeURIComponent(clan.name)}`);

    row.addComponents(prevButton, nextButton, trackerButton);

    return { embeds: [embed], files: [attachment], components: totalPages > 1 ? [row] : [] };
  };

  const initialPayload = await createPageMessage(currentPage);
  const response = await interaction.editReply(initialPayload);

  // Setup Button Component Collector if paginated
  if (totalPages > 1) {
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 180000 // Keep active for 3 minutes
    });

    collector.on('collect', async (btnInteraction) => {
      // Ensure only the original command caller can paginate
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({
          content: '❌ Only the user who ran the command can change pages.',
          flags: 64
        });
      }

      await btnInteraction.deferUpdate();

      if (btnInteraction.customId === 'clan_prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (btnInteraction.customId === 'clan_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const nextPayload = await createPageMessage(currentPage);
      await interaction.editReply(nextPayload);
    });

    collector.on('end', async () => {
      // Disable buttons upon expiration
      try {
        const expiredPayload = await createPageMessage(currentPage);
        if (expiredPayload.components.length > 0) {
          expiredPayload.components[0].components.forEach(btn => btn.setDisabled(true));
          await interaction.editReply({ components: expiredPayload.components });
        }
      } catch (err) {
        console.warn('Failed to disable buttons on collector end:', err.message);
      }
    });
  }
}
