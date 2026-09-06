import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong, formatValueShort } from '../api/boltPrices.js';

export const CHESTS = {
  wood: {
    key: 'wood',
    name: 'Wood Chest',
    icon: '🪵',
    color: 0x8D6E63,
    renderUrl: 'https://kirka.io/assets/img/__chest-1__.2fe7c327.webp',
    cost: '50 Coins',
    weights: [
      { rarity: 'COMMON', weight: 65 },
      { rarity: 'RARE', weight: 23 },
      { rarity: 'EPIC', weight: 9 },
      { rarity: 'LEGENDARY', weight: 3 }
    ]
  },
  ice: {
    key: 'ice',
    name: 'Ice Chest',
    icon: '❄️',
    color: 0x29B6F6,
    renderUrl: 'https://kirka.io/assets/img/__chest-2__.2de0a07c.webp',
    cost: '150 Coins',
    weights: [
      { rarity: 'RARE', weight: 50 },
      { rarity: 'EPIC', weight: 35 },
      { rarity: 'LEGENDARY', weight: 12 },
      { rarity: 'MYTHICAL', weight: 3 }
    ]
  },
  golden: {
    key: 'golden',
    name: 'Golden Chest',
    icon: '👑',
    color: 0xF1C40F,
    renderUrl: 'https://kirka.io/assets/img/__chest-3__.ea3b713c.webp',
    cost: '300 Coins',
    weights: [
      { rarity: 'EPIC', weight: 45 },
      { rarity: 'LEGENDARY', weight: 40 },
      { rarity: 'MYTHICAL', weight: 13 },
      { rarity: 'PARANORMAL', weight: 2 }
    ]
  },
  halloween: {
    key: 'halloween',
    name: 'Halloween Chest',
    icon: '🎃',
    color: 0xE67E22,
    renderUrl: 'https://kirka.io/assets/img/__chest-halloween-large__.b777522a.webp',
    cost: 'Event Chest',
    weights: [
      { rarity: 'EPIC', weight: 30 },
      { rarity: 'LEGENDARY', weight: 45 },
      { rarity: 'MYTHICAL', weight: 20 },
      { rarity: 'PARANORMAL', weight: 5 }
    ]
  },
  christmas: {
    key: 'christmas',
    name: 'Christmas Chest',
    icon: '🎄',
    color: 0x27AE60,
    renderUrl: 'https://kirka.io/assets/img/__chest-christmas__.ccea4ad0.png',
    cost: 'Event Chest',
    weights: [
      { rarity: 'RARE', weight: 35 },
      { rarity: 'EPIC', weight: 40 },
      { rarity: 'LEGENDARY', weight: 20 },
      { rarity: 'MYTHICAL', weight: 5 }
    ]
  }
};

export const RARITY_META = {
  COMMON: { label: 'Common', emoji: '⚪', color: 0xBDC3C7 },
  RARE: { label: 'Rare', emoji: '🔵', color: 0x3498DB },
  EPIC: { label: 'Epic', emoji: '🟣', color: 0x9B59B6 },
  LEGENDARY: { label: 'Legendary', emoji: '🟡', color: 0xF1C40F },
  MYTHICAL: { label: 'Mythical', emoji: '🔴', color: 0xE74C3C },
  PARANORMAL: { label: 'Paranormal', emoji: '💎', color: 0x00E5FF }
};

export const data = new SlashCommandBuilder()
  .setName('unbox')
  .setDescription('Simulate opening official Kirka chests and test your luck!')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('chest')
      .setDescription('Choose a Kirka chest to open')
      .setRequired(false)
      .addChoices(
        { name: '🪵 Wood Chest (50 Coins)', value: 'wood' },
        { name: '❄️ Ice Chest (150 Coins)', value: 'ice' },
        { name: '👑 Golden Chest (300 Coins)', value: 'golden' },
        { name: '🎃 Halloween Chest (Limited)', value: 'halloween' },
        { name: '🎄 Christmas Chest (Limited)', value: 'christmas' }
      )
  );

export function rollSkin(chestKey, catalog) {
  const chest = CHESTS[chestKey] || CHESTS.wood;
  const items = catalog.filter(i => i.type !== 'CHEST' && i.name && i.renderUrl);

  const totalWeight = chest.weights.reduce((sum, w) => sum + w.weight, 0);
  let rand = Math.random() * totalWeight;
  let targetRarity = chest.weights[0].rarity;

  for (const w of chest.weights) {
    if (rand < w.weight) {
      targetRarity = w.rarity;
      break;
    }
    rand -= w.weight;
  }

  // Filter items matching rarity
  let pool = items.filter(i => (i.rarity || '').toUpperCase() === targetRarity);
  if (pool.length === 0) {
    // Fallback to any rarity from this chest
    const allowedRarities = chest.weights.map(w => w.rarity);
    pool = items.filter(i => allowedRarities.includes((i.rarity || '').toUpperCase()));
  }
  if (pool.length === 0) pool = items;

  const chosenItem = pool[Math.floor(Math.random() * pool.length)];
  return { chosenItem, chest, targetRarity };
}

export function buildUnboxEmbed(chosenItem, chest, priceMap) {
  const rarityKey = (chosenItem.rarity || 'COMMON').toUpperCase();
  const rarityMeta = RARITY_META[rarityKey] || RARITY_META.COMMON;
  const boltPrice = getItemPrice(priceMap, chosenItem);

  const typeName = chosenItem.type === 'BODY_SKIN'
    ? 'Character'
    : (chosenItem.parent?.name || chosenItem.type || 'Weapon');

  const cleanName = chosenItem.name.replace(/^_+/, '').trim();

  const embed = new EmbedBuilder()
    .setColor(rarityMeta.color || chest.color)
    .setAuthor({
      name: `${chest.icon} Unboxed: ${chest.name}`,
      iconURL: chest.renderUrl
    })
    .setTitle(`${rarityMeta.emoji} ${cleanName}`)
    .setDescription(
      `**Category:** \`${typeName}\`\n` +
      `**Rarity:** ${rarityMeta.emoji} **${rarityMeta.label}**\n` +
      `**Market Value:** ${boltPrice > 0 ? `⚡ **${formatValueLong(boltPrice)} Bolts** (\`${formatValueShort(boltPrice)}\`)` : '⚡ *Unpriced / Collector*'}\n` +
      `**Chest Cost:** \`${chest.cost}\``
    )
    .setImage(chosenItem.renderUrl)
    .setFooter({
      text: `Kirka.io Chest Simulator • Drop Rates: ${chest.weights.map(w => `${w.rarity[0]}${w.rarity.slice(1).toLowerCase()} ${w.weight}%`).join(' | ')}`
    })
    .setTimestamp();

  return embed;
}

export function buildUnboxButtons(chestKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`unbox_again_${chestKey}`)
      .setLabel(`🎲 Open Another ${CHESTS[chestKey]?.name || 'Chest'}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('🌐 View Live Catalog')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app/catalog')
  );
}

export async function execute(interaction) {
  await interaction.deferReply();

  let chestKey = interaction.options.getString('chest')?.toLowerCase() || 'wood';
  if (!CHESTS[chestKey]) chestKey = 'wood';

  const [catalog, priceMap] = await Promise.all([
    getPublicCatalog(),
    getBoltPriceMap()
  ]);

  if (!catalog || catalog.length === 0) {
    return interaction.editReply({ content: '❌ Failed to load Kirka catalog items. Please try again in a moment.' });
  }

  let { chosenItem, chest } = rollSkin(chestKey, catalog);

  const message = await interaction.editReply({
    embeds: [buildUnboxEmbed(chosenItem, chest, priceMap)],
    components: [buildUnboxButtons(chestKey)]
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: '❌ Open your own chest with `/unbox` or `.unbox`!', ephemeral: true });
    }

    if (btn.customId.startsWith('unbox_again_')) {
      const activeChestKey = btn.customId.replace('unbox_again_', '');
      const rolled = rollSkin(activeChestKey, catalog);
      chosenItem = rolled.chosenItem;
      chest = rolled.chest;

      await btn.update({
        embeds: [buildUnboxEmbed(chosenItem, chest, priceMap)],
        components: [buildUnboxButtons(activeChestKey)]
      });
    }
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('unbox_disabled')
          .setLabel(`🎲 Session Expired`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setLabel('🌐 View Live Catalog')
          .setStyle(ButtonStyle.Link)
          .setURL('https://kirkahub.vercel.app/catalog')
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch {}
  });
}

export async function executePrefix(message, args) {
  let chestKey = 'wood';
  if (args.length > 0) {
    const raw = args[0].toLowerCase();
    if (CHESTS[raw]) {
      chestKey = raw;
    } else if (raw.includes('ice')) {
      chestKey = 'ice';
    } else if (raw.includes('gold')) {
      chestKey = 'golden';
    } else if (raw.includes('hal') || raw.includes('spook')) {
      chestKey = 'halloween';
    } else if (raw.includes('xmas') || raw.includes('chris')) {
      chestKey = 'christmas';
    }
  }

  const [catalog, priceMap] = await Promise.all([
    getPublicCatalog(),
    getBoltPriceMap()
  ]);

  if (!catalog || catalog.length === 0) {
    return message.reply('❌ Failed to load Kirka catalog items. Please try again in a moment.');
  }

  let { chosenItem, chest } = rollSkin(chestKey, catalog);

  const replyMsg = await message.reply({
    embeds: [buildUnboxEmbed(chosenItem, chest, priceMap)],
    components: [buildUnboxButtons(chestKey)]
  });

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== message.author.id) {
      return btn.reply({ content: '❌ Open your own chest with `.unbox` or `/unbox`!', ephemeral: true });
    }

    if (btn.customId.startsWith('unbox_again_')) {
      const activeChestKey = btn.customId.replace('unbox_again_', '');
      const rolled = rollSkin(activeChestKey, catalog);
      chosenItem = rolled.chosenItem;
      chest = rolled.chest;

      await btn.update({
        embeds: [buildUnboxEmbed(chosenItem, chest, priceMap)],
        components: [buildUnboxButtons(activeChestKey)]
      });
    }
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('unbox_disabled')
          .setLabel(`🎲 Session Expired`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setLabel('🌐 View Live Catalog')
          .setStyle(ButtonStyle.Link)
          .setURL('https://kirkahub.vercel.app/catalog')
      );
      await replyMsg.edit({ components: [disabledRow] });
    } catch {}
  });
}
