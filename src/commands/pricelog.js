import { SlashCommandBuilder } from 'discord.js';
import { checkPriceChanges } from '../utils/priceNotifier.js';

export const data = new SlashCommandBuilder()
  .setName('pricelog')
  .setDescription('Check the Hub Valuation sheet for changes right now and post any to the changelog channel')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const r = await checkPriceChanges(interaction.client);

    if (r.noSheet) {
      return interaction.editReply('⚠️ Prices came from the local fallback rather than the sheet, so nothing was compared. Set `HUB_PRICES_SHEET_URL` in the environment and try again.');
    }
    if (r.skipped) {
      return interaction.editReply(`⚠️ The sheet came back with only ${r.rowCount} rows, too few to trust, so nothing was compared.`);
    }
    if (r.baseline) {
      return interaction.editReply('📌 No snapshot existed yet, so the current sheet was recorded as the baseline. Changes from here on will be posted.');
    }
    if (r.error === 'channel') {
      return interaction.editReply('❌ Changes were found but the changelog channel could not be reached. Check the bot can see and post in it — the changes are kept for the next check.');
    }

    const total = r.changed + r.added + r.removed;
    if (!total) return interaction.editReply('✅ Sheet matches the last snapshot — nothing has changed.');

    return interaction.editReply(
      `📤 Posted to the changelog channel: **${r.changed}** repriced, **${r.added}** added, **${r.removed}** removed.`
    );
  } catch (err) {
    console.error('[PriceLog] Error:', err);
    return interaction.editReply(`❌ Failed to check the sheet: ${err.message}`);
  }
}
