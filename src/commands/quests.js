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
    // 1. Build a simplified, highly attractive Objective Heading
    const nameLower = q.name.toLowerCase();
    let objectiveHeading = '';

    if (nameLower === 'games_played') {
      objectiveHeading = `🎮 Play ${Number(q.amount || 0).toLocaleString()} Games`;
    } else if (nameLower === 'kills') {
      objectiveHeading = `💀 Get ${Number(q.amount || 0).toLocaleString()} Kills`;
    } else if (nameLower === 'kills_with_gun') {
      const weaponName = q.weapon && q.weapon !== 'undefined' && q.weapon !== 'null'
        ? q.weapon.charAt(0).toUpperCase() + q.weapon.slice(1).toLowerCase()
        : 'any weapon';
      objectiveHeading = `🔫 Get ${Number(q.amount || 0).toLocaleString()} Kills with ${weaponName}`;
    } else if (nameLower === 'headshots') {
      objectiveHeading = `🎯 Get ${Number(q.amount || 0).toLocaleString()} Headshots`;
    } else if (nameLower === 'wins') {
      objectiveHeading = `🏆 Win ${Number(q.amount || 0).toLocaleString()} Games`;
    } else {
      const friendlyName = q.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      objectiveHeading = `🔹 Reach ${Number(q.amount || 0).toLocaleString()} ${friendlyName}`;
    }

    // Add Type Badge & Rarity if applicable
    const typeBadge = q.type ? `[${q.type.toUpperCase()}]` : '';
    const rarityBadge = q.rarity && q.rarity !== 'common' ? ` ★ ${q.rarity.toUpperCase()}` : '';
    const finalHeading = `${objectiveHeading} ${typeBadge}${rarityBadge}`;

    // 2. Format Rewards List
    const rewardsStr = q.rewards.map(r => {
      const amtStr = Number(r.amount || 0).toLocaleString();
      if (r.type === 'XP') return `✨ **${amtStr} XP**`;
      if (r.type === 'COINS') return `🪙 **${amtStr} Coins**`;
      if (r.type === 'DIAMONDS') return `💎 **${amtStr} Diamonds**`;
      if (r.item) return `🎁 **${r.item.name}** (${r.item.rarity})`;
      return `🎁 **${r.type}**`;
    }).join('  •  ');

    // 3. Format End Timer
    const endCountdown = q.endedAt 
      ? `\n⏰ **Ends:** <t:${Math.floor(new Date(q.endedAt).getTime() / 1000)}:R>` 
      : '';

    embed.addFields({
      name: finalHeading,
      value: `🎁 **Rewards:** ${rewardsStr || 'None'}${endCountdown}\n`
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
