import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('support')
  .setDescription('Join the official KirkaHub Tracker Bot server for help, updates, and feature suggestions')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';

export function buildSupportEmbed() {
  return new EmbedBuilder()
    .setTitle('🛠️ KirkaHub & Tracker Bot Support Server')
    .setColor(0x38bdf8)
    .setDescription(
      `Welcome! Join the official **KirkaHub Discord Server** to connect with the developer and community!\n\n` +
      `### 🌟 Why Join Our Server?\n` +
      `• **💡 Suggest Features & Ideas:** Have an idea to make KirkaHub better? Pitch it in our \`#ideas\` forum!\n` +
      `• **🐛 Report Bugs & Glitches:** Get quick fixes directly from the creator.\n` +
      `• **🎨 Custom Profile Backgrounds (\`.h\`):** Get help setting up and previewing animated profile cards.\n` +
      `• **📢 Early Updates & Drops:** Be the first to know about new commands, event updates, and store alerts.\n` +
      `• **🤝 Kirka Community:** Chat with fellow Kirka players, traders, and clan war competitors.\n\n` +
      `👉 **Click the button below to join us!**`
    )
    .addFields(
      { name: '🔗 Server Invite', value: `[discord.gg/3zStCadBtP](${TRACKER_BOT_INVITE})`, inline: true },
      { name: '🌐 Web Platform', value: '[kirkahub.vercel.app](https://kirkahub.vercel.app)', inline: true }
    )
    .setFooter({ text: 'KirkaHub • Official Community & Support' })
    .setTimestamp();
}

export function buildSupportButtons() {
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
  await interaction.reply({
    embeds: [buildSupportEmbed()],
    components: [buildSupportButtons()]
  });
}

export async function executePrefix(message) {
  await message.reply({
    embeds: [buildSupportEmbed()],
    components: [buildSupportButtons()]
  });
}
