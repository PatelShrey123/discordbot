import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('dbstatus')
  .setDescription('Check the bot database connection status (HTTPS REST API)')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const url = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
  const key = process.env.SUPABASE_KEY;

  if (!key) {
    return interaction.editReply({
      content: '❌ **Database Status:** `SUPABASE_KEY` environment variable is not defined in the bot settings!'
    });
  }

  // Mask the key for safety
  const maskedKey = key.substring(0, 15) + '...';

  try {
    const start = Date.now();
    // Fetch schema info from Supabase REST API
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const duration = Date.now() - start;

    if (res.ok) {
      await interaction.editReply({
        content: `✅ **Database Connected Successfully (HTTPS REST API)!**\n\n• **Endpoint:** \`${url}\`\n• **Ping:** \`${duration}ms\`\n• **API Key:** \`${maskedKey}\`\n• **HTTP Status:** \`${res.status} ${res.statusText}\``
      });
    } else {
      const errorText = await res.text();
      await interaction.editReply({
        content: `❌ **Database Connection Failed!**\n\n• **HTTP Error:** \`${res.status} ${res.statusText}\`\n• **Message:** \`${errorText}\`\n• **Endpoint:** \`${url}\``
      });
    }
  } catch (err) {
    await interaction.editReply({
      content: `❌ **Database Connection Failed (Network Error)!**\n\n• **Error:** \`${err.message}\`\n• **Endpoint:** \`${url}\``
    });
  }
}
