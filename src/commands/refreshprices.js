import { SlashCommandBuilder } from 'discord.js';
import { getBoltPriceMap, clearPriceCache, getLastPriceSource } from '../api/boltPrices.js';
import { checkPriceChanges } from '../utils/priceNotifier.js';

export const data = new SlashCommandBuilder()
  .setName('refreshprices')
  .setDescription('Reload Hub Valuation prices from the sheet and post anything that changed to the changelog')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    clearPriceCache();
    const map = await getBoltPriceMap();
    const source = getLastPriceSource();
    const where = source === 'sheet' ? 'your private Google Sheet' : 'the local fallback database';

    // Reloading and then checking for changes is what people expect this command to do, so it does
    // both rather than quietly leaving the changelog untouched.
    const r = await checkPriceChanges(interaction.client);

    let note;
    if (r.noSheet) {
      note = '\n⚠️ Prices came from the local fallback, so no changelog check ran. Set `HUB_PRICES_SHEET_URL` in the environment.';
    } else if (r.skipped) {
      note = `\n⚠️ The sheet returned only ${r.rowCount} rows, too few to trust, so no changelog check ran.`;
    } else if (r.baseline) {
      note = '\n📌 No snapshot existed yet — the current sheet is now the baseline. Changes from here on will be posted.';
    } else if (r.error === 'channel') {
      note = '\n❌ Changes were found but the changelog channel could not be reached. They are kept and retried next check.';
    } else if (r.changed + r.added + r.removed === 0) {
      note = '\n✅ Nothing has changed since the last check.';
    } else {
      note = `\n📤 Posted to the changelog: **${r.changed}** repriced, **${r.added}** added, **${r.removed}** removed.`;
    }

    await interaction.editReply({
      content: `⚡ **Hub Valuation Synchronized!** Reloaded \`${map.size}\` items from ${where}.${note}`,
    });
  } catch (err) {
    console.error('[RefreshPrices] Error:', err);
    await interaction.editReply({ content: `❌ Failed to synchronize prices: ${err.message}` });
  }
}
