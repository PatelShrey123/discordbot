import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { fetchUserProfile } from '../api/kirka.js';
import { renderProfileCard } from '../canvas/profileCard.js';
import { getUserBackground, getLinkedAccount, getDiscordLinkedToKirka, resolveKirkaTarget } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Display Kirka player profile card and stats')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('Kirka username, player ID, or @DiscordUser')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  
  const rawInput = interaction.options.getString('user');
  const target = await resolveKirkaTarget(rawInput, { interaction });
  if (target.error) {
    return interaction.editReply({ content: target.error });
  }
  const query = target.query;

  let profile;
  try {
    profile = await fetchUserProfile(query);
  } catch (err) {
    if (err.message.includes('Outage')) {
      return interaction.editReply({
        content: `⚠️ **Kirka.io API Outage**: The Kirka profile database is currently experiencing issues and returned a 500 Internal Server Error. This is an official Kirka API server outage. Please try again later!`
      });
    }
  }

  if (!profile) {
    const errorTarget = target.isMention ? `<@${target.targetDiscordId}> (${target.linked?.kirka_username || query})` : `**${query}**`;
    return interaction.editReply({
      content: `❌ Could not find a Kirka player matching ${errorTarget}. Please check the username or ID and try again.`
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
      content: '☕ *Support 24/7 Hosting:* `.donate`',
      files: [attachment]
    });
  } catch (err) {
    console.error('Error executing profile command:', err);
    await interaction.editReply({
      content: `⚠️ Failed to render profile card image for **${profile.name}**.`
    });
  }
}
