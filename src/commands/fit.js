import { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchUserProfile, fetchUserInventory, getPublicCatalog } from '../api/kirka.js';
import { renderFitCard, FIT_POSES } from '../canvas/fitCard.js';
import { resolveKirkaTarget } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('fit')
  .setDescription('Show a Kirka player\'s fit in 3D, holding their primary like the in-game lobby')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username, player ID, or @DiscordUser')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('pose')
      .setDescription('Lobby pose')
      .setRequired(false)
      .addChoices(
        { name: 'Pose 1 (rifle across chest)', value: 'pose1' },
        { name: 'Pose 2 (low one-handed)', value: 'pose2' },
        { name: 'Pose 3 (relaxed)', value: 'pose3' }
      )
  );

// Short-lived cache so repeated requests for the same fit don't re-render
const renderCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;

async function buildFitReply(query, pose) {
  const profile = await fetchUserProfile(query);
  if (!profile) return { notFound: true };

  const cacheKey = `${profile.id}:${pose}`;
  const cached = renderCache.get(cacheKey);
  let png = cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.png : null;

  if (!png) {
    const [inventory, catalog] = await Promise.all([fetchUserInventory(profile.id), getPublicCatalog()]);
    png = await renderFitCard({ profile, inventory, catalog, pose });
    renderCache.set(cacheKey, { png, at: Date.now() });
    for (const [key, entry] of renderCache) {
      if (Date.now() - entry.at >= CACHE_TTL_MS) renderCache.delete(key);
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🧍 Open 3D Fit (rotate & try skins)')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kirkahub.online/fit/${encodeURIComponent(profile.shortId || profile.id)}`)
  );

  return {
    reply: {
      content: '☕ *Support 24/7 Hosting:* `.donate`',
      files: [new AttachmentBuilder(png, { name: 'fit.png' })],
      components: [row]
    },
    profile
  };
}

function outageMessage() {
  return '⚠️ **Kirka.io API Outage**: The Kirka profile database is currently experiencing issues. Please try again later!';
}

export async function execute(interaction) {
  await interaction.deferReply();

  const rawInput = interaction.options.getString('user');
  const pose = interaction.options.getString('pose') || 'pose1';
  const target = await resolveKirkaTarget(rawInput, { interaction });
  if (target.error) {
    return interaction.editReply({ content: target.error });
  }

  try {
    const result = await buildFitReply(target.query, pose);
    if (result.notFound) {
      const errorTarget = target.isMention ? `<@${target.targetDiscordId}> (${target.linked?.kirka_username || target.query})` : `**${target.query}**`;
      return interaction.editReply({ content: `❌ Could not find a Kirka player matching ${errorTarget}.` });
    }
    await interaction.editReply(result.reply);
  } catch (err) {
    console.error('Error executing fit command:', err);
    await interaction.editReply({
      content: err.message?.includes('Outage') ? outageMessage() : '⚠️ Failed to render the 3D fit image.'
    });
  }
}

// .fit [user] [pose1|pose2|pose3 or p1|p2|p3]
export async function executePrefix(message, args) {
  let pose = 'pose1';
  const rest = [...args];
  const last = rest[rest.length - 1]?.toLowerCase();
  const poseMatch = last?.match(/^p(?:ose)?([123])$/);
  if (poseMatch) {
    pose = FIT_POSES[Number(poseMatch[1]) - 1];
    rest.pop();
  }

  const target = await resolveKirkaTarget(rest.join(' '), { message });
  if (target.error) {
    return message.reply(target.error);
  }

  await message.channel.sendTyping();

  try {
    const result = await buildFitReply(target.query, pose);
    if (result.notFound) {
      const errorTarget = target.isMention ? `<@${target.targetDiscordId}> (${target.linked?.kirka_username || target.query})` : `**${target.query}**`;
      return message.reply(`❌ Could not find a Kirka player matching ${errorTarget}.`);
    }
    await message.reply(result.reply);
  } catch (err) {
    console.error('Error in prefix fit command:', err);
    await message.reply(err.message?.includes('Outage') ? outageMessage() : '⚠️ Failed to render the 3D fit image.');
  }
}
