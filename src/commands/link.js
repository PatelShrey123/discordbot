import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';
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

  // 2. Generate a unique, recognizable token format custom to KirkaHub (kirkahub-0x[random_hex])
  const tokenValue = Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
  const token = `kirkahub-0x${tokenValue}`;

  // 3. Register token in pendingLinks map
  pendingLinks.set(token, { discordId });

  // 4. Create the Interactive Action Row buttons
  const doneButton = new ButtonBuilder()
    .setCustomId('link_done')
    .setLabel('Done')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId('link_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const chatButton = new ButtonBuilder()
    .setLabel('Chat')
    .setURL('https://kirka.io/')
    .setStyle(ButtonStyle.Link);

  const row = new ActionRowBuilder().addComponents(doneButton, cancelButton, chatButton);

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
        value: 'Send the chat message in-game and click the **Done** button below!' 
      }
    )
    .setFooter({ text: 'This verification code will expire in 5 minutes.' })
    .setTimestamp();

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64 // ephemeral
  });

  // 6. Create Message Component Collector to handle button interaction
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000 // 5 minutes
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'link_done') {
      await i.deferReply({ flags: 64 });

      // Check if they are successfully linked in database
      const linked = await getLinkedAccount(discordId);
      if (linked) {
        // Stop collector and edit parent message to success state
        collector.stop('success');
        
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Account Linked Successfully!')
          .setDescription(`Your Discord account is now linked to Kirka profile **${linked.name}** (\`#${linked.shortId}\`).`)
          .setColor('#22c55e')
          .setTimestamp();

        await interaction.editReply({
          embeds: [successEmbed],
          components: []
        });

        await i.editReply({ content: '✅ Link verified successfully!' });
      } else {
        await i.editReply({
          content: `❌ Code not detected in-game yet. Please ensure you sent \`${token}\` in the Kirka server lobby chat and click **Done** again!`
        });
      }
    } else if (i.customId === 'link_cancel') {
      collector.stop('cancelled');
      pendingLinks.delete(token);

      await interaction.editReply({
        content: '❌ Link request cancelled.',
        embeds: [],
        components: []
      });
    }
  });

  collector.on('end', (collected, reason) => {
    // If the 5 minutes timed out without successful linking
    if (reason === 'time' && pendingLinks.has(token)) {
      pendingLinks.delete(token);
      interaction.editReply({
        content: '⚠️ Verification code expired. Please run `/link` again to generate a new token.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}
