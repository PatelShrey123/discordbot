import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { getParsedStore, getSkinRenderUrl } from '../api/store.js';
import { renderLimitedDropsBanner } from '../canvas/storeBanner.js';

export const data = new SlashCommandBuilder()
  .setName('store')
  .setDescription('View the live Kirka.io in-game store, skin bundles, and limited edition stock remaining')
  .addStringOption(option =>
    option.setName('view')
      .setDescription('Filter store sections')
      .setRequired(false)
      .addChoices(
        { name: '🌟 Full Overview (All)', value: 'all' },
        { name: '🔥 Limited Edition Drops Only', value: 'limited' },
        { name: '💥 Featured Complete Set', value: 'set' },
        { name: '📦 Themed Bundles', value: 'bundles' }
      )
  );

export async function buildStorePayload(storeData, viewFilter = 'all') {
  const embed = new EmbedBuilder()
    .setColor('#38bdf8')
    .setTitle('🏬 Kirka.io Live Store & Limited Edition Drops')
    .setURL('https://kirka.io/store')
    .setDescription(
      'Live in-game shop items, weapon skin bundles, and real-time limited stock counters.\n' +
      '*Direct feed from official Kirka game servers.*'
    )
    .setTimestamp();

  const showLimited = viewFilter === 'all' || viewFilter === 'limited';
  const showSet = viewFilter === 'all' || viewFilter === 'set';
  const showBundles = viewFilter === 'all' || viewFilter === 'bundles';
  const showDaily = viewFilter === 'all';

  const files = [];

  // 1. Limited Edition Drops
  if (showLimited) {
    if (storeData.limitedDrops && storeData.limitedDrops.length > 0) {
      // Sort: lowest remaining units first so most urgent drops (e.g. BRIGHTSTAR 5/25) appear #1, then Capy (12/25)
      storeData.limitedDrops.sort((a, b) => (a.remainingUnits ?? 999) - (b.remainingUnits ?? 999));

      const limitedLines = storeData.limitedDrops.map((item, idx) => {
        const stockStatus = item.isSoldOut
          ? '🛑 **SOLD OUT**'
          : `🔥 **${item.remainingUnits} / ${item.totalUnits} UNITS LEFT**`;
        
        // Only show countdown if it actually expires in the near future (< 30 days) to avoid perpetual "in 4 years"
        const msLeft = item.endsAt ? new Date(item.endsAt).getTime() - Date.now() : 0;
        const showCountdown = msLeft > 0 && msLeft < 30 * 24 * 60 * 60 * 1000;
        const countdown = showCountdown
          ? ` • <t:${Math.floor(new Date(item.endsAt).getTime() / 1000)}:R>`
          : '';

        const icon = item.type === 'CHARACTER' ? '🐾' : '🗡️';
        return `${idx + 1}. ${icon} **${item.name}** (${item.weapon}) — ${stockStatus}\n   💎 **${item.priceDiamonds.toLocaleString()} Diamonds**${countdown}`;
      }).join('\n\n');

      embed.addFields({
        name: '🔥 LIMITED EDITION ITEMS (Live Remaining Stock)',
        value: limitedLines
      });

      // Generate side-by-side composite canvas image for ALL N limited items
      try {
        const bannerBuffer = await renderLimitedDropsBanner(storeData.limitedDrops);
        if (bannerBuffer) {
          const attachment = new AttachmentBuilder(bannerBuffer, { name: 'limited-drops-banner.png' });
          files.push(attachment);
          embed.setImage('attachment://limited-drops-banner.png');
        }
      } catch (bannerErr) {
        console.warn('[StoreCommand] Failed to generate limited drops banner:', bannerErr.message);
        // Fallback to top item image
        const topLimited = storeData.limitedDrops[0];
        if (topLimited && topLimited.renderUrl) {
          embed.setImage(topLimited.renderUrl);
        }
      }
    } else {
      embed.addFields({
        name: '🔥 LIMITED EDITION ITEMS',
        value: 'No limited-stock items active currently.'
      });
    }
  }

  // 2. Featured Complete Set
  if (showSet && storeData.featuredSet) {
    const set = storeData.featuredSet;
    const itemsList = set.items.map(it => `\`${it.name}\` (${it.weapon})`).join(', ');
    const ends = set.endsAt ? `\n⏰ **Available Until:** <t:${Math.floor(new Date(set.endsAt).getTime() / 1000)}:D>` : '';

    embed.addFields({
      name: `💥 FEATURED COMPLETE SET: ${set.name.toUpperCase()} SET`,
      value: `🏷️ **Price:** **${set.priceDiamonds.toLocaleString()} Diamonds** (Complete Bundle)${ends}\n` +
             `📦 **Included Weapon Skins (${set.items.length}):**\n${itemsList || 'N/A'}`
    });

    if (!embed.data.image && set.bannerImage) {
      embed.setImage(set.bannerImage);
    }
  }

  // 3. Daily Shop Rotation
  if (showDaily && storeData.dailyShop && storeData.dailyShop.length > 0) {
    const seen = new Set();
    const uniqueDaily = [];
    for (const it of storeData.dailyShop) {
      if (!seen.has(it.name)) {
        seen.add(it.name);
        uniqueDaily.push(it);
      }
    }

    const dailyLines = uniqueDaily.slice(0, 6).map(it => {
      const icon = it.type === 'CHARACTER' ? '👤' : (it.name === 'Name Change' ? '🏷️' : '🗡️');
      return `• ${icon} **${it.name}** (${it.weapon}) — **${it.priceDiamonds.toLocaleString()} 💎**`;
    }).join('\n');

    embed.addFields({
      name: '🛍️ DAILY SHOP ROTATION',
      value: dailyLines || 'No daily items currently.'
    });
  }

  // 4. Other Active Bundles
  if (showBundles && storeData.activeBundles && storeData.activeBundles.length > 0) {
    const bundleLines = storeData.activeBundles.map(b => {
      const ends = b.endsAt ? ` (Ends <t:${Math.floor(new Date(b.endsAt).getTime() / 1000)}:R>)` : '';
      const sampleItems = b.items.slice(0, 4).map(i => i.name).join(', ');
      return `• 📦 **${b.name} Bundle**${ends}\n  Includes: *${sampleItems}${b.items.length > 4 ? '...' : ''}*`;
    }).join('\n');

    embed.addFields({
      name: '📦 OTHER ACTIVE THEMED BUNDLES',
      value: bundleLines || 'No other bundles active.'
    });
  }

  embed.setFooter({
    text: 'KirkaHub Store Tracker • Type .storeupdate to get pinged on new drops!'
  });

  return { embed, files };
}

export function createStoreButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('store_refresh')
      .setLabel('🔄 Refresh Stock')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('store_sub_toggle')
      .setLabel('🔔 Subscribe to Drop Alerts')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setLabel('🌐 Open Kirka Store')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirka.io/store')
  );
}

export async function execute(interaction) {
  await interaction.deferReply();
  const view = interaction.options.getString('view') || 'all';

  try {
    const storeData = await getParsedStore();
    const { embed, files } = await buildStorePayload(storeData, view);
    const components = [createStoreButtons()];

    await interaction.editReply({
      embeds: [embed],
      files,
      components
    });
  } catch (err) {
    console.error('Error executing store slash command:', err);
    await interaction.editReply('❌ Failed to retrieve live store data. Please try again later.');
  }
}

export async function executePrefix(message, args) {
  await message.channel.sendTyping();
  const arg = args[0]?.toLowerCase();
  const view = ['limited', 'set', 'bundles'].includes(arg) ? arg : 'all';

  try {
    const storeData = await getParsedStore();
    const { embed, files } = await buildStorePayload(storeData, view);
    const components = [createStoreButtons()];

    await message.reply({
      embeds: [embed],
      files,
      components
    });
  } catch (err) {
    console.error('Error executing store prefix command:', err);
    await message.reply('⚠️ Failed to load live store data from Kirka servers.');
  }
}
