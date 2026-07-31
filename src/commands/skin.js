import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap } from '../api/boltPrices.js';
import { renderSkinCard } from '../canvas/skinCard.js';

export const data = new SlashCommandBuilder()
  .setName('skin')
  .setDescription('View pricing and render details for a Kirka skin or item')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Name of the skin (e.g. Grayscale, Gazer, Imperial)')
      .setRequired(true)
  );

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
    const cardBuffer = await renderSkinCard(matchedItem, priceMap);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'skin-card.png' });

    await interaction.editReply({
      files: [attachment]
    });
  } catch (err) {
    console.error('Error executing skin command:', err);
    await interaction.editReply({
      content: `⚠️ Failed to render skin card for **${matchedItem.name}**.`
    });
  }
}
