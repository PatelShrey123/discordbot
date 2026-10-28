import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Shrey/.gemini/antigravity/scratch/discordbot/.env' });
import { checkPriceChanges } from '../src/utils/priceNotifier.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  try {
    const res = await checkPriceChanges(client, { announce: false });
    console.log('checkPriceChanges result (dry-run):', res);
  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
