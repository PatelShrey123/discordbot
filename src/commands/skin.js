import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('skin')
  .setDescription('View pricing and details for a Kirka skin or item')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Name of the skin (e.g. Sketch, 1337, Grayscale)')
      .setRequired(true)
  );

const RARITY_COLORS = {
  MYTHICAL: '#ea580c',
  LEGENDARY: '#fbbf24',
  EPIC: '#a855f7',
  RARE: '#3b82f6',
  UNCOMMON: '#10b981',
  COMMON: '#9ca3af'
};

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return Number(num).toLocaleString('en-US');
}

export function createSkinEmbed(matchedItem, priceMap) {
  const rarity = matchedItem.rarity || 'COMMON';
  const color = RARITY_COLORS[rarity.toUpperCase()] || '#9ca3af';

  const typeFormatted = (matchedItem.type || 'ITEM')
    .replace(/_/g, ' ')
    .toUpperCase();

  const parentName = matchedItem.parent?.name || 'None';
  const totalOwned = matchedItem.totalOwned ?? 'N/A';

  // Get price from Bolt Price Map
  const matchedPrice = priceMap[matchedItem.name];
  const baseValue = matchedPrice ? `${formatNumber(matchedPrice.average)}` : 'N/A';

  // Share link
  const shareLink = `https://kirka.io/`;

  const embed = new EmbedBuilder()
    .setTitle(matchedItem.name)
    .setColor(color)
    .addFields(
      { name: 'Type', value: typeFormatted, inline: false },
      { name: 'Rarity', value: rarity.toUpperCase(), inline: false },
      { name: 'Parent Weapon', value: parentName, inline: false },
      { name: 'Total Owned', value: formatNumber(totalOwned), inline: false },
      { name: 'Base Value', value: baseValue, inline: false },
      { name: 'Share Link', value: shareLink, inline: false }
    )
    .setTimestamp();

  // If a render image exists, display it prominently
  if (matchedItem.renderUrl) {
    embed.setImage(matchedItem.renderUrl);
  }

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const searchName = interaction.options.getString('name').trim().toLowerCase();

  const [catalog, priceMap] = await Promise.all([
    getPublicCatalog(),
    getBoltPriceMap()
  ]);

  // Find exact or closest match in catalog
  let matchedItem = catalog.find(item => 
    item.name && item.name.replace(/^_+/, '').trim().toLowerCase() === searchName
  );

  // Partial match fallback
  if (!matchedItem) {
    matchedItem = catalog.find(item => 
      item.name && item.name.toLowerCase().includes(searchName)
    );
  }

  if (!matchedItem) {
    return interaction.editReply({
      content: `❌ Could not find a skin/item matching **${interaction.options.getString('name')}**.`
    });
  }

  try {
    const embed = createSkinEmbed(matchedItem, priceMap);
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (err) {
    console.error('Error executing skin command:', err);
    await interaction.editReply({
      content: `⚠️ Failed to render skin details for **${matchedItem.name}**.`
    });
  }
}
