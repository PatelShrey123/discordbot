import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPublicCatalog, getAllItemData } from '../api/kirka.js';
import { getBoltPriceMap, formatValueLong } from '../api/boltPrices.js';

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
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

export function createSkinEmbed(matchedItem, priceMap, allItemData) {
  const normalizedName = matchedItem.name.replace(/^_+/, '').trim().toLowerCase();

  // Find metadata from AllItemData.json
  const metadata = allItemData.find(item => 
    item.name && item.name.replace(/^_+/, '').trim().toLowerCase() === normalizedName
  ) || matchedItem;

  const rarity = metadata.rarity || matchedItem.rarity || 'COMMON';
  const color = RARITY_COLORS[rarity.toUpperCase()] || '#9ca3af';

  // Format type nicely (e.g. CHARACTER, WEAPON SKIN)
  let typeFormatted = 'ITEM';
  if (metadata.type === 'BODY_SKIN') {
    typeFormatted = 'CHARACTER';
  } else if (metadata.type === 'WEAPON_SKIN') {
    typeFormatted = 'WEAPON SKIN';
  } else if (metadata.type) {
    typeFormatted = metadata.type.replace(/_/g, ' ');
  }

  const isUnique = metadata.unique !== undefined ? (metadata.unique ? 'YES' : 'NO') : 'NO';

  // Resolve Creator
  const creator = metadata.creator?.name || matchedItem.creator?.name || 'Kirka';

  // Find price and obtainable method from Bolt price sheet
  const typeKey = metadata.type === 'BODY_SKIN' ? 'character' : (metadata.parent?.name || '').toLowerCase();
  const compositeKey = `${normalizedName}_${typeKey}`;
  const boltPriceData = priceMap.get(compositeKey) || priceMap.get(normalizedName);

  // Obtainable Method: check Bolt price sheet first, then characterCard/chest info, then default to N/A
  let obtainableMethod = 'N/A';
  if (boltPriceData && boltPriceData.obtainableBy && boltPriceData.obtainableBy !== 'N/A') {
    obtainableMethod = boltPriceData.obtainableBy;
  } else if (metadata.characterCard?.price) {
    obtainableMethod = `${formatNumber(metadata.characterCard.price)}X 💎`;
  } else if (metadata.chest?.price) {
    obtainableMethod = `${formatNumber(metadata.chest.price)}X 🔑`;
  }

  const totalOwned = metadata.totalOwned ?? matchedItem.totalOwned ?? 0;

  // Format Created date
  const createdDate = metadata.createdAt
    ? new Date(metadata.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : 'May 16, 2025';

  // Bolt Value
  const boltValue = boltPriceData?.baseValue ?? 0;
  const boltValueStr = boltValue > 0 ? formatValueLong(boltValue) : '—';

  // Share link pointing directly to the website routing path
  const shareLink = `https://kirkahub.vercel.app/skin/${encodeURIComponent(matchedItem.name)}`;

  const embed = new EmbedBuilder()
    .setTitle(matchedItem.name.toUpperCase())
    .setColor(color)
    .addFields(
      { name: 'TYPE', value: `\`${typeFormatted}\``, inline: true },
      { name: 'RARITY', value: `\`${rarity.toUpperCase()}\``, inline: true },
      { name: 'UNIQUE', value: `\`${isUnique}\``, inline: true },
      { name: 'CREATOR', value: `\`${creator}\``, inline: true },
      { name: 'OBTAINABLE BY', value: `\`${obtainableMethod}\``, inline: true },
      { name: 'TOTAL OWNED', value: `\`${formatNumber(totalOwned)}\``, inline: true },
      { name: 'CREATED', value: `\`${createdDate}\``, inline: true },
      { name: 'BOLT VALUE', value: `\`${boltValueStr}\``, inline: true },
      { name: 'SHARE LINK', value: shareLink, inline: false }
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

  const [catalog, priceMap, allItemData] = await Promise.all([
    getPublicCatalog(),
    getBoltPriceMap(),
    getAllItemData()
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
    const embed = createSkinEmbed(matchedItem, priceMap, allItemData);

    const web3DUrl = `https://kirkahub.vercel.app/skin/${encodeURIComponent(matchedItem.name.replace(/^_+/, ''))}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🎮 View in 3D (360° Studio)')
        .setStyle(ButtonStyle.Link)
        .setURL(web3DUrl)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (err) {
    console.error('Error executing skin command:', err);
    await interaction.editReply({
      content: `⚠️ Failed to render skin details for **${matchedItem.name}**.`
    });
  }
}
