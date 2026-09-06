import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from '../api/boltPrices.js';
import { fetchUserInventory, fetchClanLeaderboard, fetchClan } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('richest')
  .setDescription('View the Top 10 wealthiest Kirka players ranked by inventory Bolt valuation')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

let wealthCache = null;
let wealthCacheTime = 0;
let isRefreshing = false;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

async function calculatePlayerNetWorth(userId, priceMap) {
  try {
    const inv = await fetchUserInventory(userId);
    if (!Array.isArray(inv) || inv.length === 0) return null;

    let totalVal = 0;
    let totalItems = 0;
    let mostValuableItem = null;
    let highestPrice = 0;

    for (const entry of inv) {
      const item = entry.item || entry;
      const qty = entry.amount || 1;
      const price = getItemPrice(priceMap, item);
      totalVal += price * qty;
      totalItems += qty;

      if (price > highestPrice) {
        highestPrice = price;
        mostValuableItem = item.name ? item.name.replace(/^_+/, '').trim() : null;
      }
    }

    return { totalVal, totalItems, mostValuableItem, highestPrice };
  } catch {
    return null;
  }
}

export async function getTopRichestPlayers() {
  const now = Date.now();
  if (wealthCache && (now - wealthCacheTime < 10 * 60 * 1000)) {
    return wealthCache;
  }

  // If already refreshing in background, return current cache or wait
  if (isRefreshing && wealthCache) return wealthCache;
  isRefreshing = true;

  try {
    const priceMap = await getBoltPriceMap();
    const candidateMap = new Map();

    // 1. Get linked accounts from Supabase
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/linked_accounts?select=kirka_id,kirka_username,short_id&limit=40`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const linked = await res.json();
        for (const u of (Array.isArray(linked) ? linked : [])) {
          if (u.kirka_id) {
            candidateMap.set(u.kirka_id, {
              id: u.kirka_id,
              name: u.kirka_username || 'Player',
              shortId: u.short_id || ''
            });
          }
        }
      }
    } catch {}

    // 2. Get top solo leaderboard players (first 2 pages = 40 players)
    try {
      const soloRes = await fetch('https://api.kirka.io/api/leaderboard/solo?limit=40', {
        headers: { 'ApiKey': process.env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060' }
      });
      if (soloRes.ok) {
        const soloData = await soloRes.json();
        const list = soloData.results || soloData || [];
        for (const u of list) {
          if (u.userId && !candidateMap.has(u.userId)) {
            candidateMap.set(u.userId, { id: u.userId, name: u.name, shortId: '' });
          }
        }
      }
    } catch {}

    // 3. Get top 3 clan rosters
    try {
      const clans = await fetchClanLeaderboard();
      for (let i = 0; i < Math.min(clans.length, 3); i++) {
        const cData = await fetchClan(clans[i].name);
        if (cData?.members) {
          for (const m of cData.members) {
            const u = m.user || m;
            const uid = u.id || u.userId;
            if (uid && !candidateMap.has(uid)) {
              candidateMap.set(uid, { id: uid, name: u.name, shortId: u.shortId || '' });
            }
          }
        }
      }
    } catch {}

    const candidates = Array.from(candidateMap.values());
    const scoredPlayers = [];

    // Scan in concurrent batches of 8
    for (let i = 0; i < candidates.length; i += 8) {
      const batch = candidates.slice(i, i + 8);
      await Promise.all(batch.map(async (p) => {
        const result = await calculatePlayerNetWorth(p.id, priceMap);
        if (result && result.totalVal > 0) {
          scoredPlayers.push({
            name: p.name,
            shortId: p.shortId,
            id: p.id,
            totalVal: result.totalVal,
            totalItems: result.totalItems,
            topSkin: result.mostValuableItem
          });
        }
      }));
      await new Promise(r => setTimeout(r, 60));
    }

    scoredPlayers.sort((a, b) => b.totalVal - a.totalVal);
    wealthCache = scoredPlayers.slice(0, 10);
    wealthCacheTime = Date.now();
    return wealthCache;
  } catch (err) {
    console.error('[Richest] Error generating wealth leaderboard:', err.message);
    return wealthCache || [];
  } finally {
    isRefreshing = false;
  }
}

const MEDALS = ['??', '??', '??', '4??', '5??', '6??', '7??', '8??', '9??', '??'];

function buildRichestEmbed(topPlayers) {
  const embed = new EmbedBuilder()
    .setTitle('?? Kirka Wealth Leaderboard • Top 10 Richest Inventories')
    .setColor('#f59e0b')
    .setDescription(
      topPlayers.length === 0
        ? '? Calculating player net worths from Bolt market valuations... Check back in a few moments!'
        : 'Ranked by total inventory valuation in **Bolts** using live community price sheets:'
    )
    .setFooter({ text: 'Bolt Valuations • Auto-refreshes every 10 minutes' })
    .setTimestamp();

  topPlayers.forEach((p, idx) => {
    const medal = MEDALS[idx] || `**#${idx + 1}**`;
    const handle = p.shortId ? `${p.name}#${p.shortId}` : p.name;
    const topSkinStr = p.topSkin ? ` • Crown: *${p.topSkin}*` : '';

    embed.addFields({
      name: `${medal} ${handle}`,
      value: `?? **${formatValueLong(p.totalVal)} Bolts** (${p.totalItems.toLocaleString()} items${topSkinStr})`,
      inline: false
    });
  });

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const topPlayers = await getTopRichestPlayers();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('?? Open KirkaHub Market')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app/trades')
  );

  return interaction.editReply({
    embeds: [buildRichestEmbed(topPlayers)],
    components: [row]
  });
}

export async function executePrefix(message) {
  await message.channel.sendTyping();
  const topPlayers = await getTopRichestPlayers();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('?? Open KirkaHub Market')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app/trades')
  );

  return message.reply({
    embeds: [buildRichestEmbed(topPlayers)],
    components: [row]
  });
}
