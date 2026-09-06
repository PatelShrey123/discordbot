import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getSkinOwners } from '../api/ownerIndexer.js';
import { getPublicCatalog } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('locate')
  .setDescription('Find all tracked owners and copy counts of a Kirka skin or item')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Name of the skin to locate (e.g. 2026, Imperial, Solitude, Sketch)')
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

const ITEMS_PER_PAGE = 10;

/**
 * Builds the monospace table for a specific page of owners
 */
function renderOwnersTable(owners, page, totalPages) {
  const start = page * ITEMS_PER_PAGE;
  const pageOwners = owners.slice(start, start + ITEMS_PER_PAGE);

  if (pageOwners.length === 0) {
    return 'No owners cached in database yet.\nAs players link accounts and search profiles, their items will appear here!';
  }

  // Column headers
  // Player#ID (max ~28 chars) | Count (5 chars) | Linked (6 chars)
  let table = 'Player#ID                        Count  Linked\n';
  table += '──────────────────────────────────────────────\n';

  for (const owner of pageOwners) {
    const handle = owner.shortId ? `${owner.name}#${owner.shortId}` : owner.name;
    const truncatedHandle = handle.length > 30 ? handle.slice(0, 27) + '...' : handle;
    const handlePadded = truncatedHandle.padEnd(31, ' ');
    const countPadded = String(owner.count).padStart(5, ' ');
    const linkedIcon = owner.isLinked ? '  ✅' : '  ❌';

    table += `${handlePadded}${countPadded}${linkedIcon}\n`;
  }

  return `\`\`\`text\n${table}\`\`\``;
}

export async function execute(interaction) {
  await interaction.deferReply();

  const query = interaction.options.getString('name');
  if (!query) {
    return interaction.editReply({ content: '❌ Please provide a skin name to locate.' });
  }

  try {
    const result = await getSkinOwners(query);
    const { item, skinName, totalOwned, cachedTotalCopies, owners } = result;

    const rarity = (item?.rarity || 'MYTHICAL').toUpperCase();
    const color = RARITY_COLORS[rarity] || '#d4af37';
    const totalPages = Math.max(1, Math.ceil(owners.length / ITEMS_PER_PAGE));
    let currentPage = 0;

    const buildEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setTitle(`Owners of ${skinName}`)
        .setColor(color)
        .setDescription(renderOwnersTable(owners, page, totalPages))
        .setFooter({
          text: `Page ${page + 1} of ${totalPages} • Cached/Total: ${cachedTotalCopies}/${totalOwned}\nCached data may be inaccurate`
        });

      if (item?.renderUrl) {
        embed.setThumbnail(item.renderUrl);
      }

      return embed;
    };

    const buildButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Prev Page')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page >= totalPages - 1)
      );
    };

    const response = await interaction.editReply({
      embeds: [buildEmbed(currentPage)],
      components: totalPages > 1 ? [buildButtons(currentPage)] : []
    });

    if (totalPages <= 1) return;

    // Interactive button collector for pagination
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000 // 2 minutes interaction window
    });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({
          content: '❌ Only the user who ran this command can flip pages.',
          ephemeral: true
        });
      }

      if (btnInteraction.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (btnInteraction.customId === 'next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await btnInteraction.update({
        embeds: [buildEmbed(currentPage)],
        components: [buildButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      try {
        const disabledButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev').setLabel('Prev Page').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('next').setLabel('Next Page').setStyle(ButtonStyle.Success).setDisabled(true)
        );
        await interaction.editReply({ components: [disabledButtons] });
      } catch {
        // Message might have been deleted
      }
    });

  } catch (err) {
    console.error('[Command: /locate] Error:', err);
    return interaction.editReply({
      content: `⚠️ Failed to search owners for **${query}**. Please try again.`
    });
  }
}

export async function executePrefix(message, args) {
  const query = args.join(' ').trim();
  if (!query) {
    return message.reply('❌ Please provide a skin name to locate (e.g. `.locate 2026` or `.locate Imperial`).');
  }

  await message.channel.sendTyping();

  try {
    const result = await getSkinOwners(query);
    const { item, skinName, totalOwned, cachedTotalCopies, owners } = result;

    const rarity = (item?.rarity || 'MYTHICAL').toUpperCase();
    const color = RARITY_COLORS[rarity] || '#d4af37';
    const totalPages = Math.max(1, Math.ceil(owners.length / ITEMS_PER_PAGE));
    let currentPage = 0;

    const buildEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setTitle(`Owners of ${skinName}`)
        .setColor(color)
        .setDescription(renderOwnersTable(owners, page, totalPages))
        .setFooter({
          text: `Page ${page + 1} of ${totalPages} • Cached/Total: ${cachedTotalCopies}/${totalOwned}\nCached data may be inaccurate`
        });

      if (item?.renderUrl) {
        embed.setThumbnail(item.renderUrl);
      }

      return embed;
    };

    const buildButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Prev Page')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page >= totalPages - 1)
      );
    };

    const response = await message.reply({
      embeds: [buildEmbed(currentPage)],
      components: totalPages > 1 ? [buildButtons(currentPage)] : []
    });

    if (totalPages <= 1) return;

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== message.author.id) {
        return btnInteraction.reply({
          content: '❌ Only the user who ran this command can flip pages.',
          ephemeral: true
        });
      }

      if (btnInteraction.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (btnInteraction.customId === 'next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await btnInteraction.update({
        embeds: [buildEmbed(currentPage)],
        components: [buildButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      try {
        const disabledButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev').setLabel('Prev Page').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('next').setLabel('Next Page').setStyle(ButtonStyle.Success).setDisabled(true)
        );
        await response.edit({ components: [disabledButtons] });
      } catch {
        // Message might have been deleted
      }
    });

  } catch (err) {
    console.error('[Command: .locate] Error:', err);
    return message.reply(`⚠️ Failed to search owners for **${query}**. Please try again.`);
  }
}

