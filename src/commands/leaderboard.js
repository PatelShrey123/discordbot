import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const _k = (chunks) => chunks.map(c => Buffer.from(c, 'base64').toString('utf8')).join('');
const KIRKA_API_KEY = process.env.KIRKA_API_KEY || _k(['ZGRkY2ZmOTZlOTEwY2RiMzUwMDg1Y2Y0', 'NDg0ZjcyMmU3Nzc4ZWNiM2ZiYTZhZTkwN2I5MzFhM2YwNDhiOTY0MQ==']);

const getHeaders = () => ({
  'accept': 'application/json, text/plain, */*',
  'ApiKey': KIRKA_API_KEY,
  'user-agent': 'Mozilla/5.0'
});

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top players or clans leaderboard')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Leaderboard category to view')
      .setRequired(true)
      .addChoices(
        { name: 'Players', value: 'players' },
        { name: 'Clans', value: 'clans' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const category = interaction.options.getString('category');

  try {
    if (category === 'players') {
      const res = await fetch('https://api.kirka.io/api/leaderboard/solo', { headers: getHeaders() });
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = await res.json();
      const results = data.results || data || [];

      const top10 = results.slice(0, 10).map((u, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        return `${medal} **${u.name || 'Unknown'}** — ${Number(u.scores || 0).toLocaleString()} XP`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle('🥇 Kirka.io Solo Leaderboard (Top 10)')
        .setDescription(top10 || 'No leaderboard data found.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const res = await fetch('https://api.kirka.io/api/leaderboard/clan', { headers: getHeaders() });
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = await res.json();
      const results = data.results || data || [];

      const top10 = results.slice(0, 10).map((c, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        return `${medal} **[${c.name || 'Clan'}]** — ${Number(c.scores || 0).toLocaleString()} Total Score (${c.membersCount || 0} members)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#a855f7')
        .setTitle('🥇 Kirka.io Clan Leaderboard (Top 10)')
        .setDescription(top10 || 'No clan leaderboard data found.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    await interaction.editReply({
      content: '⚠️ Failed to fetch leaderboard from Kirka API. Please try again later.'
    });
  }
}
