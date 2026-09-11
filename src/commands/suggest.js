import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Submit a feature suggestion or improvement idea directly to the KirkaHub developers')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('idea')
      .setDescription('Describe your suggestion or feature idea')
      .setRequired(true)
  );

const IDEAS_CHANNEL_ID = '1545086953127547022';
const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';

export async function forwardSuggestion(client, { author, idea, guildName }) {
  try {
    const channel = await client.channels.fetch(IDEAS_CHANNEL_ID).catch(() => null);
    if (!channel) return false;

    const ideaEmbed = new EmbedBuilder()
      .setTitle('💡 New KirkaHub Suggestion')
      .setColor(0xf59e0b)
      .setDescription(idea)
      .addFields(
        { name: '👤 Suggested By', value: `${author.tag} (\`${author.id}\`)`, inline: true },
        { name: '📍 Source Server', value: guildName || 'Direct Message', inline: true }
      )
      .setThumbnail(author.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: 'KirkaHub Community Ideas • Vote below with reactions!' });

    const sentMsg = await channel.send({ embeds: [ideaEmbed] });
    await sentMsg.react('👍').catch(() => {});
    await sentMsg.react('👎').catch(() => {});
    return true;
  } catch (err) {
    console.error('[Suggest] Failed to forward suggestion to #ideas:', err);
    return false;
  }
}

export function buildSuccessEmbed(idea) {
  return new EmbedBuilder()
    .setTitle('✅ Suggestion Submitted!')
    .setColor(0x10b981)
    .setDescription(
      `Thank you for helping us improve **KirkaHub**!\n\n` +
      `**Your Suggestion:**\n` +
      `> *"${idea}"*\n\n` +
      `Your idea has been forwarded directly to the developer and posted in our **#ideas** channel for review and voting.\n\n` +
      `💬 **Want to discuss it or see progress?** Join our official Tracker Bot server!`
    )
    .setFooter({ text: 'KirkaHub Feedback • Powered by community ideas' });
}

export function buildSuggestButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🚀 Join Tracker Bot Server')
      .setStyle(ButtonStyle.Link)
      .setURL(TRACKER_BOT_INVITE),
    new ButtonBuilder()
      .setLabel('🌐 Open KirkaHub Website')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app')
  );
}

export async function execute(interaction) {
  const idea = interaction.options.getString('idea', true).trim();

  if (idea.length < 5) {
    return interaction.reply({
      content: '⚠️ Please provide a slightly more descriptive suggestion (at least 5 characters)!',
      ephemeral: true
    });
  }

  await interaction.deferReply();

  await forwardSuggestion(interaction.client, {
    author: interaction.user,
    idea,
    guildName: interaction.guild ? interaction.guild.name : 'Direct Message'
  });

  await interaction.editReply({
    embeds: [buildSuccessEmbed(idea)],
    components: [buildSuggestButtons()]
  });
}

export async function executePrefix(message, args = []) {
  const idea = args.join(' ').trim();

  if (!idea) {
    const usageEmbed = new EmbedBuilder()
      .setTitle('💡 KirkaHub Suggestion System')
      .setColor(0x38bdf8)
      .setDescription(
        `Have an idea to improve KirkaHub, new commands to add, or feedback for the bot?\n\n` +
        `**Usage:**\n` +
        `• \`.suggest <your idea or feedback>\`\n` +
        `• \`/suggest idea:<your idea>\`\n\n` +
        `*Example:* \`.suggest add an alert when my friends come online\`\n\n` +
        `Every suggestion is sent directly to the bot developer in our official server!`
      )
      .setFooter({ text: 'KirkaHub • Official Community & Feedback' });

    return message.reply({
      embeds: [usageEmbed],
      components: [buildSuggestButtons()]
    });
  }

  if (idea.length < 5) {
    return message.reply('⚠️ Please provide a slightly more descriptive suggestion (at least 5 characters)!');
  }

  await message.channel.sendTyping();

  await forwardSuggestion(message.client, {
    author: message.author,
    idea,
    guildName: message.guild ? message.guild.name : 'Direct Message'
  });

  await message.reply({
    embeds: [buildSuccessEmbed(idea)],
    components: [buildSuggestButtons()]
  });
}
