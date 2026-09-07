import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getParsedStore } from '../api/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBS_FILE = path.join(DATA_DIR, 'storeSubscriptions.json');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'storeSnapshot.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Read subscriptions from local JSON
 */
export function getSubscriptions() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn('[StoreNotifier] Failed to read subscriptions:', err.message);
  }
  return [];
}

/**
 * Save subscriptions
 */
function saveSubscriptions(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[StoreNotifier] Failed to save subscriptions:', err.message);
    return false;
  }
}

/**
 * Check if a user is subscribed
 */
export function isUserSubscribed(userId) {
  const subs = getSubscriptions();
  return subs.some(s => s.userId === userId);
}

/**
 * Subscribe a user
 */
export function subscribeUser(userId, channelId, guildId = null) {
  const subs = getSubscriptions();
  const existingIdx = subs.findIndex(s => s.userId === userId);
  
  const entry = {
    userId,
    channelId,
    guildId,
    subscribedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    subs[existingIdx] = entry; // Update channel
    saveSubscriptions(subs);
    return { isNew: false, count: subs.length };
  } else {
    subs.push(entry);
    saveSubscriptions(subs);
    return { isNew: true, count: subs.length };
  }
}

/**
 * Unsubscribe a user
 */
export function unsubscribeUser(userId) {
  const subs = getSubscriptions();
  const newSubs = subs.filter(s => s.userId !== userId);
  const removed = newSubs.length < subs.length;
  if (removed) {
    saveSubscriptions(newSubs);
  }
  return { removed, count: newSubs.length };
}

/**
 * Read last known store snapshot
 */
function getLastSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[StoreNotifier] Failed to read last snapshot:', err.message);
  }
  return null;
}

/**
 * Save current snapshot
 */
function saveCurrentSnapshot(snapshot) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    console.warn('[StoreNotifier] Failed to save snapshot:', err.message);
  }
}

/**
 * Dispatch an alert embed to all subscribers
 */
async function broadcastAlert(client, title, description, imageUrl, fields = []) {
  const subs = getSubscriptions();
  if (subs.length === 0) return;

  console.log(`📣 [StoreNotifier] Broadcasting alert to ${subs.length} subscriber(s): "${title}"`);

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(title)
    .setDescription(description)
    .addFields(fields)
    .setURL('https://kirka.io/store')
    .setTimestamp();

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🏬 Open In-Game Store')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirka.io/store'),
    new ButtonBuilder()
      .setCustomId('store_sub_toggle')
      .setLabel('🔕 Notification Settings')
      .setStyle(ButtonStyle.Secondary)
  );

  for (const sub of subs) {
    try {
      const channel = await client.channels.fetch(sub.channelId).catch(() => null);
      if (channel) {
        await channel.send({
          content: `🔔 <@${sub.userId}> **Store Update Alert!**`,
          embeds: [embed],
          components: [row]
        });
      }
    } catch (err) {
      console.warn(`[StoreNotifier] Failed to send alert to channel ${sub.channelId} (User ${sub.userId}):`, err.message);
    }
  }
}

/**
 * Check for differences between previous snapshot and current live store
 */
export async function checkStoreChanges(client) {
  try {
    const currentStore = await getParsedStore();
    const lastSnapshot = getLastSnapshot();

    if (!lastSnapshot) {
      // First boot: save initial snapshot without spamming notifications
      console.log('📦 [StoreNotifier] Initial store snapshot saved. Monitoring for changes...');
      saveCurrentSnapshot(currentStore);
      return;
    }

    // 1. Detect New Limited Edition Drops
    const lastLimitedMap = new Map((lastSnapshot.limitedDrops || []).map(i => [i.name, i]));
    for (const currentItem of currentStore.limitedDrops) {
      const prevItem = lastLimitedMap.get(currentItem.name);

      if (!prevItem) {
        // Brand new limited drop!
        await broadcastAlert(
          client,
          `🚨 NEW LIMITED DROP: ${currentItem.name.toUpperCase()}!`,
          `A brand new limited edition skin has just dropped in the Kirka Store! Grab yours before it sells out!`,
          currentItem.renderUrl,
          [
            { name: '👤 Item Name', value: `**${currentItem.name}** (${currentItem.weapon})`, inline: true },
            { name: '💎 Diamond Price', value: `**${currentItem.priceDiamonds.toLocaleString()} 💎**`, inline: true },
            { name: '📦 Total Stock', value: `**${currentItem.remainingUnits} / ${currentItem.totalUnits} Units Available**`, inline: true }
          ]
        );
      } else {
        // Stock change detection (e.g. units decreased)
        if (prevItem.remainingUnits !== currentItem.remainingUnits && currentItem.remainingUnits !== null) {
          // Alert if stock is critically low (e.g. <= 5 units) or has sold out
          if (currentItem.isSoldOut && !prevItem.isSoldOut) {
            await broadcastAlert(
              client,
              `🛑 SOLD OUT: ${currentItem.name.toUpperCase()}!`,
              `**${currentItem.name}** has completely sold out of all **${currentItem.totalUnits} units**!`,
              currentItem.renderUrl,
              [
                { name: 'Item', value: `${currentItem.name} (${currentItem.weapon})`, inline: true },
                { name: 'Price', value: `${currentItem.priceDiamonds} 💎`, inline: true },
                { name: 'Status', value: '🛑 Out of Stock', inline: true }
              ]
            );
          } else if (currentItem.remainingUnits <= 5 && prevItem.remainingUnits > 5) {
            // Low stock warning!
            await broadcastAlert(
              client,
              `⚠️ CRITICAL STOCK: ${currentItem.name.toUpperCase()} ALMOST SOLD OUT!`,
              `Only **${currentItem.remainingUnits} units left** for **${currentItem.name}**!`,
              currentItem.renderUrl,
              [
                { name: 'Remaining Units', value: `🔥 **${currentItem.remainingUnits} / ${currentItem.totalUnits} left!**`, inline: true },
                { name: 'Price', value: `${currentItem.priceDiamonds.toLocaleString()} 💎`, inline: true }
              ]
            );
          }
        }
      }
    }

    // 2. Detect New Featured Complete Set
    if (currentStore.featuredSet && lastSnapshot.featuredSet) {
      if (currentStore.featuredSet.name !== lastSnapshot.featuredSet.name) {
        await broadcastAlert(
          client,
          `💥 NEW COMPLETE SET: ${currentStore.featuredSet.name.toUpperCase()} SET!`,
          `A new featured weapon bundle is now live in the store!`,
          currentStore.featuredSet.bannerImage || currentStore.featuredSet.items[0]?.renderUrl,
          [
            { name: 'Set Name', value: `**${currentStore.featuredSet.name}**`, inline: true },
            { name: 'Discount Price', value: `**${currentStore.featuredSet.priceDiamonds.toLocaleString()} 💎**`, inline: true },
            { name: 'Included Weapons', value: `${currentStore.featuredSet.items.length} weapon skins`, inline: true }
          ]
        );
      }
    }

    // Update saved snapshot
    saveCurrentSnapshot(currentStore);
  } catch (err) {
    console.error('[StoreNotifier] Error during store change check:', err.message);
  }
}

/**
 * Start recurring background polling
 */
export function startStoreNotifier(client) {
  console.log('🔔 [StoreNotifier] Starting Store & Drop Notification poller (Interval: 2 minutes)...');
  
  // Initial check after 10 seconds
  setTimeout(() => {
    checkStoreChanges(client);
  }, 10000);

  // Recurring check every 2 minutes
  setInterval(() => {
    checkStoreChanges(client);
  }, 120000);
}
