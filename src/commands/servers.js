import { 
  SlashCommandBuilder, 
  AttachmentBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { fetchLiveRooms, resolveRegion, REGIONS } from '../api/servers.js';
import { renderServerBrowserCard } from '../canvas/serverBrowserCard.js';

export const data = new SlashCommandBuilder()
  .setName('servers')
  .setDescription('View live Kirka.io matches and rooms across regional servers')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('region')
      .setDescription('Server region to browse')
      .setRequired(false)
      .addChoices(
        { name: '🇮🇳 India (Mumbai)', value: 'india' },
        { name: '🌏 Asia (Singapore/Tokyo)', value: 'asia' },
        { name: '🇪🇺 Europe (Frankfurt)', value: 'eu' },
        { name: '🇺🇸 North America', value: 'na' },
        { name: '🇧🇷 South America', value: 'sa' }
      )
  );

// Generate region switch action buttons
export function createRegionButtons(activeRegionId = 'india') {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('server_reg_india')
      .setLabel('🇮🇳 India')
      .setStyle(activeRegionId === 'india' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('server_reg_asia')
      .setLabel('🌏 Asia')
      .setStyle(activeRegionId === 'asia' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('server_reg_eu')
      .setLabel('🇪🇺 Europe')
      .setStyle(activeRegionId === 'eu' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('server_reg_na')
      .setLabel('🇺🇸 NA')
      .setStyle(activeRegionId === 'na' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('server_reg_sa')
      .setLabel('🇧🇷 SA')
      .setStyle(activeRegionId === 'sa' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const linksRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🎮 Launch Kirka')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirka.io'),
    new ButtonBuilder()
      .setLabel('🌐 Web Tracker & 3D Renders')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kirkahub.vercel.app')
  );

  return [row, linksRow];
}

export async function execute(interaction) {
  await interaction.deferReply();
  const regionInput = interaction.options.getString('region') || 'india';
  const regionConfig = resolveRegion(regionInput);

  try {
    const data = await fetchLiveRooms(regionConfig.id);
    const cardBuffer = await renderServerBrowserCard(data);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'server-browser.png' });
    const components = createRegionButtons(data.region.id);

    await interaction.editReply({
      files: [attachment],
      components
    });
  } catch (err) {
    console.error('[ServersCommand] Error:', err);
    await interaction.editReply({ content: '⚠️ Failed to fetch live game servers from Kirka.' });
  }
}

export async function executePrefix(message, args = []) {
  await message.channel.sendTyping();
  const regionInput = args[0] || 'india';
  const regionConfig = resolveRegion(regionInput);

  try {
    const data = await fetchLiveRooms(regionConfig.id);
    const cardBuffer = await renderServerBrowserCard(data);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'server-browser.png' });
    const components = createRegionButtons(data.region.id);

    await message.reply({
      files: [attachment],
      components
    });
  } catch (err) {
    console.error('[ServersPrefixCommand] Error:', err);
    await message.reply('⚠️ Failed to fetch live game servers from Kirka.');
  }
}
