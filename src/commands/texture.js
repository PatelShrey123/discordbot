import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { getPublicCatalog } from '../api/kirka.js';
import { getBoltPriceMap } from '../api/boltPrices.js';
import { renderSkinTexture } from '../canvas/skinTexture.js';

export const data = new SlashCommandBuilder()
  .setName('texture')
  .setDescription('View the flat texture sheet of a Kirka skin')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Name of the skin (e.g. Sketch, 1337, Eco)')
      .setRequired(true)
  );

const RARITY_COLORS = {
  PARANORMAL: '#e11d48',
  MYTHICAL: '#ea580c',
  LEGENDARY: '#fbbf24',
  EPIC: '#a855f7',
  RARE: '#3b82f6',
  UNCOMMON: '#10b981',
  COMMON: '#9ca3af'
};

const cleanName = (name) => (name || '').replace(/^_+/, '').trim();

/** Exact catalogue name, then partial, then the price sheet for skins Kirka hasn't listed yet. */
function findSkin(catalog, priceMap, query) {
  const q = query.toLowerCase();
  const exact = catalog.find(i => cleanName(i.name).toLowerCase() === q);
  if (exact) return exact;
  const partial = catalog.find(i => cleanName(i.name).toLowerCase().includes(q));
  if (partial) return partial;

  for (const value of priceMap.values()) {
    const sheetName = (value.skinName || '').trim();
    if (sheetName && sheetName.toLowerCase().includes(q)) {
      const isCharacter = value.type?.toLowerCase() === 'character';
      return {
        name: sheetName,
        rarity: (value.rarity || 'COMMON').toUpperCase(),
        type: isCharacter ? 'BODY_SKIN' : 'WEAPON_SKIN',
        parent: isCharacter ? null : { name: value.type },
        textureUrl: null,
      };
    }
  }
  return null;
}

/** Shared by /texture and .texture so both answer identically. */
async function buildTextureReply(query) {
  const [catalog, priceMap] = await Promise.all([getPublicCatalog(), getBoltPriceMap()]);
  const item = findSkin(catalog, priceMap, query);
  if (!item) {
    return { content: `❌ Could not find a skin matching **${query}**.` };
  }

  const name = cleanName(item.name);
  const texture = await renderSkinTexture(item);
  if (!texture) {
    return { content: `⚠️ **${name}** has no texture available from Kirka. Try \`/skin ${name}\` for its render.` };
  }

  const kind = item.type === 'BODY_SKIN'
    ? 'Character'
    : `Weapon skin${item.parent?.name ? ` · ${item.parent.name}` : ''}`;
  const fileName = `${name.replace(/[^a-z0-9_-]+/gi, '_') || 'skin'}-texture.png`;
  const rarity = (item.rarity || 'COMMON').toUpperCase();
  const upscaled = texture.buffer && Math.max(texture.width, texture.height) <= 128;

  const embed = new EmbedBuilder()
    .setTitle(name.toUpperCase())
    .setColor(RARITY_COLORS[rarity] || '#9ca3af')
    .setDescription(`**${kind}** · \`${rarity}\` · ${texture.width}×${texture.height} texture`)
    .setImage(`attachment://${fileName}`)
    .setFooter({ text: upscaled
      ? `Enlarged from ${texture.width}×${texture.height} with sharp pixels · open the image to save it`
      : 'Open the image to save it' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🎮 View in 3D (360° Studio)')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kirkahub.online/skin/${encodeURIComponent(name)}`)
  );

  return {
    embeds: [embed],
    components: [row],
    files: [new AttachmentBuilder(texture.buffer, { name: fileName })],
  };
}

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('name').trim();
  try {
    await interaction.editReply(await buildTextureReply(query));
  } catch (err) {
    console.error('Error executing texture command:', err);
    await interaction.editReply({ content: `⚠️ Failed to load the texture for **${query}**.` });
  }
}

export async function executePrefix(message, args) {
  const query = args.join(' ').trim();
  if (!query) {
    return message.reply('Usage: `.texture <skin name>` — e.g. `.texture Sketch`');
  }
  try {
    await message.channel.sendTyping();
    await message.reply(await buildTextureReply(query));
  } catch (err) {
    console.error('Error in prefix texture command:', err);
    await message.reply(`⚠️ Failed to load the texture for **${query}**.`);
  }
}
