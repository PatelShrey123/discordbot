import { SlashCommandBuilder } from 'discord.js';
import { getLinkedAccount, setUserBackground } from '../api/db.js';

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

  if (attachment) {
    // Prevent Discord 24h CDN expiration by downloading and converting to a permanent Data URI
    try {
      const imgRes = await fetch(attachment.url);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const mimeType = attachment.contentType || 'image/jpeg';
        bgUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } else {
        bgUrl = attachment.url;
      }
    } catch (err) {
      console.warn('[Command: /h] Failed to convert attachment to data URI:', err.message);
      bgUrl = attachment.url;
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
          bgUrl = `data:${contentType};base64,${buf.toString('base64')}`;
        }
      } catch (err) {
        console.warn('[Command: /h] Failed to convert pasted Discord link to data URI:', err.message);
      }
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

  if (attachment) {
    try {
      const imgRes = await fetch(attachment.url);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const mimeType = attachment.contentType || 'image/jpeg';
        bgUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } else {
        bgUrl = attachment.url;
      }
    } catch (err) {
      console.warn('[Command: .h] Failed to convert attachment to data URI:', err.message);
      bgUrl = attachment.url;
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
          bgUrl = `data:${contentType};base64,${buf.toString('base64')}`;
        }
      } catch (err) {
        console.warn('[Command: .h] Failed to convert pasted Discord link to data URI:', err.message);
      }
    }
  }

  if (!bgUrl) {
    return message.reply('❌ Please provide a background image: either paste a direct link after `.h` OR upload an image alongside the `.h` message.');
  }

  if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://') && !bgUrl.startsWith('data:image/')) {
    return message.reply('❌ Invalid image URL. It must start with `http://`, `https://`, or be an uploaded image.');
  }

  try {
    await setUserBackground(linked.id, bgUrl);
    return message.reply(`✅ Successfully set custom profile background for your linked Kirka profile **${linked.name}**!\n🔒 Saved permanently to the database so it will **never expire or reset** when servers restart.`);
  } catch (err) {
    console.error(`Failed to set background for ${linked.name}:`, err.message);
    return message.reply('⚠️ Failed to save background to database. Please check connection and try again.');
  }
}

