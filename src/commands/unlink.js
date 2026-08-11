import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';
import { getLinkedAccount, deleteLinkedAccount } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Unlink your Discord account from your Kirka profile')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  const discordId = interaction.user.id;

  // 1. Check if user is linked
  const existing = await getLinkedAccount(discordId);
  if (!existing) {
    return interaction.reply({
      content: `❌ You do not have a Kirka account linked to your Discord profile. Use \`/link\` to link one.`,
      flags: 64 // ephemeral
    });
  }

  // 2. Create confirmation buttons
  const confirmButton = new ButtonBuilder()
    .setCustomId('unlink_confirm')
    .setLabel('Yes, Unlink')
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId('unlink_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

  // 3. Create Embed presentation
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Unlink Kirka Account')
    .setDescription(`Are you sure you want to unlink your Discord account from Kirka profile **${existing.name}** (\`#${existing.shortId}\`)?\n\nYou can re-link at any time using \`/link\`.`)
    .setColor('#ef4444')
    .setTimestamp();

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64 // ephemeral
  });

  // 4. Create Message Component Collector
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 1000 // 1 minute
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'unlink_confirm') {
      await i.deferUpdate();
      collector.stop('unlinked');

      try {
        await deleteLinkedAccount(discordId);
        
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Account Unlinked')
          .setDescription(`Successfully unlinked your Discord account from Kirka profile **${existing.name}** (\`#${existing.shortId}\`).\n\nYou can re-link any time using \`/link\`.`)
          .setColor('#22c55e')
          .setTimestamp();

        await interaction.editReply({
          embeds: [successEmbed],
          components: []
        });
      } catch (err) {
        await interaction.editReply({
          content: '⚠️ An error occurred while trying to unlink your account. Please try again later.',
          embeds: [],
          components: []
        });
      }
    } else if (i.customId === 'unlink_cancel') {
      collector.stop('cancelled');

      await interaction.editReply({
        content: '❌ Unlink request cancelled.',
        embeds: [],
        components: []
      });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: '⏳ Unlink request timed out.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}

export async function executePrefix(message) {
  const discordId = message.author.id;

  // 1. Check if user is linked
  const existing = await getLinkedAccount(discordId);
  if (!existing) {
    return message.reply(`❌ You do not have a Kirka account linked to your Discord profile. Use \`/link\` to link one.`);
  }

  // 2. Create confirmation buttons
  const confirmButton = new ButtonBuilder()
    .setCustomId('unlink_confirm')
    .setLabel('Yes, Unlink')
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId('unlink_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

  // 3. Create Embed presentation
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Unlink Kirka Account')
    .setDescription(`Are you sure you want to unlink your Discord account from Kirka profile **${existing.name}** (\`#${existing.shortId}\`)?\n\nYou can re-link at any time using \`/link\`.`)
    .setColor('#ef4444')
    .setTimestamp();

  const response = await message.reply({
    embeds: [embed],
    components: [row]
  });

  // 4. Create Message Component Collector
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 1000 // 1 minute
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== discordId) {
      return i.reply({ content: '⚠️ Only the user who ran the command can use these buttons.', flags: 64 });
    }

    if (i.customId === 'unlink_confirm') {
      await i.deferUpdate();
      collector.stop('unlinked');

      try {
        await deleteLinkedAccount(discordId);
        
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Account Unlinked')
          .setDescription(`Successfully unlinked your Discord account from Kirka profile **${existing.name}** (\`#${existing.shortId}\`).\n\nYou can re-link any time using \`/link\`.`)
          .setColor('#22c55e')
          .setTimestamp();

        await response.edit({
          embeds: [successEmbed],
          components: []
        });
      } catch (err) {
        await response.edit({
          content: '⚠️ An error occurred while trying to unlink your account. Please try again later.',
          embeds: [],
          components: []
        });
      }
    } else if (i.customId === 'unlink_cancel') {
      collector.stop('cancelled');

      await response.edit({
        content: '❌ Unlink request cancelled.',
        embeds: [],
        components: []
      });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      response.edit({
        content: '⏳ Unlink request timed out.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}
