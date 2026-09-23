import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getBoltPriceMap, formatValueLong } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('highest')
  .setDescription('View the highest-priced skin for a weapon or category from the Kirka Hub valuation index')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(opt =>
    opt.setName('weapon')
      .setDescription('Weapon name (scar, vita, bayo, shark, ar9, rev, weatie, char, etc.) or all')
      .setRequired(false)
      .addChoices(
        { name: '🎯 SCAR', value: 'scar' },
        { name: '⚡ VITA', value: 'vita' },
        { name: '🗡️ Bayonet (Bayo)', value: 'bayonet' },
        { name: '🦈 Shark', value: 'shark' },
        { name: '🔫 AR-9', value: 'ar9' },
        { name: '🤠 Revolver', value: 'revolver' },
        { name: '🪓 Tomahawk', value: 'tomahawk' },
        { name: '💥 Weatie', value: 'weatie' },
        { name: '⚡ MAC-10', value: 'mac10' },
        { name: '🎯 LAR', value: 'lar' },
        { name: '🔥 M60', value: 'm60' },
        { name: '👤 Character', value: 'character' },
        { name: '🌐 All Categories Overview', value: 'all' }
      )
  );

const WEAPON_REGISTRY = {
  scar: { name: 'SCAR', category: 'scar', emoji: '🎯' },
  vita: { name: 'VITA', category: 'vita', emoji: '⚡' },
  bayonet: { name: 'Bayonet', category: 'bayonet', emoji: '🗡️' },
  bayo: { name: 'Bayonet', category: 'bayonet', emoji: '🗡️' },
  knife: { name: 'Bayonet', category: 'bayonet', emoji: '🗡️' },
  shark: { name: 'Shark', category: 'shark', emoji: '🦈' },
  ar9: { name: 'AR-9', category: 'ar9', emoji: '🔫' },
  'ar-9': { name: 'AR-9', category: 'ar9', emoji: '🔫' },
  ar: { name: 'AR-9', category: 'ar9', emoji: '🔫' },
  revolver: { name: 'Revolver', category: 'revolver', emoji: '🤠' },
  rev: { name: 'Revolver', category: 'revolver', emoji: '🤠' },
  magnum: { name: 'Revolver', category: 'revolver', emoji: '🤠' },
  pistol: { name: 'Revolver', category: 'revolver', emoji: '🤠' },
  tomahawk: { name: 'Tomahawk', category: 'tomahawk', emoji: '🪓' },
  toma: { name: 'Tomahawk', category: 'tomahawk', emoji: '🪓' },
  axe: { name: 'Tomahawk', category: 'tomahawk', emoji: '🪓' },
  weatie: { name: 'Weatie', category: 'weatie', emoji: '💥' },
  shotgun: { name: 'Weatie', category: 'weatie', emoji: '💥' },
  weat: { name: 'Weatie', category: 'weatie', emoji: '💥' },
  mac10: { name: 'MAC-10', category: 'mac10', emoji: '⚡' },
  'mac-10': { name: 'MAC-10', category: 'mac10', emoji: '⚡' },
  mac: { name: 'MAC-10', category: 'mac10', emoji: '⚡' },
  smg: { name: 'MAC-10', category: 'mac10', emoji: '⚡' },
  lar: { name: 'LAR', category: 'lar', emoji: '🎯' },
  sniper: { name: 'LAR', category: 'lar', emoji: '🎯' },
  m60: { name: 'M60', category: 'm60', emoji: '🔥' },
  lmg: { name: 'M60', category: 'm60', emoji: '🔥' },
  character: { name: 'Character', category: 'character', emoji: '👤' },
  char: { name: 'Character', category: 'character', emoji: '👤' },
  skin: { name: 'Character', category: 'character', emoji: '👤' },
  body: { name: 'Character', category: 'character', emoji: '👤' },
  player: { name: 'Character', category: 'character', emoji: '👤' },
  outfit: { name: 'Character', category: 'character', emoji: '👤' },
  chest: { name: 'Chest', category: 'chest', emoji: '📦' },
  box: { name: 'Chest', category: 'chest', emoji: '📦' },
  crate: { name: 'Chest', category: 'chest', emoji: '📦' }
};

const MAJOR_ORDER = [
  'vita',
  'character',
  'shark',
  'm60',
  'tomahawk',
  'bayonet',
  'scar',
  'ar9',
  'revolver',
  'weatie',
  'lar',
  'mac10'
];

const RARITY_COLORS = {
  MYTHICAL: 0xff0055,
  LEGENDARY: 0xf59e0b,
  EPIC: 0xa855f7,
  RARE: 0x3b82f6,
  UNCOMMON: 0x22c55e,
  COMMON: 0x9ca3af
};

const RARITY_EMOJIS = {
  MYTHICAL: '🔴',
  LEGENDARY: '🟡',
  EPIC: '🟣',
  RARE: '🔵',
  UNCOMMON: '🟢',
  COMMON: '⚪'
};

function normalizeType(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Filter and deduplicate items for a weapon category, sorted descending by baseValue.
 */
function getSkinsForCategory(priceMap, category) {
  const seen = new Set();
  const matched = [];

  for (const item of priceMap.values()) {
    const rawType = normalizeType(item.type);
    const isMatch = rawType === category || (category === 'ar9' && rawType.startsWith('ar9'));

    if (isMatch && item.baseValue && typeof item.baseValue === 'number' && item.baseValue > 0) {
      const nameKey = (item.skinName || '').trim().toLowerCase();
      if (!seen.has(nameKey)) {
        seen.add(nameKey);
        matched.push(item);
      }
    }
  }

  matched.sort((a, b) => b.baseValue - a.baseValue);
  return matched;
}

export async function buildWeaponHighestEmbed(weaponQuery) {
  const priceMap = await getBoltPriceMap();
  const cleanQuery = weaponQuery.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  const weaponInfo = WEAPON_REGISTRY[cleanQuery] || WEAPON_REGISTRY[cleanQuery.replace(/-/g, '')];

  if (!weaponInfo) {
    return {
      embed: new EmbedBuilder()
        .setTitle('❌ Unknown Weapon')
        .setColor(0xef4444)
        .setDescription(`Could not find weapon category **${weaponQuery}**.\n\nSupported weapons: ` +
          `\`scar\`, \`vita\`, \`bayo\`, \`shark\`, \`ar9\`, \`rev\`, \`weatie\`, \`mac10\`, \`lar\`, \`m60\`, \`char\`\n\n` +
          `Type **\`.highest\`** to see the top skin across all categories!`),
      components: []
    };
  }

  const skins = getSkinsForCategory(priceMap, weaponInfo.category);

  if (!skins || skins.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`${weaponInfo.emoji} ${weaponInfo.name} Skins`)
        .setColor(0x64748b)
        .setDescription(`No pricing data currently available for **${weaponInfo.name}**.`),
      components: []
    };
  }

  const topSkin = skins[0];
  const rarity = (topSkin.rarity || 'COMMON').toUpperCase();
  const embedColor = RARITY_COLORS[rarity] || 0x38bdf8;
  const rarityEmoji = RARITY_EMOJIS[rarity] || '⚪';

  const cleanSkinName = topSkin.skinName.replace(/^_+/, '');
  const renderUrl = `https://api2.kirka.io/api/skin-render/${encodeURIComponent(cleanSkinName)}`;
  const web3DUrl = `https://kirkahub.online/skin/${encodeURIComponent(cleanSkinName)}`;

  const medals = ['🥇', '🥈', '🥉', '🔹', '🔹'];
  let topList = '';
  const topSlice = skins.slice(0, 5);
  topSlice.forEach((skin, idx) => {
    const r = (skin.rarity || 'COMMON').toUpperCase();
    const rEmoji = RARITY_EMOJIS[r] || '⚪';
    const isTop = idx === 0;
    topList += `${medals[idx]} **#${idx + 1}** ${rEmoji} **${skin.skinName}** — ⚡ **${formatValueLong(skin.baseValue)}** (` +
      `${skin.baseValue.toLocaleString()} Bolts` +
      `)${isTop ? ' 👑' : ''}\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${weaponInfo.emoji} Most Expensive ${weaponInfo.name} Skin: ${topSkin.skinName}`)
    .setColor(embedColor)
    .setDescription(
      `### 👑 #1 Most Valuable ${weaponInfo.name} Skin\n` +
      `• **Skin Name:** **${topSkin.skinName}**\n` +
      `• **Market Value:** ⚡ **${formatValueLong(topSkin.baseValue)} Hub Value** (` +
      `${topSkin.baseValue.toLocaleString()} Hub Value` +
      `)\n` +
      `• **Rarity:** ${rarityEmoji} **${rarity}**\n` +
      `• **Source:** ${topSkin.obtainableBy || 'Tradable Market'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🏆 Top 5 Most Expensive ${weaponInfo.name} Skins:\n` +
      topList +
      `\n> 💡 *Prices sourced from the official Kirka Hub Valuation index.*`
    )
    .setImage(renderUrl)
    .setFooter({ text: `KirkaHub Market • ${skins.length} ${weaponInfo.name} skins tracked • .donate for 24/7 hosting` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(`🎮 View ${cleanSkinName} in 3D`)
      .setStyle(ButtonStyle.Link)
      .setURL(web3DUrl),
    new ButtonBuilder()
      .setLabel('📈 Full Price Portal')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.online/prices')
  );

  return { embed, components: [row] };
}

export async function buildOverviewEmbed() {
  const priceMap = await getBoltPriceMap();

  let desc = `Here is the **#1 most expensive skin** across every weapon category in Kirka.io:\n\n`;

  let overallPriciest = null;

  for (const catKey of MAJOR_ORDER) {
    const weaponInfo = WEAPON_REGISTRY[catKey];
    if (!weaponInfo) continue;

    const skins = getSkinsForCategory(priceMap, catKey);
    if (skins.length > 0) {
      const top = skins[0];
      const r = (top.rarity || 'COMMON').toUpperCase();
      const rEmoji = RARITY_EMOJIS[r] || '⚪';

      if (!overallPriciest || top.baseValue > overallPriciest.baseValue) {
        overallPriciest = { ...top, weaponName: weaponInfo.name };
      }

      desc += `${weaponInfo.emoji} **${weaponInfo.name.padEnd(9)}** • ${rEmoji} **${top.skinName}** — ⚡ **${formatValueLong(top.baseValue)}**\n`;
    }
  }

  desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💎 **Grand Champion Skin:** ` +
    (overallPriciest ? `**${overallPriciest.skinName}** (${overallPriciest.weaponName}) at ⚡ **${formatValueLong(overallPriciest.baseValue)}**` : 'N/A') +
    `\n\n🔍 *Inspect a specific weapon with:* \`.highest <weapon>\`` +
    `\n*(e.g. \`.highest scar\`, \`.highest vita\`, \`.highest bayo\`, \`.highest shark\`, \`.highest rev\`)*`;

  const embed = new EmbedBuilder()
    .setTitle('💎 Highest-Priced Skins by Weapon Category')
    .setColor(0xf59e0b)
    .setDescription(desc)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2589/2589175.png')
    .setFooter({ text: 'KirkaHub Price Leaderboard • Official Hub Valuation Index' })
    .setTimestamp();

  if (overallPriciest) {
    const cleanOverall = overallPriciest.skinName.replace(/^_+/, '');
    embed.setImage(`https://api2.kirka.io/api/skin-render/${encodeURIComponent(cleanOverall)}`);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📈 Full Price Sheet Portal')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.online/prices'),
    new ButtonBuilder()
      .setLabel('🌐 KirkaHub 3D Studio')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.online')
  );

  return { embed, components: [row] };
}

export async function execute(interaction) {
  await interaction.deferReply();
  const weaponOption = interaction.options.getString('weapon');

  try {
    if (!weaponOption || weaponOption === 'all') {
      const { embed, components } = await buildOverviewEmbed();
      return interaction.editReply({ embeds: [embed], components });
    }

    const { embed, components } = await buildWeaponHighestEmbed(weaponOption);
    return interaction.editReply({ embeds: [embed], components });
  } catch (err) {
    console.error('[HighestCommand] Error:', err);
    return interaction.editReply('⚠️ Failed to calculate highest skin prices.');
  }
}

export async function executePrefix(message, args) {
  await message.channel.sendTyping();
  const weaponQuery = args[0] ? args.join(' ').trim() : null;

  try {
    if (!weaponQuery || weaponQuery.toLowerCase() === 'all' || weaponQuery.toLowerCase() === 'overview') {
      const { embed, components } = await buildOverviewEmbed();
      return message.reply({ embeds: [embed], components });
    }

    const { embed, components } = await buildWeaponHighestEmbed(weaponQuery);
    return message.reply({ embeds: [embed], components });
  } catch (err) {
    console.error('[HighestPrefix] Error:', err);
    return message.reply('⚠️ Failed to calculate highest skin prices.');
  }
}
