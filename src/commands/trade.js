import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } from 'discord.js';
import { getBoltPriceMap, formatValueShort } from '../api/boltPrices.js';
import { getPublicCatalog } from '../api/kirka.js';
import { renderTradeCard } from '../canvas/tradeCard.js';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Browse live Kirka trade listings and completed trade history with visual cards')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('Choose between Active Offers or Completed Trade History')
      .setRequired(false)
      .addChoices(
        { name: 'Active Offers (Live Listings)', value: 'active' },
        { name: 'Trade History (Completed Deals)', value: 'history' }
      )
  )
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Search for a skin name or player/tag (e.g. Hi-Score, Shark, Sinister, Bloom)')
      .setRequired(false)
  );

// In-memory trade caches
let activeTradesCache = null;
let activeTradesTime = 0;

let historyTradesCache = null;
let historyTradesTime = 0;

export async function fetchLiveTrades() {
  const now = Date.now();
  if (activeTradesCache && (now - activeTradesTime < 60000)) {
    return activeTradesCache;
  }
  try {
    const res = await fetch('https://kirka.lukeskywalk.com/trades.json', {
      headers: { 'user-agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        activeTradesCache = data;
        activeTradesTime = now;
        return data;
      }
    }
  } catch (err) {
    console.error('[Trades] Failed to fetch live trades from Skywalk API:', err.message);
  }
  return activeTradesCache || [];
}

export async function fetchTradeHistory() {
  const now = Date.now();
  if (historyTradesCache && (now - historyTradesTime < 300000)) {
    return historyTradesCache;
  }
  try {
    const res = await fetch('https://kirka.lukeskywalk.com/tradehistory/snapshots.json', {
      headers: { 'user-agent': 'Mozilla/5.0 KirkaHub-Bot/1.0' }
    });
    if (res.ok) {
      const snapshots = await res.json();
      if (Array.isArray(snapshots)) {
        const files = snapshots.filter(s => typeof s === 'string' && s.endsWith('.json') && s !== 'dailyTrades.json').slice(-2);
        const results = await Promise.all(
          files.map(f => fetch(`https://kirka.lukeskywalk.com/tradehistory/${f}`).then(r => r.json()).catch(() => []))
        );
        const merged = results.flat();
        merged.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        historyTradesCache = merged;
        historyTradesTime = now;
        return merged;
      }
    }
  } catch (err) {
    console.error('[Trades] Failed to fetch trade history from Skywalk API:', err.message);
  }
  return historyTradesCache || [];
}

function getTradeItemPrice(priceMap, itemName) {
  if (!itemName) return 0;
  const clean = itemName.replace(/^_+|_+$/g, '').trim().toLowerCase();
  const obj = priceMap.get(clean);
  if (obj && obj.baseValue) return obj.baseValue;

  for (const [k, v] of priceMap.entries()) {
    if (k === clean || k.startsWith(clean + '_')) {
      if (v && v.baseValue) return v.baseValue;
    }
  }
  return 0;
}

function getItemRenderUrl(catalog, itemName) {
  if (!catalog || !itemName) return null;
  const clean = itemName.replace(/^_+|_+$/g, '').trim().toLowerCase();
  const found = catalog.find(p => (p.name || '').replace(/^_+|_+$/g, '').trim().toLowerCase() === clean);
  return found ? found.renderUrl : null;
}

function normalizeTrade(rawTrade, mode, priceMap, catalog) {
  if (mode === 'history') {
    const offeredRaw = rawTrade.trade?.offered?.items || [];
    const wantedRaw = rawTrade.trade?.wanted?.items || [];

    const offered = offeredRaw.map(it => {
      const name = it.name || 'Unknown';
      const price = getTradeItemPrice(priceMap, name) || it.value || 0;
      return {
        name,
        quantity: it.quantity || '1',
        rarity: it.rarity || 'Common',
        rarityFull: it.rarity || 'Common',
        price,
        renderUrl: getItemRenderUrl(catalog, name)
      };
    });

    const wanted = wantedRaw.map(it => {
      const name = it.name || 'Unknown';
      const price = getTradeItemPrice(priceMap, name) || it.value || 0;
      return {
        name,
        quantity: it.quantity || '1',
        rarity: it.rarity || 'Common',
        rarityFull: it.rarity || 'Common',
        price,
        renderUrl: getItemRenderUrl(catalog, name)
      };
    });

    const offeredTotal = offered.reduce((sum, i) => sum + (i.price * (parseInt(i.quantity, 10) || 1)), 0);
    const wantedTotal = wanted.reduce((sum, i) => sum + (i.price * (parseInt(i.quantity, 10) || 1)), 0);

    let assessment = 'Fair';
    let diffText = 'Balanced';
    if (offeredTotal > 0 && wantedTotal > 0) {
      const diff = offeredTotal - wantedTotal;
      const pct = Math.round((Math.abs(diff) / wantedTotal) * 100);
      if (diff > (wantedTotal * 0.05)) {
        assessment = 'Overpay';
        diffText = `+${formatValueShort(diff)} (+${pct}%)`;
      } else if (diff < -(wantedTotal * 0.05)) {
        assessment = 'Underpay';
        diffText = `-${formatValueShort(Math.abs(diff))} (-${pct}%)`;
      }
    } else {
      assessment = 'Special';
      diffText = 'Unpriced / Custom';
    }

    return {
      tradeId: rawTrade.tradeId || 0,
      type: 'history',
      offerer: rawTrade.offerer || 'Unknown',
      accepter: rawTrade.accepter || 'Unknown',
      updatedAt: rawTrade.updatedAt,
      offered,
      wanted,
      offeredTotal,
      wantedTotal,
      assessment,
      diffText
    };
  }

  // Active Trade
  const offeredRaw = rawTrade.offered || [];
  const wantedRaw = rawTrade.wanted || [];

  const offered = offeredRaw.map(it => {
    const name = it.i || 'Unknown';
    const price = getTradeItemPrice(priceMap, name);
    return {
      name,
      quantity: it.q || '1',
      rarity: it.r || 'C',
      rarityFull: it.r || 'Common',
      price,
      renderUrl: getItemRenderUrl(catalog, name)
    };
  });

  const wanted = wantedRaw.map(it => {
    const name = it.i || 'Unknown';
    const price = getTradeItemPrice(priceMap, name);
    return {
      name,
      quantity: it.q || '1',
      rarity: it.r || 'C',
      rarityFull: it.r || 'Common',
      price,
      renderUrl: getItemRenderUrl(catalog, name)
    };
  });

  const offeredTotal = offered.reduce((sum, i) => sum + (i.price * (parseInt(i.quantity, 10) || 1)), 0);
  const wantedTotal = wanted.reduce((sum, i) => sum + (i.price * (parseInt(i.quantity, 10) || 1)), 0);

  let assessment = 'Fair';
  let diffText = 'Balanced';
  if (offeredTotal > 0 && wantedTotal > 0) {
    const diff = offeredTotal - wantedTotal;
    const pct = Math.round((Math.abs(diff) / wantedTotal) * 100);
    if (diff > (wantedTotal * 0.05)) {
      assessment = 'Overpay';
      diffText = `+${formatValueShort(diff)} (+${pct}%)`;
    } else if (diff < -(wantedTotal * 0.05)) {
      assessment = 'Underpay';
      diffText = `-${formatValueShort(Math.abs(diff))} (-${pct}%)`;
    }
  } else {
    assessment = 'Special';
    diffText = 'Unpriced / Custom';
  }

  return {
    tradeId: rawTrade.tradeId || 0,
    type: 'active',
    userAndTag: rawTrade.userAndTag || 'Unknown',
    updatedAt: rawTrade.updatedAt,
    offered,
    wanted,
    offeredTotal,
    wantedTotal,
    assessment,
    diffText
  };
}

function filterTrades(trades, query, mode) {
  if (!query) return trades;
  const q = query.trim().toLowerCase();

  return trades.filter(tr => {
    if (mode === 'history') {
      if ((tr.offerer || '').toLowerCase().includes(q)) return true;
      if ((tr.accepter || '').toLowerCase().includes(q)) return true;
      const offeredItems = tr.trade?.offered?.items || [];
      const wantedItems = tr.trade?.wanted?.items || [];
      if (offeredItems.some(i => (i.name || '').toLowerCase().includes(q))) return true;
      if (wantedItems.some(i => (i.name || '').toLowerCase().includes(q))) return true;
      return false;
    }

    if ((tr.userAndTag || '').toLowerCase().includes(q)) return true;
    const offered = tr.offered || [];
    const wanted = tr.wanted || [];
    if (offered.some(i => (i.i || '').toLowerCase().includes(q))) return true;
    if (wanted.some(i => (i.i || '').toLowerCase().includes(q))) return true;
    return false;
  });
}

function buildButtons(index, totalCount, mode) {
  const isHistory = mode === 'history';
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trade_prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index <= 0),
    new ButtonBuilder()
      .setCustomId('trade_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index >= totalCount - 1),
    new ButtonBuilder()
      .setCustomId('trade_toggle_mode')
      .setLabel(isHistory ? 'Show Active Offers 🟢' : 'Show Trade History 📜')
      .setStyle(isHistory ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🌐 View on KirkaHub')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app/trades')
  );
  return row;
}

function buildEmbed(trade, index, totalCount, query, mode) {
  const isHistory = mode === 'history';
  const title = isHistory
    ? `🤝 Completed Trade (${index + 1}/${totalCount})`
    : `🟢 Active Trade Offer (${index + 1}/${totalCount})`;

  const offeredList = trade.offered.map(i => `• **${i.name}** (x${i.quantity}) — ${i.price > 0 ? `⚡ **${formatValueShort(i.price)}**` : '*Unpriced*'}`).join('\n') || '*(None)*';
  const wantedList = trade.wanted.map(i => `• **${i.name}** (x${i.quantity}) — ${i.price > 0 ? `⚡ **${formatValueShort(i.price)}**` : '*Unpriced*'}`).join('\n') || '*(None)*';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(trade.assessment === 'Overpay' ? 0x22c55e : (trade.assessment === 'Underpay' ? 0xef4444 : 0x38bdf8))
    .setDescription(
      `**Trader:** \`${isHistory ? `${trade.offerer} ➔ ${trade.accepter}` : trade.userAndTag}\`\n` +
      `**Valuation:** **${trade.assessment}** (${trade.diffText})\n` +
      `**Total Bolt Value:** ⚡ **${formatValueShort(trade.offeredTotal)}** vs ⚡ **${formatValueShort(trade.wantedTotal)}**\n\n` +
      `**Items Offered:**\n${offeredList}\n\n` +
      `**Items Wanted:**\n${wantedList}`
    )
    .setImage('attachment://trade.png')
    .setFooter({
      text: (query ? `Search: "${query}" • ` : '') + 'Kirka Trades • Use buttons to flip trades'
    })
    .setTimestamp();

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();

  let mode = interaction.options.getString('mode') || 'active';
  const query = interaction.options.getString('query') || '';

  const [priceMap, catalog] = await Promise.all([
    getBoltPriceMap(),
    getPublicCatalog()
  ]);

  let activeList = null;
  let historyList = null;

  if (mode === 'history') {
    historyList = await fetchTradeHistory();
  } else {
    activeList = await fetchLiveTrades();
  }

  let currentPool = mode === 'history' ? historyList : activeList;
  let filtered = filterTrades(currentPool, query, mode);

  if (filtered.length === 0) {
    return interaction.editReply({
      content: `❌ No trades found matching "${query}" in **${mode === 'history' ? 'Trade History' : 'Active Offers'}**.\nTry searching for another skin (e.g. \`Hi-Score\`, \`Shark\`, \`Sinister\`) or switch modes!`
    });
  }

  let currentIndex = 0;
  let normalized = normalizeTrade(filtered[currentIndex], mode, priceMap, catalog);
  let cardBuf = await renderTradeCard(normalized, { index: currentIndex, totalCount: filtered.length });
  let attachment = new AttachmentBuilder(cardBuf, { name: 'trade.png' });

  const message = await interaction.editReply({
    embeds: [buildEmbed(normalized, currentIndex, filtered.length, query, mode)],
    files: [attachment],
    components: [buildButtons(currentIndex, filtered.length, mode)]
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: 'Use your own `/trade` or `.trade` command to browse trades!', ephemeral: true });
    }

    await btn.deferUpdate();

    if (btn.customId === 'trade_prev') {
      currentIndex = Math.max(0, currentIndex - 1);
    } else if (btn.customId === 'trade_next') {
      currentIndex = Math.min(filtered.length - 1, currentIndex + 1);
    } else if (btn.customId === 'trade_toggle_mode') {
      mode = mode === 'active' ? 'history' : 'active';
      if (mode === 'history' && !historyList) {
        historyList = await fetchTradeHistory();
      } else if (mode === 'active' && !activeList) {
        activeList = await fetchLiveTrades();
      }
      currentPool = mode === 'history' ? historyList : activeList;
      filtered = filterTrades(currentPool, query, mode);
      currentIndex = 0;
      if (filtered.length === 0) {
        return interaction.editReply({
          content: `No trades found for "${query}" in ${mode === 'history' ? 'Trade History' : 'Active Offers'}.`,
          embeds: [],
          files: [],
          components: [buildButtons(0, 0, mode)]
        });
      }
    }

    normalized = normalizeTrade(filtered[currentIndex], mode, priceMap, catalog);
    cardBuf = await renderTradeCard(normalized, { index: currentIndex, totalCount: filtered.length });
    attachment = new AttachmentBuilder(cardBuf, { name: 'trade.png' });

    await interaction.editReply({
      content: null,
      embeds: [buildEmbed(normalized, currentIndex, filtered.length, query, mode)],
      files: [attachment],
      components: [buildButtons(currentIndex, filtered.length, mode)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('trade_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('trade_next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('trade_closed').setLabel('Session Expired').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setLabel('🌐 View on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch {}
  });
}

export async function executePrefix(message, args = []) {
  let mode = 'active';
  let queryParts = [...args];

  if (queryParts.length > 0) {
    const first = queryParts[0].toLowerCase();
    if (first === 'history' || first === 'past' || first === 'completed') {
      mode = 'history';
      queryParts.shift();
    } else if (first === 'active' || first === 'live' || first === 'open') {
      mode = 'active';
      queryParts.shift();
    }
  }

  const query = queryParts.join(' ').trim();

  await message.channel.sendTyping();

  const [priceMap, catalog] = await Promise.all([
    getBoltPriceMap(),
    getPublicCatalog()
  ]);

  let activeList = null;
  let historyList = null;

  if (mode === 'history') {
    historyList = await fetchTradeHistory();
  } else {
    activeList = await fetchLiveTrades();
  }

  let currentPool = mode === 'history' ? historyList : activeList;
  let filtered = filterTrades(currentPool, query, mode);

  if (filtered.length === 0) {
    return message.reply(`❌ No trades found matching "${query}" in **${mode === 'history' ? 'Trade History' : 'Active Offers'}**.\nTry searching for another skin (e.g. \`.trade Shark\`, \`.trade Hi-Score\`) or use \`.trade history\`!`);
  }

  let currentIndex = 0;
  let normalized = normalizeTrade(filtered[currentIndex], mode, priceMap, catalog);
  let cardBuf = await renderTradeCard(normalized, { index: currentIndex, totalCount: filtered.length });
  let attachment = new AttachmentBuilder(cardBuf, { name: 'trade.png' });

  const replyMsg = await message.reply({
    embeds: [buildEmbed(normalized, currentIndex, filtered.length, query, mode)],
    files: [attachment],
    components: [buildButtons(currentIndex, filtered.length, mode)]
  });

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== message.author.id) {
      return btn.reply({ content: 'Use your own `.trade` command to browse trades!', ephemeral: true });
    }

    await btn.deferUpdate();

    if (btn.customId === 'trade_prev') {
      currentIndex = Math.max(0, currentIndex - 1);
    } else if (btn.customId === 'trade_next') {
      currentIndex = Math.min(filtered.length - 1, currentIndex + 1);
    } else if (btn.customId === 'trade_toggle_mode') {
      mode = mode === 'active' ? 'history' : 'active';
      if (mode === 'history' && !historyList) {
        historyList = await fetchTradeHistory();
      } else if (mode === 'active' && !activeList) {
        activeList = await fetchLiveTrades();
      }
      currentPool = mode === 'history' ? historyList : activeList;
      filtered = filterTrades(currentPool, query, mode);
      currentIndex = 0;
      if (filtered.length === 0) {
        return replyMsg.edit({
          content: `No trades found for "${query}" in ${mode === 'history' ? 'Trade History' : 'Active Offers'}.`,
          embeds: [],
          files: [],
          components: [buildButtons(0, 0, mode)]
        });
      }
    }

    normalized = normalizeTrade(filtered[currentIndex], mode, priceMap, catalog);
    cardBuf = await renderTradeCard(normalized, { index: currentIndex, totalCount: filtered.length });
    attachment = new AttachmentBuilder(cardBuf, { name: 'trade.png' });

    await replyMsg.edit({
      content: null,
      embeds: [buildEmbed(normalized, currentIndex, filtered.length, query, mode)],
      files: [attachment],
      components: [buildButtons(currentIndex, filtered.length, mode)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('trade_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('trade_next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('trade_closed').setLabel('Session Expired').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setLabel('🌐 View on KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app/trades')
      );
      await replyMsg.edit({ components: [disabledRow] });
    } catch {}
  });
}
