import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isUserSubscribed, subscribeUser, unsubscribeUser } from '../utils/storeNotifier.js';

export const data = new SlashCommandBuilder()
  .setName('storeupdate')
  .setDescription('Subscribe or unsubscribe from real-time Kirka store drop and limited skin alerts')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Choose action')
      .setRequired(false)
      .addChoices(
        { name: '🔄 Toggle Subscription', value: 'toggle' },
        { name: '🔔 Subscribe', value: 'sub' },
        { name: '🔕 Unsubscribe', value: 'unsub' }
      )
  );

export function buildSubscriptionEmbed(isSubscribed, channelId, userTag) {
  if (isSubscribed) {
    return new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('🔔 Store Drop Notifications Active!')
      .setDescription(
        `Hey **${userTag}**, you are now **subscribed** to KirkaHub Store Alerts!\n\n` +
        `### 🎯 What you'll get alerted for:\n` +
        `• 🔥 **New Limited Drops:** Instant ping as soon as a limited unit skin appears.\n` +
        `• ⚠️ **Low Stock Warnings:** Alerts when limited units drop below critical thresholds.\n` +
        `• 🛑 **Sold Out Notifications:** Know when an exclusive skin is gone forever.\n` +
        `• 💥 **New Complete Sets & Rotations:** Never miss a bundle discount.\n\n` +
        `📍 **Target Channel:** <#${channelId}>\n` +
        `*You will be pinged here when an update drops.*`
      )
      .setFooter({ text: 'KirkaHub Store Notifier • Click Unsubscribe below anytime' })
      .setTimestamp();
  } else {
    return new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔕 Store Notifications Disabled')
      .setDescription(
        `Hey **${userTag}**, you have **unsubscribed** from store alerts.\n\n` +
        `You will no longer receive pings when new skins or limited stock drop.\n` +
        `You can re-subscribe anytime using \`.storeupdate\` or the button below.`
      )
      .setFooter({ text: 'KirkaHub Store Notifier' })
      .setTimestamp();
  }
}

export function buildSubscriptionButtons(isSubscribed) {
  return new ActionRowBuilder().addComponents(
    isSubscribed
      ? new ButtonBuilder()
          .setCustomId('store_sub_toggle')
          .setLabel('🔕 Unsubscribe')
          .setStyle(ButtonStyle.Danger)
      : new ButtonBuilder()
          .setCustomId('store_sub_toggle')
          .setLabel('🔔 Subscribe Again')
          .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('store_refresh')
      .setLabel('🏬 View Current Store')
      .setStyle(ButtonStyle.Primary)
  );
}

export async function execute(interaction) {
  await interaction.deferReply();
  const action = interaction.options.getString('action') || 'toggle';
  const userId = interaction.user.id;
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;
  const currentlySubbed = isUserSubscribed(userId);

  let newSubbedState = currentlySubbed;

  if (action === 'sub') {
    subscribeUser(userId, channelId, guildId);
    newSubbedState = true;
  } else if (action === 'unsub') {
    unsubscribeUser(userId);
    newSubbedState = false;
  } else {
    // Toggle
    if (currentlySubbed) {
      unsubscribeUser(userId);
      newSubbedState = false;
    } else {
      subscribeUser(userId, channelId, guildId);
      newSubbedState = true;
    }
  }

  const embed = buildSubscriptionEmbed(newSubbedState, channelId, interaction.user.username);
  const row = buildSubscriptionButtons(newSubbedState);

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

export async function executePrefix(message, args) {
  await message.channel.sendTyping();
  const userId = message.author.id;
  const channelId = message.channel.id;
  const guildId = message.guild?.id || null;
  const currentlySubbed = isUserSubscribed(userId);

  const arg = args[0]?.toLowerCase();
  let newSubbedState = currentlySubbed;

  if (arg === 'on' || arg === 'sub' || arg === 'subscribe') {
    subscribeUser(userId, channelId, guildId);
    newSubbedState = true;
  } else if (arg === 'off' || arg === 'unsub' || arg === 'unsubscribe') {
    unsubscribeUser(userId);
    newSubbedState = false;
  } else {
    // Default toggle
    if (currentlySubbed) {
      unsubscribeUser(userId);
      newSubbedState = false;
    } else {
      subscribeUser(userId, channelId, guildId);
      newSubbedState = true;
    }
  }

  const embed = buildSubscriptionEmbed(newSubbedState, channelId, message.author.username);
  const row = buildSubscriptionButtons(newSubbedState);

  await message.reply({
    embeds: [embed],
    components: [row]
  });
}
