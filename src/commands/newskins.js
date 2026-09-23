import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('newskins')
  .setDescription('Detect newly dropped skins in Kirka that are missing from your Google Sheet')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const [catalog, priceMap] = await Promise.all([
      getPublicCatalog(),
      getBoltPriceMap()
    ]);

    const unlisted = [];
    for (const item of catalog) {
      if (!item.name) continue;
      const clean = item.name.replace(/^_+/, '').trim().toLowerCase();
      const typeKey = (item.type === 'BODY_SKIN' ? 'character' : (item.parent?.name || '')).toLowerCase();
      const compositeKey = clean + '_' + typeKey;
      if (!priceMap.has(compositeKey) && !priceMap.has(clean)) {
        unlisted.push(item);
      }
    }

    unlisted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const top8 = unlisted.slice(0, 8);
    const fields = top8.map((item, idx) => {
      const type = item.type === 'BODY_SKIN' ? 'Character' : (item.parent?.name || 'Weapon');
      return `**${idx + 1}. ${item.name}** (\`${type}\` • \`${item.rarity || 'COMMON'}\`)\n> 📋 Sheet Row: \`${item.name},${type},${item.rarity || 'Common'},TBD,New Drop\``;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🆕 NEW / UNLISTED SKINS DETECTOR')
      .setColor('#f59e0b')
      .setDescription(`Found **${unlisted.length}** skins in Kirka's database not yet listed in your Google Sheet.\nHere are the latest ones you can add:`)
      .addFields({ name: 'LATEST NEW DROPS (READY FOR YOUR SHEET)', value: fields || 'None! All skins are listed.' })
      .setFooter({ text: 'Tip: Copy the row format above and paste it into the bottom of your Google Sheet!' });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[NewSkins] Error:', err);
    await interaction.editReply({ content: `❌ Failed to scan new skins: ${err.message}` });
  }
}
