import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { randomInt } from 'crypto';

export const data = new SlashCommandBuilder()
  .setName('flip')
  .setDescription('Flip a fair coin (heads or tails)')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('call')
      .setDescription('Call it before the flip')
      .setRequired(false)
      .addChoices(
        { name: '🪙 Heads', value: 'heads' },
        { name: '🪙 Tails', value: 'tails' }
      )
  );

// crypto.randomInt is uniform and unpredictable, unlike Math.random()
function flipCoin() {
  return randomInt(2) === 0 ? 'heads' : 'tails';
}

function buildFlipEmbed(user, call) {
  const result = flipCoin();
  const pretty = result === 'heads' ? 'Heads' : 'Tails';
  const embed = new EmbedBuilder()
    .setColor(result === 'heads' ? '#F5A623' : '#94A3B8')
    .setTitle(`🪙 ${pretty}!`)
    .setFooter({ text: `Flipped by ${user.username} • crypto-secure 50/50` })
    .setTimestamp();

  if (call) {
    const won = call === result;
    embed.setDescription(`${user} called **${call === 'heads' ? 'Heads' : 'Tails'}** — ${won ? '✅ **You win!**' : '❌ **You lose!**'}`);
  } else {
    embed.setDescription(`${user} flipped a coin and it landed on **${pretty}**.`);
  }
  return embed;
}

export async function execute(interaction) {
  const call = interaction.options.getString('call');
  await interaction.reply({ embeds: [buildFlipEmbed(interaction.user, call)] });
}

// .flip [heads|tails|h|t]
export async function executePrefix(message, args) {
  const raw = args[0]?.toLowerCase();
  const call = raw === 'heads' || raw === 'h' ? 'heads' : raw === 'tails' || raw === 't' ? 'tails' : null;
  await message.reply({ embeds: [buildFlipEmbed(message.author, call)] });
}
