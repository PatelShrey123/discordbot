import { SlashCommandBuilder } from 'discord.js';
import { getBoltPriceMap, clearPriceCache } from '../api/boltPrices.js';

export const data = new SlashCommandBuilder()
  .setName('refreshprices')
  .setDescription('Instantly reload and synchronize the latest Hub Valuation prices from your Google Sheet')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    clearPriceCache();
    const map = await getBoltPriceMap();
    await interaction.editReply({
      content: `⚡ **Hub Valuation Synchronized!** Successfully reloaded \`${map.size}\` items from your private Google Sheet.`
    });
  } catch (err) {
    console.error('[RefreshPrices] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to synchronize prices: ${err.message}`
    });
  }
}
