import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getEventQuests, getClanWars, getStoresAndRanked } from '../api/eventsManager.js';

export const data = new SlashCommandBuilder()
  .setName('events')
  .setDescription('View Kirka Event Quests, Clan Wars rewards, and Season rewards from the Bolt list')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Category to browse')
      .setRequired(false)
      .addChoices(
        { name: '🏆 Event Quests (2026 / All)', value: 'events' },
        { name: '⚔️ Clan Wars Rewards', value: 'clanwars' },
        { name: '💎 Ranked Seasons & Stores', value: 'stores' }
      )
  )
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Filter by event/war number (e.g. 27, 26, 48) or skin name')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const category = interaction.options.getString('category') || 'events';
  const query = interaction.options.getString('query') || '';

  const embed = buildEventsEmbed(category, query);
  await interaction.editReply({ embeds: [embed] });
}

export async function executePrefix(message, args = []) {
  const firstArg = (args[0] || '').toLowerCase();
  let category = 'events';
  let query = '';

  if (firstArg === 'cw' || firstArg === 'clanwars' || firstArg === 'clanwar') {
    category = 'clanwars';
    query = args.slice(1).join(' ');
  } else if (firstArg === 'stores' || firstArg === 'store' || firstArg === 'ranked' || firstArg === 'seasons') {
    category = 'stores';
    query = args.slice(1).join(' ');
  } else {
    query = args.join(' ');
  }

  const embed = buildEventsEmbed(category, query);
  await message.reply({ embeds: [embed] });
}

export function buildEventsEmbed(category = 'events', query = '') {
  const embed = new EmbedBuilder().setTimestamp();

  if (category === 'clanwars') {
    const wars = getClanWars(query);
    embed
      .setColor('#ef4444')
      .setTitle('⚔️ Kirka.io Clan Wars Rewards')
      .setDescription(query ? `Showing clan wars matching: **${query}**` : '🏆 **Recent Clan Wars Rewards (Top 3 • Top 8 • Top 39)**');

    if (wars.length === 0) {
      embed.setDescription(`❌ No clan war rewards found matching **${query}**.`);
      return embed;
    }

    wars.slice(0, 8).forEach(w => {
      const lines = w.items.map(it => {
        const typeStr = it.type ? ` (${it.type})` : '';
        const ownersCount = it.owners !== null && it.owners !== undefined ? Number(it.owners) : null;
        const ownersStr = ownersCount !== null ? ` • ${ownersCount.toLocaleString()} Owner${ownersCount === 1 ? '' : 's'}` : '';
        const valStr = it.value && it.value !== '—' ? ` • ${it.value} Bolts` : '';
        const reqStr = it.req ? ` • ${it.req}` : '';
        return `• **${it.name}${typeStr}**${reqStr}${ownersStr}${valStr}`;
      });
      embed.addFields({
        name: `🛡️ ${w.title}`,
        value: lines.join('\n') || '— None listed —',
        inline: false
      });
    });

    embed.setFooter({ text: 'Bolt Price List • Use .cw <number> to inspect specific clan wars' });
    return embed;
  }

  if (category === 'stores') {
    const stores = getStoresAndRanked(query);
    embed
      .setColor('#a855f7')
      .setTitle('💎 Kirka.io Ranked Seasons & Special Shops')
      .setDescription(query ? `Showing rewards matching: **${query}**` : '✨ **Ranked Seasons & Limited Shops**');

    if (stores.length === 0) {
      embed.setDescription(`❌ No shops or seasons found matching **${query}**.`);
      return embed;
    }

    stores.slice(0, 8).forEach(s => {
      const lines = s.items.map(it => {
        const typeStr = it.type ? ` (${it.type})` : '';
        const ownersCount = it.owners !== null && it.owners !== undefined ? Number(it.owners) : null;
        const ownersStr = ownersCount !== null ? ` • ${ownersCount.toLocaleString()} Owner${ownersCount === 1 ? '' : 's'}` : '';
        const valStr = it.value && it.value !== '—' ? ` • ${it.value} Bolts` : '';
        const reqStr = it.req ? ` • ${it.req}` : '';
        return `• **${it.name}${typeStr}**${reqStr}${ownersStr}${valStr}`;
      });
      embed.addFields({
        name: `✨ ${s.title}`,
        value: lines.join('\n') || '— None listed —',
        inline: false
      });
    });

    embed.setFooter({ text: 'Bolt Price List • Use .ranked to view ranked sets' });
    return embed;
  }

  // Default: Event Quests
  const events = getEventQuests(query);
  embed
    .setColor('#f59e0b')
    .setTitle('🏆 Kirka.io Event Quests & Rewards')
    .setDescription(query ? `Showing event quests matching: **${query}**` : '⚡ **2026 Event Quests Slots & Requirements**');

  if (events.length === 0) {
    embed.setDescription(`❌ No event quests found matching **${query}**.`);
    return embed;
  }

  events.slice(0, 8).forEach(ev => {
    const lines = ev.items.map(it => {
      const typeStr = it.type ? ` (${it.type})` : '';
      const ownersCount = it.owners !== null && it.owners !== undefined ? Number(it.owners) : null;
      const ownersStr = ownersCount !== null ? ` • ${ownersCount.toLocaleString()} Owner${ownersCount === 1 ? '' : 's'}` : '';
      const reqStr = it.req ? ` • ${it.req}` : '';
      const valStr = it.value && it.value !== '—' && it.value !== 'TBD' ? ` • ${it.value} Bolts` : (it.value === 'TBD' ? ' • TBD' : '');
      return `• **${it.name}${typeStr}**${reqStr}${ownersStr}${valStr}`;
    });

    embed.addFields({
      name: `🎯 ${ev.title}`,
      value: lines.join('\n') || '— None listed —',
      inline: false
    });
  });

  embed.setFooter({ text: 'Bolt Price List • Use .events <number/name> to browse previous events' });
  return embed;
}
