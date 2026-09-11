import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOLDOWNS_FILE = path.join(__dirname, '../data/reminderCooldowns.json');

const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';
const BUY_ME_A_CHAI_URL = 'https://www.buymeachai.in/xpert';
const SEAGM_VALORANT_URL = 'https://www.seagm.com/valorant-gift-card-india?ps=Search-Results:Related-cards';
const SEAGM_AMAZON_URL = 'https://www.seagm.com/amazon-gift-card-india?ps=Universal-Search';
const RIOT_ID = 'IMSMARTY#2254';

// Cooldown: 4 days per server
const REMINDER_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;

let cooldownMap = {};
try {
  if (fs.existsSync(COOLDOWNS_FILE)) {
    cooldownMap = JSON.parse(fs.readFileSync(COOLDOWNS_FILE, 'utf-8'));
  }
} catch (e) {
  cooldownMap = {};
}

function saveCooldowns() {
  try {
    const dir = path.dirname(COOLDOWNS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COOLDOWNS_FILE, JSON.stringify(cooldownMap, null, 2));
  } catch (e) {
    console.error('[FeedbackReminder] Failed to persist cooldowns:', e.message);
  }
}

/**
 * Builds the rich donation announcement embed & interactive buttons
 */
export function buildDonationReminderMessage() {
  const embed = new EmbedBuilder()
    .setTitle('☕ Keeping KirkaHub Running 24/7 Isn\'t Free...')
    .setColor(0xf59e0b)
    .setDescription(
      `Hey everyone! 👋 A quick message from the developer:\n\n` +
      `Keeping **KirkaHub** online 24/7 across all our servers with **real-time Bolt market valuations, live Kirka event scrapers, and HD profile rendering** costs real money every month.\n\n` +
      `Our dedicated cloud hosting, database bandwidth, and API listeners are currently funded **entirely out of pocket** so that the entire Kirka community can enjoy fast, zero-lag tracking without annoying paywalls or ads.\n\n` +
      `If KirkaHub has helped you track your stats, price your inventory, or browse live trades, please consider chipping in to help cover our server bills! Even ₹50 or a small gift card goes a huge way in keeping the bot alive.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🇮🇳 Indian Donators (Direct UPI / Zero Leaks):\n` +
      `• **Buy Me A Chai:** [buymeachai.in/xpert](${BUY_ME_A_CHAI_URL})\n` +
      `  *(Instant direct transfer via GPay, PhonePe, Paytm, BHIM, or FamPay)*\n` +
      `• **Codashop Valorant:** Top-up Riot ID \`${RIOT_ID}\` on Codashop.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🌍 International Donators (PayPal / Apple Pay / Cards):\n` +
      `• **🎯 Valorant Points (India):** [Buy on SEAGM](${SEAGM_VALORANT_URL})\n` +
      `• **📦 Amazon Pay (India):** [Buy on SEAGM](${SEAGM_AMAZON_URL})\n` +
      `• **Submit Code:** Type \`.donate submit <code>\` — the bot automatically hides it and DMs it directly to developer @tooexpert!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌟 **Perks:** Every donor receives a permanent glowing **⭐ Supporter Badge** on their \`.profile\` card + VIP role in our server!`
    )
    .setFooter({ text: 'KirkaHub • Support 24/7 Hosting: .donate' })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('☕ Indian Donator (UPI)')
      .setStyle(ButtonStyle.Link)
      .setURL(BUY_ME_A_CHAI_URL),
    new ButtonBuilder()
      .setLabel('🎯 SEAGM Valorant (Intl)')
      .setStyle(ButtonStyle.Link)
      .setURL(SEAGM_VALORANT_URL),
    new ButtonBuilder()
      .setLabel('📦 SEAGM Amazon (Intl)')
      .setStyle(ButtonStyle.Link)
      .setURL(SEAGM_AMAZON_URL),
    new ButtonBuilder()
      .setLabel('🚀 Join Community Server')
      .setStyle(ButtonStyle.Link)
      .setURL(TRACKER_BOT_INVITE)
  );

  return { embeds: [embed], components: [buttons] };
}

/**
 * Finds the ideal channel in a server to send the reminder:
 * 1. True #general / #chat / #main (most active first)
 * 2. #bot-commands / #commands / #spam (most active first)
 * 3. Most active non-system text channel in the server
 * 4. NEVER logs, mod, staff, audit, ticket, or voice channels!
 */
export function findBestReminderChannel(guild, fallbackChannel) {
  if (!guild || !guild.channels || !guild.channels.cache) return fallbackChannel;

  const me = guild.members?.me;

  // STRICT check: ONLY GuildText (type 0). NEVER voice (type 2), stage (type 13), category (type 4), threads, etc.
  const canSend = (ch) => {
    if (!ch || ch.type !== ChannelType.GuildText) return false;
    if (typeof ch.isThread === 'function' && ch.isThread()) return false;
    if (!me) return true;
    const perms = ch.permissionsFor(me);
    return perms && perms.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ]);
  };

  const getCleanName = (ch) => {
    try {
      return (ch.name || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    } catch {
      return (ch.name || '').toLowerCase();
    }
  };

  // Exclude system, logs, staff, ticket, and moderation channels
  const isExcluded = (clean) => {
    return /(log|audit|transcript|ticket|mod[-_]?chat|staff|admin|management|leader|officer|rule|welcome|announcement|update|self[-_]?role|autorole|reaction[-_]?role|blacklist|mute|jail|report|sancion|warning)/i.test(clean);
  };

  const candidates = guild.channels.cache.filter(c => canSend(c) && !isExcluded(getCleanName(c)));

  // 1. First priority: General / Chat / Main / Lounge (sorted by activity: highest snowflake ID = most recent message)
  const generalCandidates = candidates.filter(c => {
    const name = getCleanName(c);
    return /(general|chat|main|lounge|discussion|noi[-_]?chuyen|chitchat)/i.test(name);
  });

  if (generalCandidates.size > 0) {
    return generalCandidates.sort((a, b) => {
      const idA = BigInt(a.lastMessageId || 0);
      const idB = BigInt(b.lastMessageId || 0);
      return idB > idA ? 1 : idB < idA ? -1 : 0;
    }).first();
  }

  // 2. Second priority: Dedicated Bot Command / Spam
  const botCandidates = candidates.filter(c => {
    const name = getCleanName(c);
    return /(bot[-_]?command|bot[-_]?cmd|command|cmds|bot|spam)/i.test(name);
  });

  if (botCandidates.size > 0) {
    return botCandidates.sort((a, b) => {
      const idA = BigInt(a.lastMessageId || 0);
      const idB = BigInt(b.lastMessageId || 0);
      return idB > idA ? 1 : idB < idA ? -1 : 0;
    }).first();
  }

  // 3. Third priority: The single most active text channel in the guild
  if (candidates.size > 0) {
    return candidates.sort((a, b) => {
      const idA = BigInt(a.lastMessageId || 0);
      const idB = BigInt(b.lastMessageId || 0);
      return idB > idA ? 1 : idB < idA ? -1 : 0;
    }).first();
  }

  // 4. Fallback: current channel if sendable
  if (canSend(fallbackChannel)) return fallbackChannel;
  return null;
}

/**
 * Checks if a donation reminder should be sent in this guild.
 * Triggers at most once every 4 days per server during command usage.
 */
export async function maybeSendFeedbackReminder(channel, guild) {
  if (!guild || !channel) return;

  const lastSent = cooldownMap[guild.id] || 0;
  const now = Date.now();

  // If 4 days haven't passed since last reminder in this guild, skip
  if (now - lastSent < REMINDER_COOLDOWN_MS) return;

  // 25% chance (1 in 4) on command execution so it feels natural
  if (Math.random() > 0.25) return;

  // Mark as sent immediately to avoid race conditions
  cooldownMap[guild.id] = now;
  saveCooldowns();

  try {
    const targetChannel = findBestReminderChannel(guild, channel);
    if (!targetChannel) return;

    setTimeout(async () => {
      try {
        const payload = buildDonationReminderMessage();
        await targetChannel.send(payload);
        console.log(`[DonationReminder] Sent 4-day reminder to guild "${guild.name}" (#${targetChannel.name})`);
      } catch (sendErr) {
        console.warn(`[DonationReminder] Could not send to #${targetChannel.name}:`, sendErr.message);
      }
    }, 1500);
  } catch (err) {
    console.error('[DonationReminder] Error running reminder:', err);
  }
}

/**
 * Direct send helper for testing or administrative triggers
 */
export async function sendDonationReminder(targetChannel) {
  if (!targetChannel) return false;
  const payload = buildDonationReminderMessage();
  return await targetChannel.send(payload);
}
