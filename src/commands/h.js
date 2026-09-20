import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getLinkedAccount, setUserBackground } from '../api/db.js';
import { canUseGifBackground } from '../utils/vip.js';

const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';

function buildVipPromoEmbed() {
  return new EmbedBuilder()
    .setTitle('✨ Premium VIP Feature: Animated GIF Backgrounds')
    .setColor(0xA855F7)
    .setDescription(
      `Animated GIF profile backgrounds are an exclusive premium perk reserved for **KirkaHub VIPs & Donators**!\n\n` +
      `⭐ **How to unlock Animated GIF backgrounds:**\n` +
      `• Support 24/7 server hosting via \`.donate\` or \`/donate\`\n` +
      `• Contact the developer (**@tooexpert**) to activate VIP perks for your account!\n\n` +
      `ℹ️ *Note: Static image backgrounds (PNG, JPG, WebP) remain **100% free** for all linked players.*`
    )
    .setFooter({ text: 'KirkaHub VIP • Elevate your profile card' });
}

function buildVipPromoButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('💎 How to Donate')
      .setStyle(ButtonStyle.Link)
      .setURL(TRACKER_BOT_INVITE),
    new ButtonBuilder()
      .setLabel('💬 Contact Developer')
      .setStyle(ButtonStyle.Link)
      .setURL(TRACKER_BOT_INVITE)
  );
}

async function isGifSource({ url, attachment, buffer, mimeType } = {}) {
  if (buffer && buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return true;
  }
  if (mimeType && mimeType.toLowerCase().includes('image/gif')) {
    return true;
  }
  if (attachment) {
    if (attachment.contentType && attachment.contentType.toLowerCase().includes('image/gif')) return true;
    if (attachment.name && attachment.name.toLowerCase().endsWith('.gif')) return true;
  }
  if (url) {
    const lower = url.toLowerCase();
    if (lower.startsWith('data:image/gif')) return true;
    if (lower.includes('.gif') || lower.includes('format=gif')) return true;

    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        const ct = res.headers.get('content-type');
        if (ct && ct.toLowerCase().includes('image/gif')) return true;
      } catch (_) {}
    }
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('h')
  .setDescription('Set a custom profile background for your linked Kirka account')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('url')
      .setDescription('Direct link URL of the background image')
      .setRequired(false)
  )
  .addAttachmentOption(option =>
    option.setName('image')
      .setDescription('Upload background image directly')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const url = interaction.options.getString('url');
  const attachment = interaction.options.getAttachment('image');

  // 1. Verify that the Discord user has linked their account
  const linked = await getLinkedAccount(interaction.user.id);
  if (!linked || !linked.id) {
    return interaction.editReply({
      content: '❌ **Privacy Protection:** You must link your Kirka account to your Discord account first to customize your profile background.\n\nPlease link your profile first by running the **/link** command!'
    });
  }

  // Validate that at least one image source was provided
  let bgUrl = null;
  let isGif = false;

  if (attachment) {
    // Prevent Discord 24h CDN expiration by downloading and converting to a permanent Data URI
    try {
      const imgRes = await fetch(attachment.url);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const mimeType = attachment.contentType || imgRes.headers.get('content-type') || 'image/jpeg';
        isGif = await isGifSource({ url: attachment.url, attachment, buffer: buf, mimeType });
        bgUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } else {
        bgUrl = attachment.url;
        isGif = await isGifSource({ url: attachment.url, attachment, mimeType: attachment.contentType });
      }
    } catch (err) {
      console.warn('[Command: /h] Failed to convert attachment to data URI:', err.message);
      bgUrl = attachment.url;
      isGif = await isGifSource({ url: attachment.url, attachment, mimeType: attachment.contentType });
    }
  } else if (url) {
    bgUrl = url.trim();

    // If user pasted an expiring Discord CDN URL, download and convert to permanent Data URI
    if (bgUrl.includes('cdn.discordapp.com/attachments') || bgUrl.includes('cdn.discordapp.com/ephemeral-attachments')) {
      try {
        const imgRes = await fetch(bgUrl);
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          isGif = await isGifSource({ url: bgUrl, buffer: buf, mimeType: contentType });
          bgUrl = `data:${contentType};base64,${buf.toString('base64')}`;
        }
      } catch (err) {
        console.warn('[Command: /h] Failed to convert pasted Discord link to data URI:', err.message);
      }
    }
    if (!isGif) {
      isGif = await isGifSource({ url: bgUrl });
    }
  }

  if (!bgUrl) {
    return interaction.editReply({
      content: '❌ Please provide a background image: either paste a direct link in the `url` option OR upload an image in the `image` attachment option.'
    });
  }

  // Basic image url check
  if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://') && !bgUrl.startsWith('data:image/')) {
    return interaction.editReply({
      content: '❌ Invalid image URL. It must start with `http://`, `https://`, or be an uploaded image.'
    });
  }

  // Check VIP permission for animated GIF backgrounds
  if (isGif) {
    const isAuthorized = canUseGifBackground({
      discordId: interaction.user.id,
      shortId: linked.shortId,
      kirkaId: linked.id
    });
    if (!isAuthorized) {
      return interaction.editReply({
        embeds: [buildVipPromoEmbed()],
        components: [buildVipPromoButtons()]
      });
    }
  }

  try {
    // 2. Save background mapping in Supabase (keyed by unique Kirka user ID)
    await setUserBackground(linked.id, bgUrl);

    return interaction.editReply({
      content: `✅ Successfully set custom profile background for your linked Kirka profile **${linked.name}**!\n🔒 Saved permanently to the database so it will **never expire or reset** when servers restart.`
    });
  } catch (err) {
    console.error(`Failed to set background for ${linked.name}:`, err.message);
    return interaction.editReply({
      content: '⚠️ Failed to save background to database. Please check connection and try again.'
    });
  }
}

export async function executePrefix(message) {
  await message.channel.sendTyping();
  console.log(`[MessageReceived] Matched .h for user: ${message.author.id}`);

  const linked = await getLinkedAccount(message.author.id);
  if (!linked || !linked.id) {
    return message.reply('❌ **Privacy Protection:** You must link your Kirka account to your Discord account first to customize your profile background.\n\nPlease link your profile first by running the `.link` command!');
  }

  const attachment = message.attachments.first();
  const content = message.content.trim();
  const args = content.substring(2).trim();

  let bgUrl = null;
  let isGif = false;

  if (attachment) {
    try {
      const imgRes = await fetch(attachment.url);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const mimeType = attachment.contentType || imgRes.headers.get('content-type') || 'image/jpeg';
        isGif = await isGifSource({ url: attachment.url, attachment, buffer: buf, mimeType });
        bgUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } else {
        bgUrl = attachment.url;
        isGif = await isGifSource({ url: attachment.url, attachment, mimeType: attachment.contentType });
      }
    } catch (err) {
      console.warn('[Command: .h] Failed to convert attachment to data URI:', err.message);
      bgUrl = attachment.url;
      isGif = await isGifSource({ url: attachment.url, attachment, mimeType: attachment.contentType });
    }
  } else if (args) {
    bgUrl = args.split(' ')[0].trim();
    if (bgUrl.includes('cdn.discordapp.com/attachments') || bgUrl.includes('cdn.discordapp.com/ephemeral-attachments')) {
      try {
        const imgRes = await fetch(bgUrl);
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          isGif = await isGifSource({ url: bgUrl, buffer: buf, mimeType: contentType });
          bgUrl = `data:${contentType};base64,${buf.toString('base64')}`;
        }
      } catch (err) {
        console.warn('[Command: .h] Failed to convert pasted Discord link to data URI:', err.message);
      }
    }
    if (!isGif) {
      isGif = await isGifSource({ url: bgUrl });
    }
  }

  if (!bgUrl) {
    return message.reply('❌ Please provide a background image: either paste a direct link after `.h` OR upload an image alongside the `.h` message.');
  }

  if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://') && !bgUrl.startsWith('data:image/')) {
    return message.reply('❌ Invalid image URL. It must start with `http://`, `https://`, or be an uploaded image.');
  }

  // Check VIP permission for animated GIF backgrounds
  if (isGif) {
    const isAuthorized = canUseGifBackground({
      discordId: message.author.id,
      shortId: linked.shortId,
      kirkaId: linked.id
    });
    if (!isAuthorized) {
      return message.reply({
        embeds: [buildVipPromoEmbed()],
        components: [buildVipPromoButtons()]
      });
    }
  }

  try {
    await setUserBackground(linked.id, bgUrl);
    return message.reply(`✅ Successfully set custom profile background for your linked Kirka profile **${linked.name}**!\n🔒 Saved permanently to the database so it will **never expire or reset** when servers restart.`);
  } catch (err) {
    console.error(`Failed to set background for ${linked.name}:`, err.message);
    return message.reply('⚠️ Failed to save background to database. Please check connection and try again.');
  }
}

