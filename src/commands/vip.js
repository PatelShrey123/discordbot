import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchUserProfile } from '../api/kirka.js';
import { getVipProfileInfo } from '../utils/vip.js';

// Members shown by /vip (tier styling still comes from utils/vip.js)
const SHOWCASED_VIPS = ['CARSON', 'FUYR7K', 'TTTVBJ'];

export const data = new SlashCommandBuilder()
  .setName('vip')
  .setDescription('Show KirkaHub VIP members')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

let cachedMembers = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function loadMembers() {
  if (cachedMembers && Date.now() - cachedAt < CACHE_TTL_MS) return cachedMembers;

  const members = await Promise.all(
    SHOWCASED_VIPS.map(async (shortId) => {
      let profile = null;
      try {
        profile = await fetchUserProfile(shortId);
      } catch (err) {
        console.warn(`[VIP] Failed to fetch profile for #${shortId}:`, err.message);
      }
      const vip = getVipProfileInfo(profile || { shortId });
      return {
        shortId,
        name: profile?.name || null,
        level: profile?.level ?? null,
        clan: profile?.clan || null,
        tag: vip?.tag || '⚡ VIP',
      };
    })
  );

  // Only cache when every profile resolved, so an API hiccup doesn't stick for 10 minutes
  if (members.every((m) => m.name)) {
    cachedMembers = members;
    cachedAt = Date.now();
  }
  return members;
}

async function buildVipEmbed() {
  const members = await loadMembers();
  const lines = members.map((m) => {
    const name = m.name ? `**${m.name}**` : '**Unknown player**';
    const details = [m.level != null ? `Lvl ${m.level}` : null, m.clan ? `[${m.clan}]` : null].filter(Boolean).join(' • ');
    return `${m.tag} ${name} \`#${m.shortId}\`${details ? `\n╰ ${details} • [Profile](https://kirkahub.online/player/${m.shortId})` : ''}`;
  });

  return new EmbedBuilder()
    .setColor('#A855F7')
    .setTitle('⚡ KirkaHub VIP Members')
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: 'Support 24/7 hosting with .donate' })
    .setTimestamp();
}

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    await interaction.editReply({ embeds: [await buildVipEmbed()] });
  } catch (err) {
    console.error('Error executing vip command:', err);
    await interaction.editReply('⚠️ Failed to load VIP members.');
  }
}

export async function executePrefix(message) {
  await message.channel.sendTyping();
  try {
    await message.reply({ embeds: [await buildVipEmbed()] });
  } catch (err) {
    console.error('Error executing vip prefix command:', err);
    await message.reply('⚠️ Failed to load VIP members.');
  }
}
