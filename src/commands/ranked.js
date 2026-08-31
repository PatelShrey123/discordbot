import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchRankedLeaderboard } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('ranked')
  .setDescription('Display the top 10 players in a Kirka.io ranked matchmaking category')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Ranked Category')
      .setRequired(true)
      .addChoices(
        { name: '💣 Search & Destroy (SAD)', value: 'sad' },
        { name: '⚔️ 1v1 Arena', value: '1v1' },
        { name: '🛡️ 2v2 Arena', value: '2v2' }
      )
  );

function buildRankedEmbed(leaderboardData, category) {
  const catNames = { sad: 'Search & Destroy (SAD)', '1v1': '1v1 Arena', '2v2': '2v2 Arena' };
  const catKey = category.toLowerCase();
  const catTitle = catNames[catKey] || 'Ranked Matchmaking';

  const embed = new EmbedBuilder()
    .setColor('#a855f7')
    .setTitle(`🏆 Kirka.io Ranked Leaderboard: ${catTitle}`)
    .setTimestamp();

  if (!leaderboardData || !leaderboardData.results || leaderboardData.results.length === 0) {
    embed.setDescription('No ranked leaderboard data found for this category.');
    return embed;
  }

  // Format top 10 results
  const top10 = leaderboardData.results.slice(0, 10).map((p, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    
    // Select correct rating value based on category
    let rating = 0;
    if (catKey === 'sad') rating = p.kloSAD;
    else if (catKey === '1v1') rating = p.klo1V1;
    else if (catKey === '2v2') rating = p.klo2V2;

    const formattedRating = Number(rating || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    return `${medal} **${p.name || 'Unknown'}** — \`${formattedRating} KLO\``;
  }).join('\n');

  embed.setDescription(top10);
  
  if (leaderboardData.season) {
    const endStr = leaderboardData.season.endAt 
      ? `⏰ Season ends: <t:${Math.floor(new Date(leaderboardData.season.endAt).getTime() / 1000)}:R>` 
      : '';
    embed.setFooter({ text: `Season: ${leaderboardData.season.name || 'Active'}` });
    if (endStr) {
      embed.setDescription(`${top10}\n\n${endStr}`);
    }
  }

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const category = interaction.options.getString('category');

  try {
    const data = await fetchRankedLeaderboard(category.toUpperCase());
    const embed = buildRankedEmbed(data, category);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing ranked command:', err);
    await interaction.editReply('❌ Failed to retrieve ranked leaderboard. Please try again later.');
  }
}

export async function executePrefix(message, args) {
  const categoryInput = args[0]?.toLowerCase();
  const validCategories = {
    sad: 'SAD',
    '1v1': '1V1',
    '2v2': '2V2',
    snd: 'SAD'
  };
  const category = validCategories[categoryInput];

  if (!category) {
    return message.reply('❌ Please specify a valid category: `.ranked [sad/1v1/2v2]`');
  }

  await message.channel.sendTyping();

  try {
    const data = await fetchRankedLeaderboard(category);
    const embed = buildRankedEmbed(data, categoryInput === 'snd' ? 'sad' : categoryInput);
    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing ranked prefix command:', err);
    await message.reply('⚠️ Failed to retrieve ranked leaderboard.');
  }
}
