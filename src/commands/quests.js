import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchQuests } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('Display active Kirka.io hourly, daily, weekly, or event quests')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Filter by quest type')
      .setRequired(false)
      .addChoices(
        { name: '⏰ Hourly', value: 'hourly' },
        { name: '📅 Daily', value: 'daily' },
        { name: '🗓️ Weekly', value: 'weekly' },
        { name: '🔥 Event', value: 'event' }
      )
  );

function buildQuestsEmbed(quests, typeFilter) {
  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(`📋 Kirka.io Active Quests ${typeFilter ? `(${typeFilter.toUpperCase()})` : ''}`)
    .setDescription(quests.length === 0 ? 'No active quests found.' : 'Here are the live quest objectives and rewards:')
    .setTimestamp();

  quests.forEach((q) => {
    // Format quest name: GAMES_PLAYED -> Games Played, KILLS_WITH_GUN -> Kills With Gun
    const nameFormatted = q.name
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const weaponDetail = q.weapon && q.weapon !== 'undefined' && q.weapon !== 'null'
      ? ` using **${q.weapon.charAt(0).toUpperCase() + q.weapon.slice(1).toLowerCase()}**`
      : '';

    const rewardsStr = q.rewards.map(r => {
      const amtStr = Number(r.amount || 0).toLocaleString();
      if (r.type === 'XP') return `✨ **${amtStr} XP**`;
      if (r.type === 'COINS') return `🪙 **${amtStr} Coins**`;
      if (r.type === 'DIAMONDS') return `💎 **${amtStr} Diamonds**`;
      if (r.item) return `🎁 **${r.item.name}** (${r.item.rarity})`;
      return `🎁 **${r.type}**`;
    }).join(' • ');

    const endCountdown = q.endedAt 
      ? `\n⏰ Ends: <t:${Math.floor(new Date(q.endedAt).getTime() / 1000)}:R>` 
      : '';

    const rarityBadge = q.rarity && q.rarity !== 'common' 
      ? ` [${q.rarity.toUpperCase()}]` 
      : '';

    embed.addFields({
      name: `🔹 ${nameFormatted}${rarityBadge} (${q.type})`,
      value: `• **Objective:** Reach **${Number(q.amount).toLocaleString()}** ${nameFormatted.toLowerCase()}${weaponDetail}.${endCountdown}\n• **Rewards:** ${rewardsStr || 'None'}\n`
    });
  });

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const type = interaction.options.getString('type');

  try {
    const quests = await fetchQuests(type);
    const embed = buildQuestsEmbed(quests, type);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing quests command:', err);
    await interaction.editReply('❌ Failed to retrieve quests. Please try again later.');
  }
}

export async function executePrefix(message, args) {
  const typeInput = args[0]?.toLowerCase();
  const validTypes = ['hourly', 'daily', 'weekly', 'event'];
  const type = validTypes.includes(typeInput) ? typeInput : null;

  await message.channel.sendTyping();

  try {
    const quests = await fetchQuests(type);
    const embed = buildQuestsEmbed(quests, type);
    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing quests prefix command:', err);
    await message.reply('⚠️ Failed to retrieve quests.');
  }
}
