import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOLDOWNS_FILE = path.join(__dirname, '../data/reminderCooldowns.json');

const TRACKER_BOT_GUILD_ID = '1545037736543653919';
const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';
// Cooldown: 48 hours (2 days)
const REMINDER_COOLDOWN_MS = 48 * 60 * 60 * 1000;

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
 * Checks if a polite community/suggestion reminder should be sent in this guild.
 * Triggers at most once every 1.5 - 2 days per server, with a random 1-in-5 chance during command usage.
 */
export async function maybeSendFeedbackReminder(channel, guild) {
  if (!guild || !channel) return;
  // Don't send in the tracker bot support server itself
  if (guild.id === TRACKER_BOT_GUILD_ID) return;

  const lastSent = cooldownMap[guild.id] || 0;
  const now = Date.now();

  // If 48 hours haven't passed since last reminder in this guild, skip
  if (now - lastSent < REMINDER_COOLDOWN_MS) return;

  // 1 in 5 chance (20%) so it feels natural and doesn't fire immediately on the first command
  if (Math.random() > 0.20) return;

  // Mark as sent immediately to avoid duplicate messages on concurrent commands
  cooldownMap[guild.id] = now;
  saveCooldowns();

  try {
    setTimeout(async () => {
      await channel.send({
        content: `💡 **Have an idea or feedback to improve KirkaHub?**\nJoin our official support & community server to pitch new features, report bugs, or chat with the developer: <${TRACKER_BOT_INVITE}> *(or use \`.suggest <idea>\`)*`
      }).catch(() => {});
    }, 1200);
  } catch (err) {
    // Ignore permissions/network errors
  }
}
