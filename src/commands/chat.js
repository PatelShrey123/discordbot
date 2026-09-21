import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getRecentChat } from '../utils/chatListener.js';
import { buildChatBlock } from '../utils/chatFormat.js';

export const data = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Show what Kirka global chat is saying right now')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addIntegerOption((o) =>
    o.setName('lines')
      .setDescription('How many messages to show (default 15, max 25)')
      .setMinValue(5)
      .setMaxValue(25)
      .setRequired(false)
  )
  .addBooleanOption((o) =>
    o.setName('trades')
      .setDescription('Include SERVER trade offer lines (default yes)')
      .setRequired(false)
  );

/** State lives in the button id so the message can rebuild itself without a store. */
export function buildChatPayload(lines = 15, showTrades = true) {
  const rows = getRecentChat(lines, showTrades);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: 'Kirka Global Chat' })
    .setDescription(buildChatBlock(rows))
    .setFooter({ text: rows.length ? `last ${rows.length} messages` : 'buffer is still filling' })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`chat_refresh_${lines}_${showTrades ? 1 : 0}`)
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`chat_live_${lines}_${showTrades ? 1 : 0}`)
      .setLabel('Live 15s')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`chat_trades_${lines}_${showTrades ? 0 : 1}`)
      .setLabel(showTrades ? 'Hide trades' : 'Show trades')
      .setEmoji(showTrades ? '🔇' : '🔊')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

export async function execute(interaction) {
  const lines = interaction.options.getInteger('lines') ?? 15;
  const trades = interaction.options.getBoolean('trades');
  await interaction.reply(buildChatPayload(lines, trades === null ? true : trades));
}
