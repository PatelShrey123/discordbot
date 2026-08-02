import { SlashCommandBuilder } from 'discord.js';
import { getWebSocketStatus } from '../utils/chatListener.js';

export const data = new SlashCommandBuilder()
  .setName('dbstatus')
  .setDescription('Check the bot database connection and WebSocket listener status')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const url = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
  const key = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

  // Mask the key for safety
  const maskedKey = key.substring(0, 15) + '...';

  // Get WebSocket statuses
  const wsStatus = getWebSocketStatus();
  const wsLines = wsStatus.map(ws => `• **${ws.name}:** \`${ws.state}\``).join('\n');

  try {
    const start = Date.now();
    // Fetch from linked_accounts table endpoint to verify authorization status
    const res = await fetch(`${url}/rest/v1/linked_accounts?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const duration = Date.now() - start;

    if (res.ok) {
      await interaction.editReply({
        content: `✅ **Database Connected Successfully (HTTPS REST API)!**\n\n• **Endpoint:** \`${url}\`\n• **Ping:** \`${duration}ms\`\n• **API Key:** \`${maskedKey}\`\n• **HTTP Status:** \`${res.status} ${res.statusText}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`
      });
    } else {
      const errorText = await res.text();
      await interaction.editReply({
        content: `❌ **Database Connection Failed!**\n\n• **HTTP Error:** \`${res.status} ${res.statusText}\`\n• **Message:** \`${errorText}\`\n• **Endpoint:** \`${url}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`
      });
    }
  } catch (err) {
    await interaction.editReply({
      content: `❌ **Database Connection Failed (Network Error)!**\n\n• **Error:** \`${err.message}\`\n• **Endpoint:** \`${url}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`
    });
  }
}
