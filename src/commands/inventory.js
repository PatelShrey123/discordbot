import { 
  SlashCommandBuilder, 
  AttachmentBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { fetchUserProfile, fetchUserInventory } from '../api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong, formatValueShort } from '../api/boltPrices.js';
import { renderInventoryGridPage } from '../canvas/inventoryGrid.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View a Kirka player inventory with Bolt market valuations')
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username or player ID')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('user');

  // 1. Fetch Profile & Inventory
  const profile = await fetchUserProfile(query);
  if (!profile) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka player matching **${query}**.`
    });
  }

  const inventory = await fetchUserInventory(profile.id);
  if (!inventory || inventory.length === 0) {
    return interaction.editReply({
      content: `📦 **${profile.name}** has no items in their Kirka inventory.`
    });
  }

  // 2. Load Bolt Prices & Compute Total Valuation
  const priceMap = await getBoltPriceMap();

  let totalValue = 0;
  let totalSkinsCount = 0;

  inventory.forEach(invItem => {
    const item = invItem.item || invItem;
    const qty = invItem.amount || 1;
    const p = getItemPrice(priceMap, item);
    totalValue += p * qty;
    totalSkinsCount += qty;
  });

  const uniqueSkinsCount = inventory.length;

  // 3. Sort items by Bolt valuation (highest price first)
  const sortedInventory = [...inventory].sort((a, b) => {
    const pA = getItemPrice(priceMap, a.item || a);
    const pB = getItemPrice(priceMap, b.item || b);
    return pB - pA;
  });

  const itemsPerPage = 25; // 5x5 grid
  const totalPages = Math.ceil(sortedInventory.length / itemsPerPage);

  // 4. Render initial page (Page 0)
  const renderPage = async (pageIdx) => {
    const start = pageIdx * itemsPerPage;
    const pageItems = sortedInventory.slice(start, start + itemsPerPage);

    const imageBuffer = await renderInventoryGridPage({
      items: sortedInventory,
      pageItems,
      priceMap,
      pageIndex: pageIdx,
      totalPages,
      username: profile.name
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: `inventory-page-${pageIdx + 1}.png` });

    // Embed matching Image 1 layout exactly
    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setDescription(
        '```text\n' +
        `• Skins Count:     ${totalSkinsCount.toLocaleString()} (${uniqueSkinsCount} unique)\n` +
        `• Inventory Value: ${formatValueLong(totalValue)}\n` +
        '```'
      )
      .setImage(`attachment://inventory-page-${pageIdx + 1}.png`)
      .setFooter({
        text: `Page ${pageIdx + 1} of ${totalPages} • ${profile.name}#${(profile.id || '').substring(0, 6).toUpperCase()}`
      });

    // Buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`prev_${pageIdx}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx === 0),
      new ButtonBuilder()
        .setCustomId(`next_${pageIdx}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx >= totalPages - 1)
    );

    return { embed, attachment, row };
  };

  let currentPage = 0;
  const initialData = await renderPage(currentPage);

  const message = await interaction.editReply({
    embeds: [initialData.embed],
    files: [initialData.attachment],
    components: totalPages > 1 ? [initialData.row] : []
  });

  if (totalPages <= 1) return;

  // 5. Interactive Collector for ◀ ▶ Pagination
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000 // 2 minutes active pagination time
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: '⚠️ Only the command user can control pagination buttons.', flags: 64 });
    }

    await i.deferUpdate();

    if (i.customId.startsWith('prev_')) {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId.startsWith('next_')) {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    const newPageData = await renderPage(currentPage);

    await interaction.editReply({
      embeds: [newPageData.embed],
      files: [newPageData.attachment],
      components: [newPageData.row]
    });
  });

  collector.on('end', () => {
    // Disable buttons on timeout
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev_dis').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('next_dis').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
    interaction.editReply({ components: [disabledRow] }).catch(() => {});
  });
}
