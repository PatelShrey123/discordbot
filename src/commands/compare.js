import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchUserProfile, fetchUserInventory } from '../api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Compare stats and inventory values of two Kirka players')
  .addStringOption(option =>
    option.setName('user1')
      .setDescription('First Kirka player username or ID')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('user2')
      .setDescription('Second Kirka player username or ID')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const user1Query = interaction.options.getString('user1');
  const user2Query = interaction.options.getString('user2');

  const [p1, p2] = await Promise.all([
    fetchUserProfile(user1Query),
    fetchUserProfile(user2Query)
  ]);

  if (!p1) {
    return interaction.editReply({ content: `❌ Player 1 (**${user1Query}**) was not found.` });
  }
  if (!p2) {
    return interaction.editReply({ content: `❌ Player 2 (**${user2Query}**) was not found.` });
  }

  // Fetch Inventories & Bolt Valuations
  const [inv1, inv2, priceMap] = await Promise.all([
    fetchUserInventory(p1.id),
    fetchUserInventory(p2.id),
    getBoltPriceMap()
  ]);

  const val1 = inv1.reduce((sum, item) => sum + getItemPrice(priceMap, item.item || item) * (item.amount || 1), 0);
  const val2 = inv2.reduce((sum, item) => sum + getItemPrice(priceMap, item.item || item) * (item.amount || 1), 0);

  const kdr1 = p1.deaths > 0 ? (p1.kills / p1.deaths).toFixed(2) : p1.kills.toFixed(2);
  const kdr2 = p2.deaths > 0 ? (p2.kills / p2.deaths).toFixed(2) : p2.kills.toFixed(2);

  const winRate1 = p1.gamesPlayed > 0 ? ((p1.victories / p1.gamesPlayed) * 100).toFixed(1) + '%' : '0%';
  const winRate2 = p2.gamesPlayed > 0 ? ((p2.victories / p2.gamesPlayed) * 100).toFixed(1) + '%' : '0%';

  const embed = new EmbedBuilder()
    .setColor('#38bdf8')
    .setTitle(`⚔️ Comparison: ${p1.name} vs ${p2.name}`)
    .addFields(
      { name: '📊 Metric', value: '**Level**\n**Score**\n**Kills**\n**K/D Ratio**\n**Win Rate**\n**Inventory Value**', inline: true },
      { 
        name: `👤 ${p1.name}`, 
        value: `Lvl ${p1.level || 1}\n${(p1.score || 0).toLocaleString()}\n${(p1.kills || 0).toLocaleString()}\n${kdr1}\n${winRate1}\n${formatValueLong(val1)}`, 
        inline: true 
      },
      { 
        name: `👤 ${p2.name}`, 
        value: `Lvl ${p2.level || 1}\n${(p2.score || 0).toLocaleString()}\n${(p2.kills || 0).toLocaleString()}\n${kdr2}\n${winRate2}\n${formatValueLong(val2)}`, 
        inline: true 
      }
    )
    .setFooter({ text: 'Kirka Tracker Bot • Bolt Pricing' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
