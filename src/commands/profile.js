import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { fetchUserProfile } from '../api/kirka.js';
import { renderProfileCard } from '../canvas/profileCard.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Display Kirka player profile card and stats')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username or player ID')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('user');

  const profile = await fetchUserProfile(query);
  if (!profile) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka player matching **${query}**. Please check the username or ID and try again.`
    });
  }

  try {
    const cardBuffer = await renderProfileCard(profile);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile-card.png' });

    await interaction.editReply({
      files: [attachment]
    });
  } catch (err) {
    console.error('Error executing profile command:', err);
    await interaction.editReply({
      content: `⚠️ Failed to render profile card image for **${profile.name}**.`
    });
  }
}
