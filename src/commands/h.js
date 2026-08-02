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
    bgUrl = attachment.url;
  } else if (url) {
    bgUrl = url.trim();
  }

  if (!bgUrl) {
    return interaction.editReply({
      content: '❌ Please provide a background image: either paste a direct link in the `url` option OR upload an image in the `image` attachment option.'
    });
  }

  // Basic image url check
  if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://')) {
    return interaction.editReply({
      content: '❌ Invalid image URL. It must start with `http://` or `https://`.'
    });
  }

  try {
    // 2. Save background mapping in Supabase (keyed by unique Kirka user ID)
    await setUserBackground(linked.id, bgUrl);

    return interaction.editReply({
      content: `✅ Successfully set custom profile background for your linked Kirka profile **${linked.name}**!\n🖼️ Link: <${bgUrl}>`
    });
  } catch (err) {
    console.error(`Failed to set background for ${linked.name}:`, err.message);
    return interaction.editReply({
      content: '⚠️ Failed to save background to database. Please check connection and try again.'
    });
  }
}
