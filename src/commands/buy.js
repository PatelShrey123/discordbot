import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ownerMention, SUPPORT_INVITE } from '../utils/access.js';

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Get KirkaHub VIP: every command for your server, or as your personal app')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#facc15')
    .setTitle('🔑 Get KirkaHub VIP')
    .setDescription(
      [
        'KirkaHub is a **VIP-only** bot. VIP unlocks every command: profiles, inventories with Hub values, skin prices, trades, the store and drop alerts, leaderboards, clans, quests, `/fit`, `/unbox` and every new command.',
        '',
        `**DM ${ownerMention()} to buy.**`,
      ].join('\n')
    )
    .addFields(
      { name: '🏠 Server VIP', value: 'Every command for everyone in one server.', inline: true },
      { name: '📱 Personal VIP', value: 'KirkaHub as your own app ("Add to my apps"), in any server and in DMs. Sold separately.', inline: true },
      { name: '🆓 Try it first', value: `\`/profile\` and \`/inventory\` are free in the support server: ${SUPPORT_INVITE}` }
    );
  await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
