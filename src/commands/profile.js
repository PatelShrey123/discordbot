import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { fetchUserProfile } from '../api/kirka.js';
import { renderProfileCard } from '../canvas/profileCard.js';
import { getUserBackground, getLinkedAccount, getDiscordLinkedToKirka } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Display Kirka player profile card and stats')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username or player ID')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  
  let query = interaction.options.getString('user');
  if (!query) {
    const linked = await getLinkedAccount(interaction.user.id);
    if (!linked) {
      return interaction.editReply({
        content: `❌ You haven't linked a Kirka account yet. Use \`/link\` to bind your profile, or specify a user (e.g. \`/profile user:CrackedYOU\`).`
      });
    }
    query = linked.shortId;
  }

  const profile = await fetchUserProfile(query);
  if (!profile) {
    return interaction.editReply({
      content: `❌ Could not find a Kirka player matching **${query}**. Please check the username or ID and try again.`
    });
  }

  try {
    const customBg = await getUserBackground(profile.id);
    
    // Resolve Discord linked name if any exists
    let discordUsername = null;
    try {
      const linkedDiscordId = await getDiscordLinkedToKirka(profile.shortId);
      if (linkedDiscordId) {
        const linkedUser = await interaction.client.users.fetch(linkedDiscordId);
        if (linkedUser) {
          discordUsername = linkedUser.tag;
        }
      }
    } catch (dbErr) {
      console.warn('[Profile] Failed to fetch linked Discord details:', dbErr.message);
    }

    const cardBuffer = await renderProfileCard(profile, customBg, discordUsername);
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
