import './dns-init.js';
import { Client, GatewayIntentBits, Collection, AttachmentBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';
import dns from 'dns';

import { registerCommands } from './register-commands.js';
import { getPublicCatalog, fetchClanLeaderboard, getAllItemData, fetchUserProfile, fetchUserInventory, fetchClan } from './api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from './api/boltPrices.js';
import { initDb, getUserBackground, getLinkedAccount, getDiscordLinkedToKirka, setUserBackground } from './api/db.js';
import { startChatListener, getWebSocketStatus, pendingLinks } from './utils/chatListener.js';
import { createSkinEmbed } from './commands/skin.js';
import { renderProfileCard } from './canvas/profileCard.js';
import { renderInventoryGridPage } from './canvas/inventoryGrid.js';
import { renderClanRosterPage } from './canvas/clanRoster.js';

import * as profileCmd from './commands/profile.js';
import * as inventoryCmd from './commands/inventory.js';
import * as clanCmd from './commands/clan.js';
import * as skinCmd from './commands/skin.js';
import * as leaderboardCmd from './commands/leaderboard.js';
import * as hCmd from './commands/h.js';
import * as linkCmd from './commands/link.js';
import * as dbstatusCmd from './commands/dbstatus.js';
import * as unlinkCmd from './commands/unlink.js';
import * as botnameCmd from './commands/botname.js';
import * as botavatarCmd from './commands/botavatar.js';
import * as questsCmd from './commands/quests.js';
import * as rankedCmd from './commands/ranked.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing! Please specify DISCORD_TOKEN in .env or Render environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

console.log('🔊 [Startup] Step 1: Registering commands collection...');
client.commands = new Collection();
client.commands.set(profileCmd.data.name, profileCmd);
client.commands.set(inventoryCmd.data.name, inventoryCmd);
client.commands.set(clanCmd.data.name, clanCmd);
client.commands.set(skinCmd.data.name, skinCmd);
client.commands.set(leaderboardCmd.data.name, leaderboardCmd);
client.commands.set(hCmd.data.name, hCmd);
client.commands.set(linkCmd.data.name, linkCmd);
client.commands.set(dbstatusCmd.data.name, dbstatusCmd);
client.commands.set(unlinkCmd.data.name, unlinkCmd);
client.commands.set(botnameCmd.data.name, botnameCmd);
client.commands.set(botavatarCmd.data.name, botavatarCmd);
client.commands.set(questsCmd.data.name, questsCmd);
client.commands.set(rankedCmd.data.name, rankedCmd);
console.log(`🔊 [Startup] Step 1: Registered ${client.commands.size} command handlers.`);

console.log('🔊 [Startup] Step 2: Setting up ready listener...');
client.once('ready', async () => {
  console.log(`🤖 [Startup] Step 3: KirkaHub Bot successfully logged in as ${client.user.tag}!`);
  console.log(`🌐 [Startup] Bot active in ${client.guilds.cache.size} server(s).`);

  console.log('🔊 [Startup] Step 4: Connecting to Supabase Database...');
  try {
    await initDb();
    console.log('✅ [Startup] Step 4: Supabase Database connected.');
  } catch (err) {
    console.error('❌ [Startup] Step 4: Supabase connection failed:', err);
  }

  console.log('🔊 [Startup] Step 5: Connecting Chat WebSocket Listener...');
  try {
    startChatListener(client);
    console.log('✅ [Startup] Step 5: Chat WebSocket Listener connected.');
  } catch (err) {
    console.error('❌ [Startup] Step 5: Chat WebSocket connection failed:', err);
  }

  console.log('🔥 [Startup] Step 6: Warming up API caches (Google Sheets, Kirka Catalog, Leaderboard, AllItemData)...');
  Promise.all([
    getPublicCatalog(),
    getBoltPriceMap(),
    fetchClanLeaderboard(),
    getAllItemData()
  ]).then(() => {
    console.log('✅ [Startup] Step 6: API cache warmup complete! Bot is fully primed.');
  }).catch(err => {
    console.warn('⚠️ [Startup] Step 6: Cache warmup encountered an error:', err.message);
  });

  console.log('🤖 [Startup] Step 7: Deploying global slash commands...');
  try {
    await registerCommands();
    console.log('✅ [Startup] Step 7: Slash commands deployed successfully.');
  } catch (err) {
    console.error('❌ [Startup] Step 7: Failed to deploy slash commands:', err);
  }

  console.log('🎉 [Startup] KirkaHub Bot is fully ready and online!');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing command /${interaction.commandName}:`, error);
    const replyMsg = { content: '⚠️ There was an error while executing this command!', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyMsg);
    } else {
      await interaction.reply(replyMsg);
    }
  }
});

// Support prefix triggers for every command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lowerContent = content.toLowerCase();

  // 1. .skin [name]
  if (lowerContent.startsWith('.skin ')) {
    const searchName = content.substring(6).trim().toLowerCase();
    if (!searchName) return;
    
    // Trigger typing state immediately to eliminate perceived delay
    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .skin! Query: "${searchName}"`);

    try {
      const [catalog, priceMap, allItemData] = await Promise.all([
        getPublicCatalog(),
        getBoltPriceMap(),
        getAllItemData()
      ]);

      let matchedItem = catalog.find(item => 
        item.name && item.name.replace(/^_+/, '').trim().toLowerCase() === searchName
      );

      if (!matchedItem) {
        matchedItem = catalog.find(item => 
          item.name && item.name.toLowerCase().includes(searchName)
        );
      }

      if (!matchedItem) {
        return message.reply(`❌ Could not find a skin/item matching **${content.substring(6).trim()}**.`);
      }

      const embed = createSkinEmbed(matchedItem, priceMap, allItemData);
      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in prefix skin command:', err);
      await message.reply(`⚠️ Failed to retrieve skin details.`);
    }
  }

  // 2. .profile [username/id]
  else if (lowerContent.startsWith('.profile')) {
    let query = content.substring(8).trim();
    
    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .profile! Query: "${query}"`);

    if (!query) {
      const linked = await getLinkedAccount(message.author.id);
      if (!linked) {
        return message.reply(`❌ You haven't linked a Kirka account yet. Use \`/link\` to bind your profile, or search for a player: \`.profile CrackedYOU\`.`);
      }
      query = linked.shortId;
    }

    try {
      const profile = await fetchUserProfile(query);
      if (!profile) {
        return message.reply(`❌ Could not find a Kirka player matching **${query}**.`);
      }

      const customBg = await getUserBackground(profile.id);

      let discordUsername = null;
      try {
        const linkedDiscordId = await getDiscordLinkedToKirka(profile.shortId);
        if (linkedDiscordId) {
          const linkedUser = await client.users.fetch(linkedDiscordId);
          if (linkedUser) {
            discordUsername = linkedUser.tag;
          }
        }
      } catch (dbErr) {
        console.warn('[Profile] Failed to fetch linked Discord details:', dbErr.message);
      }

      const cardBuffer = await renderProfileCard(profile, customBg, discordUsername);
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile-card.png' });

      await message.reply({ files: [attachment] });
    } catch (err) {
      console.error('Error in prefix profile command:', err);
      await message.reply(`⚠️ Failed to render profile card image.`);
    }
  }

  // 3. .inv [username/id]
  else if (lowerContent.startsWith('.inv')) {
    const rawArgs = content.substring(lowerContent.startsWith('.inventory') ? 10 : 4).trim();
    const args = rawArgs ? [rawArgs] : [];
    await inventoryCmd.executePrefix(message, args);
  }

  // 4. .link
  else if (lowerContent.startsWith('.link')) {
    await message.channel.sendTyping();
    const discordId = message.author.id;
    
    console.log(`[MessageReceived] Matched .link for user: ${discordId}`);

    const existing = await getLinkedAccount(discordId);
    if (existing) {
      return message.reply(`ℹ️ Your Discord account is already linked to Kirka user **${existing.name}** (\`#${existing.shortId}\`).`);
    }

    const tokenValue = Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
    const token = `kirkahub-0x${tokenValue}`;
    pendingLinks.set(token, { discordId });

    const doneButton = new ButtonBuilder()
      .setCustomId('link_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('link_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger);

    const chatButton = new ButtonBuilder()
      .setLabel('Chat')
      .setURL('https://kirka.io/')
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder().addComponents(doneButton, cancelButton, chatButton);

    const embed = new EmbedBuilder()
      .setTitle('🔗 Link your Kirka Account')
      .setDescription('Prove ownership of your Kirka profile by typing a temporary verification code in the game client.')
      .setColor('#fbbf24')
      .addFields(
        { name: 'Step 1: Open Kirka.io', value: 'Login with the Kirka account you wish to link.' },
        { name: 'Step 2: Enter Server Lobby', value: 'Join any server or click the **Servers** button to open the global lobby chat.' },
        { name: 'Step 3: Send this exact message', value: `\`\`\`\n${token}\n\`\`\`` },
        { name: 'Step 4: Done!', value: 'Send the chat message in-game and click the **Done** button below!' }
      )
      .setFooter({ text: 'This verification code will expire in 5 minutes.' })
      .setTimestamp();

    const response = await message.reply({
      embeds: [embed],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== discordId) {
        return i.reply({ content: '⚠️ Only the user who ran the command can use these buttons.', flags: 64 });
      }

      if (i.customId === 'link_done') {
        await i.deferUpdate();
        const linked = await getLinkedAccount(discordId);
        if (linked) {
          collector.stop('success');
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Account Linked Successfully!')
            .setDescription(`Your Discord account is now linked to Kirka profile **${linked.name}** (\`#${linked.shortId}\`).`)
            .setColor('#22c55e')
            .setTimestamp();

          await response.edit({
            embeds: [successEmbed],
            components: []
          });
        } else {
          await i.followUp({
            content: `❌ Code not detected in-game yet. Please ensure you sent \`${token}\` in the Kirka server lobby chat and click **Done** again!`,
            flags: 64
          });
        }
      } else if (i.customId === 'link_cancel') {
        collector.stop('cancelled');
        pendingLinks.delete(token);
        await response.edit({
          content: '❌ Link request cancelled.',
          embeds: [],
          components: []
        });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time' && pendingLinks.has(token)) {
        pendingLinks.delete(token);
        response.edit({
          content: '⚠️ Verification code expired. Please run `.link` again to generate a new token.',
          embeds: [],
          components: []
        }).catch(() => {});
      }
    });
  }

  // 4b. .unlink
  else if (lowerContent.startsWith('.unlink')) {
    await unlinkCmd.executePrefix(message);
  }

  // 5. .h [url/image]
  else if (lowerContent.startsWith('.h')) {
    const args = content.substring(2).trim();
    const attachment = message.attachments.first();

    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .h for user: ${message.author.id}`);

    const linked = await getLinkedAccount(message.author.id);
    if (!linked || !linked.id) {
      return message.reply('❌ **Privacy Protection:** You must link your Kirka account to your Discord account first to customize your profile background.\n\nPlease link your profile first by running the `.link` command!');
    }

    let bgUrl = null;
    if (attachment) {
      bgUrl = attachment.url;
    } else if (args) {
      bgUrl = args.split(' ')[0].trim();
    }

    if (!bgUrl) {
      return message.reply('❌ Please provide a background image: either paste a direct link after `.h` OR upload an image alongside the `.h` message.');
    }

    if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://')) {
      return message.reply('❌ Invalid image URL. It must start with `http://` or `https://`.');
    }

    try {
      await setUserBackground(linked.id, bgUrl);
      return message.reply(`✅ Successfully set custom profile background for your linked Kirka profile **${linked.name}**!\n🖼️ Link: <${bgUrl}>`);
    } catch (err) {
      console.error(`Failed to set background for ${linked.name}:`, err.message);
      return message.reply('⚠️ Failed to save background to database. Please check connection and try again.');
    }
  }

  // 6. .dbstatus
  else if (lowerContent.startsWith('.dbstatus')) {
    await message.channel.sendTyping();
    const url = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
    const key = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';
    const maskedKey = key.substring(0, 15) + '...';

    const wsStatus = getWebSocketStatus();
    const wsLines = wsStatus.map(ws => `• **${ws.name}:** \`${ws.state}\``).join('\n');

    try {
      const start = Date.now();
      const res = await fetch(`${url}/rest/v1/linked_accounts?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      const duration = Date.now() - start;

      if (res.ok) {
        await message.reply(`✅ **Database Connected Successfully (HTTPS REST API)!**\n\n• **Endpoint:** \`${url}\`\n• **Ping:** \`${duration}ms\`\n• **API Key:** \`${maskedKey}\`\n• **HTTP Status:** \`${res.status} ${res.statusText}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`);
      } else {
        const errorText = await res.text();
        await message.reply(`❌ **Database Connection Failed!**\n\n• **HTTP Error:** \`${res.status} ${res.statusText}\`\n• **Message:** \`${errorText}\`\n• **Endpoint:** \`${url}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`);
      }
    } catch (err) {
      await message.reply(`❌ **Database Connection Failed (Network Error)!**\n\n• **Error:** \`${err.message}\`\n• **Endpoint:** \`${url}\`\n\n🌐 **Kirka Game Chat WebSocket Connections:**\n${wsLines}`);
    }
  }

  // 7. .leaderboard [players/clans]
  else if (lowerContent.startsWith('.leaderboard')) {
    const arg = content.substring(12).trim().toLowerCase();
    const category = arg === 'players' ? 'players' : 'clans';

    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .leaderboard! Category: "${category}"`);

    try {
      if (category === 'players') {
        const res = await fetch('https://api.kirka.io/api/leaderboard/solo', { headers: { 'ApiKey': '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060', 'user-agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('API returned ' + res.status);
        const data = await res.json();
        const results = data.results || data || [];

        const top10 = results.slice(0, 10).map((u, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
          return `${medal} **${u.name || 'Unknown'}** — ${Number(u.scores || 0).toLocaleString()} XP`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#f59e0b')
          .setTitle('🥇 Kirka.io Solo Leaderboard (Top 10)')
          .setDescription(top10 || 'No leaderboard data found.')
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        const res = await fetch('https://api.kirka.io/api/leaderboard/clan', { headers: { 'ApiKey': '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060', 'user-agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('API returned ' + res.status);
        const data = await res.json();
        const results = data.results || data || [];

        const top10 = results.slice(0, 10).map((c, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
          return `${medal} **[${c.name || 'Clan'}]** — ${Number(c.scores || 0).toLocaleString()} Total Score (${c.membersCount || 0} members)`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#a855f7')
          .setTitle('🥇 Kirka.io Clan Leaderboard (Top 10)')
          .setDescription(top10 || 'No clan leaderboard data found.')
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      await message.reply('⚠️ Failed to fetch leaderboard from Kirka API. Please try again later.');
    }
  }

  // 8. .clan [name]
  else if (lowerContent.startsWith('.clan ')) {
    const queryClan = content.substring(6).trim();
    if (!queryClan) return message.reply('❌ Please specify a clan name: `.clan [name]`');

    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .clan! Query: "${queryClan}"`);

    const clan = await fetchClan(queryClan);
    if (!clan) {
      return message.reply(`❌ Could not find a Kirka clan named **${queryClan}**.`);
    }

    let rank = 0;
    try {
      const results = await fetchClanLeaderboard();
      const idx = results.findIndex(c => c.name && c.name.toLowerCase() === clan.name.toLowerCase());
      if (idx !== -1) {
        rank = idx + 1;
      }
    } catch (err) {
      console.warn('Failed to fetch clan rank:', err.message);
    }

    const members = clan.members || [];
    const leaders = members.filter(m => m.role === 'LEADER');
    const officers = members.filter(m => m.role === 'OFFICER');
    const newbies = members.filter(m => m.role === 'NEWBIE');

    const totalElements = 
      (leaders.length > 0 ? 1 : 0) + leaders.length +
      (officers.length > 0 ? 1 : 0) + officers.length +
      (newbies.length > 0 ? 1 : 0) + newbies.length;

    let totalPages = 1;
    if (totalElements > 25) {
      totalPages = 1 + Math.ceil((totalElements - 25) / 30);
    }

    try {
      const cardBuffer = await renderClanRosterPage(clan, rank, 0, totalPages);
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'clan-roster.png' });

      const trackerButton = new ButtonBuilder()
        .setLabel('Clan Tracker')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://kirkahub.vercel.app/clan/${encodeURIComponent(clan.name)}`);

      const row = new ActionRowBuilder().addComponents(trackerButton);

      await message.reply({
        files: [attachment],
        components: [row]
      });
    } catch (err) {
      console.error('Error rendering clan roster:', err);
      await message.reply('⚠️ Failed to render clan roster page.');
    }
  }
  
  // 9. .botname [new_name]
  else if (lowerContent.startsWith('.botname')) {
    const args = content.substring(8).trim().split(/ +/).filter(Boolean);
    await botnameCmd.executePrefix(message, args);
  }

  // 10. .botavatar [url/image]
  else if (lowerContent.startsWith('.botavatar')) {
    const args = content.substring(10).trim().split(/ +/).filter(Boolean);
    await botavatarCmd.executePrefix(message, args);
  }

  // 11. .quests [type]
  else if (lowerContent.startsWith('.quests')) {
    const args = content.substring(7).trim().split(/ +/).filter(Boolean);
    await questsCmd.executePrefix(message, args);
  }

  // 12. .ranked [category]
  else if (lowerContent.startsWith('.ranked')) {
    const args = content.substring(7).trim().split(/ +/).filter(Boolean);
    await rankedCmd.executePrefix(message, args);
  }
});

// Global server location state for region detection
let serverLocationInfo = { ip: 'Detecting...', region: 'Detecting...', country: 'Detecting...', org: 'Detecting...' };
(async () => {
  try {
    const geoRes = await fetch('https://ipapi.co/json/');
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      serverLocationInfo = {
        ip: geoData.ip || 'Unknown',
        region: geoData.city || geoData.region || 'Unknown',
        country: geoData.country_name || 'Unknown',
        org: geoData.org || 'Unknown'
      };
      console.log(`📡 [GeoIP] Server detected in: ${serverLocationInfo.region}, ${serverLocationInfo.country} (IP: ${serverLocationInfo.ip})`);
      return;
    }
  } catch (e) {}

  // Fallback
  try {
    const geoRes = await fetch('http://ip-api.com/json/');
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      serverLocationInfo = {
        ip: geoData.query || 'Unknown',
        region: geoData.city || geoData.regionName || 'Unknown',
        country: geoData.country || 'Unknown',
        org: geoData.isp || 'Unknown'
      };
      console.log(`📡 [GeoIP] Server detected in (fallback): ${serverLocationInfo.region}, ${serverLocationInfo.country} (IP: ${serverLocationInfo.ip})`);
    }
  } catch (e) {
    serverLocationInfo = { ip: 'Failed to detect', region: 'Unknown', country: 'Unknown', org: 'Unknown' };
  }
})();

// Start lightweight HTTP server for Render.com health checks and status diagnostics
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    
    // 1) Test Outbound Discord connection
    let discordApiStatus = { connected: false, status: 0, statusText: 'Unknown', rateLimited: false };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      discordApiStatus = {
        connected: response.status === 200 || response.status === 401 || response.status === 403 || response.status === 429,
        status: response.status,
        statusText: response.statusText,
        rateLimited: response.status === 429,
        retryAfter: response.headers.get('retry-after') || null
      };
    } catch (err) {
      discordApiStatus.error = err.message;
    }

    // 2) Collect Gateway State
    const wsStates = { 0: 'READY', 1: 'CONNECTING', 2: 'RECONNECTING', 3: 'IDLE', 4: 'NEARLY', 5: 'DISCONNECTED' };
    const gatewayState = wsStates[client.ws.status] || 'UNKNOWN';
    const gatewayPing = client.ws.ping >= 0 ? `${client.ws.ping}ms` : 'N/A';

    // 3) Supabase DB connectivity
    let supabaseStatus = { connected: false, status: 0, statusText: 'Unknown', duration: 0 };
    const dbUrl = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
    const dbKey = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';
    try {
      const start = Date.now();
      const resDb = await fetch(`${dbUrl}/rest/v1/linked_accounts?select=*&limit=1`, {
        headers: {
          'apikey': dbKey,
          'Authorization': `Bearer ${dbKey}`
        }
      });
      supabaseStatus = {
        connected: resDb.ok,
        status: resDb.status,
        statusText: resDb.statusText,
        duration: Date.now() - start
      };
    } catch (err) {
      supabaseStatus.error = err.message;
    }

    // 4) Kirka Chat WebSocket Status
    let wsStatusHtml = '';
    let allWsOpen = true;
    try {
      const wsStatus = getWebSocketStatus();
      if (wsStatus && wsStatus.length > 0) {
        wsStatusHtml = `
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th>WS State</th>
              </tr>
            </thead>
            <tbody>
              ${wsStatus.map(ws => {
                let stateClass = 'node-disconnected';
                if (ws.state === 'OPEN') {
                  stateClass = 'node-connected';
                } else {
                  allWsOpen = false;
                }
                return `
                  <tr>
                    <td><strong>${ws.name}</strong></td>
                    <td class="${stateClass}">${ws.state}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      } else {
        wsStatusHtml = '<div style="color: var(--text-muted); text-align: center; padding: 10px;">No WebSockets connected.</div>';
      }
    } catch (e) {
      wsStatusHtml = `<div style="color: var(--color-danger); padding: 10px;">Error: ${e.message}</div>`;
    }

    // 5) System Uptime & memory
    const uptimeSec = process.uptime();
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);
    const uptimeStr = `${hrs}h ${mins}m ${secs}s`;

    const memory = process.memoryUsage();
    const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(1) + ' MB';
    const rss = (memory.rss / 1024 / 1024).toFixed(1) + ' MB';

    // Calculate overall health status
    let overallHealth = 'success';
    let overallText = 'All Systems Operational';
    if (!discordApiStatus.connected || discordApiStatus.status === 403) {
      overallHealth = 'danger';
      overallText = 'Discord Connection Blocked (IP Banned)';
    } else if (gatewayState === 'DISCONNECTED') {
      overallHealth = 'danger';
      overallText = 'Gateway Offline';
    } else if (!supabaseStatus.connected) {
      overallHealth = 'warning';
      overallText = 'Supabase DB Connection Failed';
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>KirkaHub Bot Status Dashboard</title>
          <style>
              :root {
                  --bg-color: #0b0f19;
                  --card-bg: #111827;
                  --border-color: #1f2937;
                  --text-color: #f3f4f6;
                  --text-muted: #9ca3af;
                  --color-success: #10b981;
                  --color-danger: #ef4444;
                  --color-warning: #f59e0b;
                  --accent-color: #3b82f6;
              }
              body {
                  background-color: var(--bg-color);
                  color: var(--text-color);
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  margin: 0;
                  padding: 24px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  min-height: 100vh;
              }
              .container {
                  width: 100%;
                  max-width: 900px;
              }
              header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid var(--border-color);
                  padding-bottom: 16px;
                  margin-bottom: 24px;
              }
              h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.5px;
                  background: linear-gradient(135deg, #60a5fa, #3b82f6);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
              }
              .refresh-btn {
                  background: var(--accent-color);
                  color: #fff;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-weight: 600;
                  cursor: pointer;
                  text-decoration: none;
                  font-size: 13px;
                  transition: all 0.2s;
              }
              .refresh-btn:hover {
                  opacity: 0.9;
              }
              .alert-box {
                  background: rgba(239, 68, 68, 0.1);
                  border: 1px solid rgba(239, 68, 68, 0.2);
                  color: #fca5a5;
                  padding: 18px 22px;
                  border-radius: 8px;
                  font-size: 14px;
                  margin-bottom: 24px;
                  line-height: 1.6;
              }
              .alert-box ol {
                  margin: 8px 0 0 20px;
                  padding: 0;
              }
              .alert-box li {
                  margin-bottom: 6px;
              }
              .grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 20px;
                  margin-bottom: 24px;
              }
              .card {
                  background: var(--card-bg);
                  border: 1px solid var(--border-color);
                  border-radius: 12px;
                  padding: 20px;
                  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
              }
              .card-title {
                  font-size: 13px;
                  font-weight: 700;
                  color: var(--text-muted);
                  text-transform: uppercase;
                  letter-spacing: 0.8px;
                  margin-top: 0;
                  margin-bottom: 16px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              .status-dot {
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  display: inline-block;
              }
              .status-dot.success { background-color: var(--color-success); box-shadow: 0 0 8px var(--color-success); }
              .status-dot.danger { background-color: var(--color-danger); box-shadow: 0 0 8px var(--color-danger); }
              .status-dot.warning { background-color: var(--color-warning); box-shadow: 0 0 8px var(--color-warning); }
              .info-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 12px;
                  font-size: 13px;
              }
              .info-label {
                  color: var(--text-muted);
              }
              .info-value {
                  font-weight: 600;
                  font-family: monospace;
              }
              .info-value.success { color: var(--color-success); }
              .info-value.danger { color: var(--color-danger); }
              .info-value.warning { color: var(--color-warning); }
              table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 12px;
                  text-align: left;
              }
              th, td {
                  padding: 8px 10px;
                  border-bottom: 1px solid var(--border-color);
              }
              th {
                  color: var(--text-muted);
                  font-weight: 600;
              }
              td.node-connected { color: var(--color-success); font-weight: bold; }
              td.node-connecting { color: var(--color-warning); }
              td.node-disconnected { color: var(--color-danger); }
              .footer {
                  text-align: center;
                  color: var(--text-muted);
                  font-size: 12px;
                  margin-top: 24px;
                  border-top: 1px solid var(--border-color);
                  padding-top: 16px;
              }
          </style>
          <script>
              setTimeout(() => {
                  window.location.reload();
              }, 12000);
          </script>
      </head>
      <body>
          <div class="container">
              <header>
                  <div>
                      <h1>KirkaHub Bot Status</h1>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Health dashboard for Render deployment</div>
                  </div>
                  <button class="refresh-btn" onclick="window.location.reload()">Refresh Now</button>
              </header>

              ${!discordApiStatus.connected || discordApiStatus.status === 403 ? `
              <div class="alert-box" style="border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);">
                  <strong style="color: #f87171; font-size: 16px; display: block; margin-bottom: 8px;">⚠️ Outbound Discord API Blocked in Region: ${serverLocationInfo.region}</strong>
                  <p style="margin: 0 0 12px 0;">Discord has blocked Render's outbound IP ranges in <strong>${serverLocationInfo.region} (${serverLocationInfo.country})</strong>. This returns HTTP 403 Forbidden, making it impossible for the bot to authenticate or connect.</p>
                  
                  <strong style="color: #fff; font-size: 13px; display: block; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 10px; margin-top: 10px;">🛠️ ACTIONABLE SOLUTIONS:</strong>
                  <ol>
                      <li><strong>Change Render Region:</strong> Discord frequently blocks different Render regions at random times. Go to your <strong>Render Dashboard ➜ Service Settings ➜ Region</strong> and change the region from <em>${serverLocationInfo.region}</em> to a different one (e.g. Frankfurt EU, Oregon US, or Virginia US), then click save to automatically rebuild.</li>
                      <li><strong>Rotate public IP (Clear Cache & Deploy):</strong> Click the <strong>"Manual Deploy"</strong> button in Render and select <strong>"Clear build cache & deploy"</strong>. Render may assign a new host outbound node that isn't banned by Discord yet.</li>
                      <li><strong>Route through an HTTP Proxy:</strong> Set up an outbound HTTP/HTTPS Proxy inside the bot using libraries like <code>https-proxy-agent</code> to mask the Render IP address with a clean proxy IP.</li>
                  </ol>
              </div>
              ` : ''}

              <div class="grid">
                  <!-- System Status Card -->
                  <div class="card">
                      <div class="card-title">
                          System Diagnostics
                          <span class="status-dot success"></span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Bot Status</span>
                          <span class="info-value success">ONLINE</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Server Location</span>
                          <span class="info-value" style="color: #60a5fa;">${serverLocationInfo.region} (${serverLocationInfo.country})</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">IP Address</span>
                          <span class="info-value">${serverLocationInfo.ip}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Uptime</span>
                          <span class="info-value">${uptimeStr}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Memory Heap</span>
                          <span class="info-value">${heapUsed}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Memory RSS</span>
                          <span class="info-value">${rss}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Node.js Version</span>
                          <span class="info-value">${process.version}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Environment</span>
                          <span class="info-value">${process.env.RENDER ? 'Render.com Cloud' : 'Local Sandbox'}</span>
                      </div>
                  </div>

                  <!-- Discord Status Card -->
                  <div class="card">
                      <div class="card-title">
                          Discord Connection
                          <span class="status-dot ${overallHealth}"></span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Outbound API Test</span>
                          <span class="info-value ${discordApiStatus.connected && discordApiStatus.status !== 403 ? 'success' : 'danger'}">
                              ${discordApiStatus.connected && discordApiStatus.status !== 403 ? 'CLEAN (200 OK)' : `BLOCKED (${discordApiStatus.status || 'Timeout'})`}
                          </span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Gateway Connection</span>
                          <span class="info-value ${gatewayState === 'READY' ? 'success' : 'danger'}">${gatewayState}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Gateway Ping</span>
                          <span class="info-value">${gatewayPing}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Rate Limited</span>
                          <span class="info-value ${discordApiStatus.rateLimited ? 'warning' : 'success'}">${discordApiStatus.rateLimited ? 'YES' : 'NO'}</span>
                      </div>
                      ${discordApiStatus.retryAfter ? `
                      <div class="info-row">
                          <span class="info-label">Rate Limit Retry</span>
                          <span class="info-value warning">${discordApiStatus.retryAfter}s</span>
                      </div>
                      ` : ''}
                  </div>

                  <!-- Database Status Card -->
                  <div class="card">
                      <div class="card-title">
                          Supabase Database
                          <span class="status-dot ${supabaseStatus.connected ? 'success' : 'danger'}"></span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Status</span>
                          <span class="info-value ${supabaseStatus.connected ? 'success' : 'danger'}">${supabaseStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">DB Ping Latency</span>
                          <span class="info-value">${supabaseStatus.connected ? `${supabaseStatus.duration}ms` : 'N/A'}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">HTTP Status</span>
                          <span class="info-value">${supabaseStatus.connected ? `${supabaseStatus.status} ${supabaseStatus.statusText}` : `${supabaseStatus.error || 'Connection Failed'}`}</span>
                      </div>
                  </div>
              </div>

              <!-- Kirka Chat WebSocket status -->
              <div class="card" style="margin-bottom: 24px;">
                  <div class="card-title">
                      Kirka Chat WebSocket Listener
                      <span class="status-dot ${allWsOpen ? 'success' : 'warning'}"></span>
                  </div>
                  ${wsStatusHtml}
              </div>

              <div class="footer">
                  KirkaHub Discord Bot Dashboard • Auto-refreshes every 10 seconds
              </div>
          </div>
      </body>
      </html>
    `;
    res.end(html);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'online', bot: client.user ? client.user.tag : 'initializing' }));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Health-check server listening on port ${PORT} (0.0.0.0)`);
});

client.on('warn', (info) => console.warn(`⚠️ [Discord Warn] ${info}`));
client.on('error', (err) => console.error(`❌ [Discord Error]`, err));
if (process.env.DEBUG_DISCORD === 'true') {
  client.on('debug', (info) => console.log(`⚙️ [Discord Debug] ${info}`));
}

console.log('🔌 Connecting to Discord Gateway...');
client.login(token).catch(err => {
  console.error('❌ Failed to login to Discord:', err);
  process.exit(1);
});
