import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Find active Kirka trade listings for a skin from Skywalk Trades')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('skin')
      .setDescription('Name of the skin to search trades for (e.g. Hi-Score, Solitude, Shark)')
      .setRequired(true)
  );

let tradesCache = null;
let tradesCacheTime = 0;

export async function fetchLiveTrades() {
  const now = Date.now();
  if (tradesCache && (now - tradesCacheTime < 60000)) {
    return tradesCache;
  }
  try {
    const res = await fetch('https://kirka.lukeskywalk.com/trades.json', {
      headers: { 'user-agent': 'KirkaHub-Bot/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        tradesCache = data;
        tradesCacheTime = now;
        return data;
      }
    }
  } catch (err) {
    console.error('[Trades] Failed to fetch live trades from Skywalk API:', err.message);
  }
  return tradesCache || [];
}

const TRADES_PER_PAGE = 3;

function computeItemsValue(items, priceMap) {
  let total = 0;
  for (const it of items) {
    const name = (it.i || '').trim().toLowerCase();
    const qty = parseInt(it.q || '1', 10) || 1;
    const price = priceMap.get(name) || 0;
    total += price * qty;
  }
  return total;
}

function formatItemsList(items) {
  if (!items || items.length === 0) return '*(None)*';
  return items.map(it => {
    const qty = it.q && it.q !== '1' ? `${it.q}x ` : '';
    return `**${qty}${it.i}**`;
  }).join(', ');
}

function buildTradeEmbed(query, matchedTrades, page, totalPages, priceMap) {
  const start = page * TRADES_PER_PAGE;
  const pageTrades = matchedTrades.slice(start, start + TRADES_PER_PAGE);

  const embed = new EmbedBuilder()
    .setTitle(`?? Kirka Trades for "${query}"`)
    .setColor('#38bdf8')
    .setDescription(
      matchedTrades.length === 0
        ? `No active trade listings found matching **"${query}"** right now.\nCheck back soon or view all active listings on KirkaHub!`
        : `Found **${matchedTrades.length}** active trade listing(s) involving **"${query}"**:`
    )
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} • Powered by Skywalk Trades API & Bolt Valuations`
    })
    .setTimestamp();

  for (const trade of pageTrades) {
    const trader = trade.userAndTag || 'Unknown Trader';
    const offeredList = formatItemsList(trade.offered);
    const wantedList = formatItemsList(trade.wanted);

    const offeredVal = computeItemsValue(trade.offered || [], priceMap);
    const wantedVal = computeItemsValue(trade.wanted || [], priceMap);

    const offeredStr = offeredVal > 0 ? `${offeredList}\n*(?? ~${formatValueLong(offeredVal)} Bolts)*` : offeredList;
    const wantedStr = wantedVal > 0 ? `${wantedList}\n*(?? ~${formatValueLong(wantedVal)} Bolts)*` : wantedList;

    let evalTag = '?? Value Neutral';
    if (offeredVal > 0 && wantedVal > 0) {
      const diff = offeredVal - wantedVal;
      if (diff > 0) {
        evalTag = `?? Overpay (+${formatValueLong(diff)})`;
      } else if (diff < 0) {
        evalTag = `?? Underpay (-${formatValueLong(Math.abs(diff))})`;
      } else {
        evalTag = `?? Equal Value`;
      }
    }

    embed.addFields({
      name: `?? Trade #${trade.tradeId || ''} • ${trader}`,
      value: `**Offering:** ${offeredStr}\n**Wanting:** ${wantedStr}\n**Assessment:** \`${evalTag}\``,
      inline: false
    });
  }

  return embed;
}

function buildButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev_trade')
      .setLabel('? Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('next_trade')
      .setLabel('Next ?')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setLabel('?? View Live on KirkaHub')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app/trades')
  );
}

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('skin');
  if (!query) {
    return interaction.editReply({ content: '? Please provide a skin name to search trades for.' });
  }

  const cleanQuery = query.trim().toLowerCase();
  const [allTrades, priceMap] = await Promise.all([
    fetchLiveTrades(),
    getBoltPriceMap()
  ]);

  const matched = allTrades.filter(trade => {
    const hasOffered = (trade.offered || []).some(o => (o.i || '').toLowerCase().includes(cleanQuery));
    const hasWanted = (trade.wanted || []).some(w => (w.i || '').toLowerCase().includes(cleanQuery));
    return hasOffered || hasWanted;
  });

  const totalPages = Math.max(1, Math.ceil(matched.length / TRADES_PER_PAGE));
  let currentPage = 0;

  const response = await interaction.editReply({
    embeds: [buildTradeEmbed(query, matched, currentPage, totalPages, priceMap)],
    components: matched.length > 0 ? [buildButtons(currentPage, totalPages)] : [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('?? View All Trades on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      )
    ]
  });

  if (totalPages <= 1) return;

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: '? Only the user who ran this command can flip pages.', ephemeral: true });
    }

    if (btn.customId === 'prev_trade') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (btn.customId === 'next_trade') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    await btn.update({
      embeds: [buildTradeEmbed(query, matched, currentPage, totalPages, priceMap)],
      components: [buildButtons(currentPage, totalPages)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_trade').setLabel('? Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next_trade').setLabel('Next ?').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setLabel('?? View Live on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch {}
  });
}

export async function executePrefix(message, args) {
  const query = args.join(' ').trim();
  if (!query) {
    return message.reply('? Please specify a skin name to search trades for (e.g. `.trade Hi-Score` or `.trade Shark`).');
  }

  await message.channel.sendTyping();
  const cleanQuery = query.toLowerCase();

  const [allTrades, priceMap] = await Promise.all([
    fetchLiveTrades(),
    getBoltPriceMap()
  ]);

  const matched = allTrades.filter(trade => {
    const hasOffered = (trade.offered || []).some(o => (o.i || '').toLowerCase().includes(cleanQuery));
    const hasWanted = (trade.wanted || []).some(w => (w.i || '').toLowerCase().includes(cleanQuery));
    return hasOffered || hasWanted;
  });

  const totalPages = Math.max(1, Math.ceil(matched.length / TRADES_PER_PAGE));
  let currentPage = 0;

  const response = await message.reply({
    embeds: [buildTradeEmbed(query, matched, currentPage, totalPages, priceMap)],
    components: matched.length > 0 ? [buildButtons(currentPage, totalPages)] : [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('?? View All Trades on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      )
    ]
  });

  if (totalPages <= 1) return;

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== message.author.id) {
      return btn.reply({ content: '? Only the user who ran this command can flip pages.', ephemeral: true });
    }

    if (btn.customId === 'prev_trade') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (btn.customId === 'next_trade') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    await btn.update({
      embeds: [buildTradeEmbed(query, matched, currentPage, totalPages, priceMap)],
      components: [buildButtons(currentPage, totalPages)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_trade').setLabel('? Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next_trade').setLabel('Next ?').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setLabel('?? View Live on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      );
      await response.edit({ components: [disabledRow] });
    } catch {}
  });
}
