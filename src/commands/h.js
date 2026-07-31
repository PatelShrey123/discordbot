import { SlashCommandBuilder } from 'discord.js';
import { fetchUserProfile } from '../api/kirka.js';
import { setUserBackground } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('h')
  .setDescription('Set a custom profile background for a Kirka account')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username or player ID you want to customize')
      .setRequired(true)
  )
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

  const query = interaction.options.getString('user');
  const url = interaction.options.getString('url');
  const attachment = interaction.options.getAttachment('image');

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

  // 1. Fetch Kirka profile to verify it exists and get their unique ID
  const profile = await fetchUserProfile(query);
  if (!profile) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka player matching **${query}**. Background was not set.`
    });
  }

  try {
    // 2. Save background mapping in Supabase (keyed by unique Kirka user ID)
    await setUserBackground(profile.id, bgUrl);

    return interaction.editReply({
      content: `✅ Successfully set custom profile background for **${profile.name}**!\n🖼️ Link: <${bgUrl}>`
    });
  } catch (err) {
    console.error(`Failed to set background for ${profile.name}:`, err.message);
    return interaction.editReply({
      content: '⚠️ Failed to save background to database. Please check connection and try again.'
    });
  }
}
