import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchSoloLeaderboardWithRewards } from '../api/kirka.js';

export const data = new SlashCommandBuilder()
  .setName('season')
  .setDescription('Display active Kirka.io season countdown and rewards details');

function buildSeasonEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('🏆 Kirka.io Season Info & Rewards')
    .setTimestamp();

  if (!data) {
    embed.setDescription('Failed to load season data.');
    return embed;
  }

  // 1. Season Details & Countdown
  let descriptionLines = [];
  if (data.season) {
    descriptionLines.push(`**Season Name:** ${data.season.name || 'Active Season'}`);
    descriptionLines.push(`**Category:** \`${data.season.category || 'Solo XP'}\``);
  }

  if (data.remainingTime) {
    const endTimestamp = Math.floor((Date.now() + data.remainingTime) / 1000);
    descriptionLines.push(`⏰ **Ends:** <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)`);
  }

  embed.setDescription(descriptionLines.join('\n'));

  // 2. Rewards brackets parsing
  if (data.rewards) {
    const rewards = data.rewards;
    // Sort brackets numerically by key
    const brackets = Object.keys(rewards).sort((a, b) => Number(a) - Number(b));

    brackets.forEach((bracketStart) => {
      const items = rewards[bracketStart];
      if (!Array.isArray(items) || items.length === 0) return;

      const formattedRewards = items.map(r => {
        const amtStr = Number(r.amount || 0).toLocaleString();
        if (r.type === 'XP') return `✨ **${amtStr} XP**`;
        if (r.type === 'COINS') return `🪙 **${amtStr} Coins**`;
        if (r.type === 'DIAMONDS') return `💎 **${amtStr} Diamonds**`;
        if (r.item) return `🎁 **${r.item.name}** (${r.item.rarity})`;
        return `🎁 **${r.type}**`;
      }).join(' • ');

      // Determine bracket text label, e.g. "Rank 1", "Rank 4-8", "Rank 9-15"
      const bracketStartNum = Number(bracketStart);
      let bracketLabel = `Rank ${bracketStart}`;
      
      // Look up next bracket to find end range
      const nextBracket = brackets.find(b => Number(b) > bracketStartNum);
      if (nextBracket) {
        const bracketEndNum = Number(nextBracket) - 1;
        bracketLabel = `Ranks ${bracketStart} - ${bracketEndNum}`;
      } else {
        bracketLabel = `Ranks ${bracketStart}+`;
      }

      embed.addFields({
        name: `🏆 ${bracketLabel}`,
        value: `• **Prizes:** ${formattedRewards}\n`
      });
    });
  }

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const data = await fetchSoloLeaderboardWithRewards();
    const embed = buildSeasonEmbed(data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing season command:', err);
    await interaction.editReply('❌ Failed to retrieve season details. Please try again later.');
  }
}

export async function executePrefix(message, args) {
  await message.channel.sendTyping();

  try {
    const data = await fetchSoloLeaderboardWithRewards();
    const embed = buildSeasonEmbed(data);
    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error executing season prefix command:', err);
    await message.reply('⚠️ Failed to retrieve season details.');
  }
}
