import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('donate')
  .setDescription('Support KirkaHub with digital gift cards or boosts to help fund 24/7 server hosting')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View all donation methods, gift card options, and donor perks')
  )
  .addSubcommand(sub =>
    sub.setName('submit')
      .setDescription('Submit a gift card code or donation confirmation directly to the developer')
      .addStringOption(opt =>
        opt.setName('code')
          .setDescription('Enter the gift card code, link, or details')
          .setRequired(true)
      )
  );

const TRACKER_BOT_INVITE = 'https://discord.gg/3zStCadBtP';
const BOT_OWNER_ID = '728104078428733452'; // @tooexpert
const BUY_ME_A_CHAI_URL = 'https://www.buymeachai.in/xpert';
const CODASHOP_VALORANT_URL = 'https://www.codashop.com/en-in/valorant';
const SEAGM_VALORANT_URL = 'https://www.seagm.com/valorant-gift-card-india?ps=Search-Results:Related-cards';
const SEAGM_AMAZON_URL = 'https://www.seagm.com/amazon-gift-card-india?ps=Universal-Search';
const RIOT_ID = 'IMSMARTY#2254';

export function buildDonateEmbed() {
  return new EmbedBuilder()
    .setTitle('💎 Support KirkaHub Development & 24/7 Hosting')
    .setColor(0xf59e0b)
    .setDescription(
      `**KirkaHub** is 100% free and open for the entire Kirka.io community.\n` +
      `Your support directly funds high-speed cloud hosting, database servers, 3D skin rendering, and instant live trading feeds!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🇮🇳 Segment 1: Indian Donators (Direct UPI / Zero Leaks)\n` +
      `• **☕ Buy Me A Chai:** [buymeachai.in/xpert](${BUY_ME_A_CHAI_URL})\n` +
      `  *Instant UPI via Google Pay, PhonePe, Paytm, BHIM, and FamPay. Zero personal phone or email leaks!*\n` +
      `• **🎯 Codashop Valorant:** Top-up Riot ID \`${RIOT_ID}\` on [Codashop](${CODASHOP_VALORANT_URL}) for direct in-game VP.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🌍 Segment 2: International Donators (USA, Malaysia, Europe, Worldwide)\n` +
      `*Pay in your local currency with PayPal, Apple Pay, Google Pay, or Credit Card:*\n` +
      `• **🎯 Valorant Points (India Region):** [Buy on SEAGM](${SEAGM_VALORANT_URL})\n` +
      `• **📦 Amazon Pay Gift Card (India):** [Buy on SEAGM](${SEAGM_AMAZON_URL})\n` +
      `• **🎮 Steam Digital Gift Cards:** Send directly via Steam to auto-convert currency.\n\n` +
      `**📋 How to Submit Your Gift Card Code:**\n` +
      `1. Buy the India card code from the SEAGM link above.\n` +
      `2. Type \`.donate submit <your-code>\` right here.\n` +
      `3. The bot immediately hides your message for security and **DMs the code directly to developer @tooexpert**!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🌟 Donor Perks (What You Get):\n` +
      `• **⭐ Supporter Badge:** Permanent glowing badge on your **\`.profile\`** player card!\n` +
      `• **🏆 VIP Server Role:** Exclusive Supporter role in our official Discord server.\n` +
      `• **🚀 Priority Feature Requests:** Direct input on upcoming tools & features.`
    )
    .setFooter({ text: 'KirkaHub • Thank you for keeping our servers alive!' })
    .setTimestamp();
}

export function buildDonateButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('☕ Buy Me A Chai (UPI)')
      .setStyle(ButtonStyle.Link)
      .setURL(BUY_ME_A_CHAI_URL),
    new ButtonBuilder()
      .setLabel('🎯 SEAGM Valorant (Intl)')
      .setStyle(ButtonStyle.Link)
      .setURL(SEAGM_VALORANT_URL),
    new ButtonBuilder()
      .setLabel('📦 SEAGM Amazon (Intl)')
      .setStyle(ButtonStyle.Link)
      .setURL(SEAGM_AMAZON_URL),
    new ButtonBuilder()
      .setLabel('🚀 Tracker Bot Server')
      .setStyle(ButtonStyle.Link)
      .setURL(TRACKER_BOT_INVITE)
  );
}

export async function forwardDonation(client, { author, code, guildName }) {
  try {
    const owner = await client.users.fetch(BOT_OWNER_ID).catch(() => null);
    if (!owner) {
      console.error('[Donate] Could not fetch bot owner:', BOT_OWNER_ID);
      return false;
    }

    const donationEmbed = new EmbedBuilder()
      .setTitle('💰 New Donation / Gift Card Received!')
      .setColor(0x10b981)
      .setDescription(`**Submitted Details / Code:**\n\`\`\`${code}\`\`\``)
      .addFields(
        { name: '👤 Donor', value: `${author.tag} (\`${author.id}\`)`, inline: true },
        { name: '📍 Source Guild', value: guildName || 'Direct Message', inline: true }
      )
      .setThumbnail(author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'KirkaHub Donations • Direct DM to tooexpert' })
      .setTimestamp();

    await owner.send({
      content: `🔔 Hey <@${BOT_OWNER_ID}>, you received a new donation code from **${author.tag}**!`,
      embeds: [donationEmbed]
    });
    return true;
  } catch (err) {
    console.error('[Donate] Error DMing donation code to tooexpert:', err);
    return false;
  }
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand(false) || 'info';

  if (sub === 'submit') {
    const code = interaction.options.getString('code', true).trim();
    await interaction.deferReply({ flags: 64 });

    await forwardDonation(interaction.client, {
      author: interaction.user,
      code,
      guildName: interaction.guild ? interaction.guild.name : 'Direct Message'
    });

    const successEmbed = new EmbedBuilder()
      .setTitle('💖 Thank You for Your Support!')
      .setColor(0x10b981)
      .setDescription(
        `Your gift card / donation details have been securely delivered directly to the bot developer!\n\n` +
        `**Submitted Code / Details:**\n` +
        `> ||${code}||\n\n` +
        `Join our official server to claim your **\`⭐ Supporter\`** badge on your \`.profile\` card and VIP role!`
      )
      .setFooter({ text: 'KirkaHub • Thank you for keeping us online!' });

    return interaction.editReply({
      embeds: [successEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🚀 Join Server to Claim Perks')
            .setStyle(ButtonStyle.Link)
            .setURL(TRACKER_BOT_INVITE)
        )
      ]
    });
  }

  await interaction.reply({
    embeds: [buildDonateEmbed()],
    components: [buildDonateButtons()]
  });
}

export async function executePrefix(message, args = []) {
  if (args.length > 0 && args[0].toLowerCase() === 'submit') {
    const code = args.slice(1).join(' ').trim();
    if (!code) {
      return message.reply('⚠️ Please provide the gift card code or claim link! Usage: `.donate submit <your code>`');
    }

    await message.channel.sendTyping();
    await forwardDonation(message.client, {
      author: message.author,
      code,
      guildName: message.guild ? message.guild.name : 'Direct Message'
    });

    // Try deleting the user's message so their code isn't exposed in public chat
    try {
      await message.delete().catch(() => {});
    } catch {}

    const successEmbed = new EmbedBuilder()
      .setTitle('💖 Thank You for Your Support!')
      .setColor(0x10b981)
      .setDescription(
        `Your gift card / donation details have been securely sent directly to the bot developer!\n` +
        `*(Your message was automatically removed from public view for security).*\n\n` +
        `Join our official server to claim your **\`⭐ Supporter\`** badge on your \`.profile\` card and VIP role!`
      )
      .setFooter({ text: 'KirkaHub • Thank you for keeping us online!' });

    return message.channel.send({
      content: `<@${message.author.id}>`,
      embeds: [successEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🚀 Join Server to Claim Perks')
            .setStyle(ButtonStyle.Link)
            .setURL(TRACKER_BOT_INVITE)
        )
      ]
    });
  }

  await message.reply({
    embeds: [buildDonateEmbed()],
    components: [buildDonateButtons()]
  });
}
