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
    let query = lowerContent.startsWith('.inventory') ? content.substring(10).trim() : content.substring(4).trim();
    
    await message.channel.sendTyping();
    console.log(`[MessageReceived] Matched .inv! Query: "${query}"`);

    if (!query) {
      const linked = await getLinkedAccount(message.author.id);
      if (!linked) {
        return message.reply(`❌ You haven't linked a Kirka account yet. Use \`/link\` to bind your profile, or search for a player: \`.inv CrackedYOU\`.`);
      }
      query = linked.shortId;
    }

    try {
      const profile = await fetchUserProfile(query);
      if (!profile) {
        return message.reply(`❌ Could not find a Kirka player matching **${query}**.`);
      }

      const inventory = await fetchUserInventory(profile.id);
      if (!inventory || inventory.length === 0) {
        return message.reply(`📦 **${profile.name}** has no items in their Kirka inventory.`);
      }

      const priceMap = await getBoltPriceMap();

      let totalValue = 0;
      let totalSkinsCount = 0;

      inventory.forEach(invItem => {
        const item = invItem.item || invItem;
        const qty = invItem.amount || 1;
        const p = getItemPrice(priceMap, item);
        totalValue += p * qty;
        totalSkinsCount += qty;
      });

      const uniqueSkinsCount = inventory.length;

      const getSortWeight = (invItem) => {
        const item = invItem.item || invItem;
        const price = getItemPrice(priceMap, item);
        if (price > 0) return price;

        const rarity = (item.rarity || '').toLowerCase().trim();
        switch (rarity) {
          case 'contraband': return 50000000;
          case 'exotic':      return 35000000;
          case 'mythical':
          case 'mythic':     return 20000000;
          case 'legendary':  return 4000000;
          case 'epic':       return 500000;
          case 'rare':       return 50000;
          case 'uncommon':   return 5000;
          default:           return 1;
        }
      };

      const sortedInventory = [...inventory].sort((a, b) => getSortWeight(b) - getSortWeight(a));
      const pageItems = sortedInventory.slice(0, 25);
      const totalPages = Math.ceil(sortedInventory.length / 25);

      const imageBuffer = await renderInventoryGridPage({
        items: sortedInventory,
        pageItems,
        priceMap,
        pageIndex: 0,
        totalPages,
        username: profile.name
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'inventory-page-1.png' });

      const embed = new EmbedBuilder()
        .setColor('#3b82f6')
        .setDescription(
          '```text\n' +
          `• Skins Count:     ${totalSkinsCount.toLocaleString()} (${uniqueSkinsCount} unique)\n` +
          `• Inventory Value: ${formatValueLong(totalValue)}\n` +
          '```'
        )
        .setImage('attachment://inventory-page-1.png')
        .setFooter({
          text: `Page 1 of ${totalPages} • ${profile.name}#${(profile.shortId || '').toUpperCase()}`
        });

      await message.reply({
        embeds: [embed],
        files: [attachment]
      });
    } catch (err) {
      console.error('Error in prefix inv command:', err);
      await message.reply(`⚠️ Failed to render inventory grid.`);
    }
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
});

// Start lightweight HTTP server for Render.com health checks
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
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
