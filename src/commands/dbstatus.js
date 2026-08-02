import { SlashCommandBuilder } from 'discord.js';
import pg from 'pg';

export const data = new SlashCommandBuilder()
  .setName('dbstatus')
  .setDescription('Check the bot database connection status')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return interaction.editReply({
      content: '❌ **Database Status:** `DATABASE_URL` environment variable is not defined in the bot settings!'
    });
  }

  // Parse connection string to mask password for safety
  let maskedUrl = 'unknown';
  try {
    const parsed = new URL(connectionString);
    parsed.password = '*****';
    maskedUrl = parsed.toString();
  } catch (e) {
    maskedUrl = connectionString.substring(0, 15) + '...';
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const start = Date.now();
    const res = await pool.query('SELECT NOW(), current_database()');
    const duration = Date.now() - start;

    await interaction.editReply({
      content: `✅ **Database Connected Successfully!**\n\n• **DB Name:** \`${res.rows[0].current_database}\`\n• **Ping:** \`${duration}ms\`\n• **Connection URL:** \`${maskedUrl}\`\n• **Time:** \`${res.rows[0].now}\``
    });
  } catch (err) {
    await interaction.editReply({
      content: `❌ **Database Connection Failed!**\n\n• **Error:** \`${err.message}\`\n• **Connection URL:** \`${maskedUrl}\``
    });
  } finally {
    await pool.end();
  }
}
