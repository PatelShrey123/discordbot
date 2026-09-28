import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap } from '../api/boltPrices.js';

const CHANNEL_ID = process.env.PRICE_LOG_CHANNEL_ID || '1552982849433641051';

const RARITY_COLOUR = {
  mythical: 0xff2d46,
  legendary: 0xffc81e,
  epic: 0xc46bff,
  rare: 0x3ba9ff,
  paranormal: 0x22d3ee,
  uncommon: 0x2ee68f,
  common: 0x9ca3af,
};

export const data = new SlashCommandBuilder()
  .setName('newskins')
  .setDescription('Find skins Kirka has that the price sheet does not')
  .addBooleanOption((o) =>
    o.setName('post')
      .setDescription('Also announce them in the price log channel')
      .setRequired(false))
  .addBooleanOption((o) =>
    o.setName('all')
      .setDescription('Include skins nobody owns yet (usually hundreds)')
      .setRequired(false))
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

const typeOf = (item) =>
  item.type === 'BODY_SKIN' ? 'Character' : (item.parent?.name || 'Weapon');

const titleCase = (s) =>
  String(s || '').toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());

export async function execute(interaction) {
  await interaction.deferReply();

  const post = interaction.options.getBoolean('post') ?? false;
  const includeUnowned = interaction.options.getBoolean('all') ?? false;

  try {
    const [catalog, priceMap] = await Promise.all([getPublicCatalog(), getBoltPriceMap()]);

    let unlisted = [];
    for (const item of catalog) {
      if (!item.name) continue;
      const clean = item.name.replace(/^_+/, '').trim().toLowerCase();
      const typeKey = typeOf(item).toLowerCase();
      if (!priceMap.has(clean + '_' + typeKey) && !priceMap.has(clean)) {
        unlisted.push(item);
      }
    }

    // Kirka's catalog carries a lot of content that has never dropped. Reporting all of it
    // buries the handful that people actually hold, which is the only part worth pricing.
    const owned = unlisted.filter((i) => (i.totalOwned ?? 0) > 0);
    const hiddenCount = unlisted.length - owned.length;
    if (!includeUnowned) unlisted = owned;

    unlisted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!unlisted.length) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ee68f)
          .setTitle('No new skins')
          .setDescription(
            `Every skin in circulation is already on the sheet.${
              hiddenCount ? `\n\n${hiddenCount} more exist in Kirka's catalog but nobody owns one yet — \`/newskins all:true\` to see them.` : ''
            }`)],
      });
      return;
    }

    // ---- the reply: paste-ready rows ----------------------------------------------------
    const shown = unlisted.slice(0, 10);
    const rows = shown.map((item) => {
      const t = typeOf(item);
      return `\`${item.name},${t},${titleCase(item.rarity)},TBD,\`  ·  ${(item.totalOwned ?? 0).toLocaleString()} owned`;
    }).join('\n');

    const reply = new EmbedBuilder()
      .setColor(0xb8ff29)
      .setTitle(`${unlisted.length} skin${unlisted.length === 1 ? '' : 's'} not on the sheet`)
      .setDescription(
        `In circulation but unpriced. Paste these at the bottom of the sheet — or leave it, the sheet script adds them itself every 6 hours.\n\n${rows}` +
        (unlisted.length > shown.length ? `\n\n…and ${unlisted.length - shown.length} more.` : '') +
        (!includeUnowned && hiddenCount ? `\n\n${hiddenCount} more exist that nobody owns yet.` : ''))
      .setFooter({ text: 'Columns: Skin Name, Type, Rarity, Hub Value, Obtainable By' })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [reply] });

    // ---- optionally announce, in the same shape the price notifier uses ------------------
    if (post) {
      const channel = await interaction.client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (!channel?.isTextBased?.()) {
        await interaction.followUp({ content: `Could not reach the price log channel (${CHANNEL_ID}).`, ephemeral: true });
        return;
      }

      // Discord caps a message at 10 embeds, so this goes out in batches.
      const embeds = unlisted.map((item) => new EmbedBuilder()
        .setColor(RARITY_COLOUR[String(item.rarity || '').toLowerCase()] ?? 0x5865f2)
        .setTitle(`New Skin Detected (ID: ${item.name})`)
        .setDescription(`Kirka has this skin but the list does not: **${item.name}**`)
        .addFields({ name: 'Hub Value', value: 'Hub Value: "TBD"' })
        .setFooter({ text: `${typeOf(item)} · ${titleCase(item.rarity)} · ${(item.totalOwned ?? 0).toLocaleString()} owned` })
        .setTimestamp(new Date(item.createdAt || Date.now())));

      for (let i = 0; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
      }

      await interaction.followUp({
        content: `Posted ${embeds.length} detection${embeds.length === 1 ? '' : 's'} to <#${CHANNEL_ID}>.`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error('[NewSkins] Error:', err);
    await interaction.editReply({ content: `Failed to scan for new skins: ${err.message}` });
  }
}
