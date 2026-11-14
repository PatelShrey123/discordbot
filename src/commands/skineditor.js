import { SlashCommandBuilder } from 'discord.js';

// Opens the KirkaHub Skin Editor as a Discord Activity right here: everyone in the channel can join
// and watch or paint the same skin live. Free in every server (not VIP). Needs Activities turned on for
// the app in the Developer Portal.
export const data = new SlashCommandBuilder()
  .setName('skineditor')
  .setDescription('Open the live Skin Editor here: everyone can join, watch and paint the same skin')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  try {
    await interaction.launchActivity();
  } catch (err) {
    console.error('[SkinEditor] launchActivity failed:', err.message);
    const content = 'The live Skin Editor isn\'t switched on for KirkaHub yet. Meanwhile you can use it at https://kirkahub.online/skineditor';
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content, flags: 64 }).catch(() => {});
    else await interaction.reply({ content, flags: 64 }).catch(() => {});
  }
}
