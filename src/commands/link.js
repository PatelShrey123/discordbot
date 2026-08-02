import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { pendingLinks } from '../utils/chatListener.js';
import { getLinkedAccount } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your Kirka profile')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  const discordId = interaction.user.id;

  // 1. Check if user is already linked
  const existing = await getLinkedAccount(discordId);
  if (existing) {
    return interaction.reply({
      content: `ℹ️ Your Discord account is already linked to Kirka user **${existing.name}** (\`#${existing.shortId}\`).`,
      flags: 64 // ephemeral
    });
  }

  // 2. Generate a unique, recognizable token format (e.g. kirkabot-0x[random_hex])
  const tokenValue = Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
  const token = `kirkabot-0x${tokenValue}`;

  // 3. Register token in pendingLinks map
  pendingLinks.set(token, { discordId });

  // 4. Set auto-expiry timeout (5 minutes)
  setTimeout(() => {
    if (pendingLinks.has(token)) {
      pendingLinks.delete(token);
    }
  }, 5 * 60 * 1000);

  // 5. Create Embed presentation
  const embed = new EmbedBuilder()
    .setTitle('🔗 Link your Kirka Account')
    .setDescription('Prove ownership of your Kirka profile by typing a temporary verification code in the game client.')
    .setColor('#fbbf24')
    .addFields(
      { 
        name: 'Step 1: Open Kirka.io', 
        value: 'Login with the Kirka account you wish to link.' 
      },
      { 
        name: 'Step 2: Enter Server Lobby', 
        value: 'Join any server or click the **Servers** button to open the global lobby chat.' 
      },
      { 
        name: 'Step 3: Send this exact message', 
        value: `\`\`\`\n${token}\n\`\`\`` 
      },
      { 
        name: 'Step 4: Done!', 
        value: 'Send the chat message in-game. The bot will automatically detect it and send you a confirmation DM!' 
      }
    )
    .setFooter({ text: 'This verification code will expire in 5 minutes.' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: 64 // ephemeral
  });
}
