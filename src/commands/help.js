import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View the complete KirkaHub bot guide, command list, and custom background tutorial')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Jump straight to a specific help section')
      .setRequired(false)
      .addChoices(
        { name: '🏠 Overview & Quick Start', value: 'home' },
        { name: '👤 Profile & Custom Background (.h)', value: 'profile' },
        { name: '🔄 Live Trades & Skins', value: 'trading' },
        { name: '🔫 Weapons & TTK Shootout', value: 'weapons' },
        { name: '🎲 Chest Simulator & Clans', value: 'clans' }
      )
  );

export function buildHelpEmbed(category = 'home') {
  if (category === 'profile') {
    return new EmbedBuilder()
      .setTitle('👤 Profile, Linking & Custom Backgrounds (.h)')
      .setColor(0xa855f7)
      .setDescription(
        `### 🎨 How to Set a Custom Profile Background (\`.h\`)\n` +
        `KirkaHub allows you to customize the card background shown on \`.profile\` with **any image or GIF you want**!\n\n` +
        `**Step 1: Link your Kirka account**\n` +
        `• Run \`.link <YourKirkaName>\` (or \`/link username:<name>\`).\n` +
        `• The bot will give you a quick verification code. Paste the code into your Kirka in-game bio for 10 seconds, then confirm!\n\n` +
        `**Step 2: Set your custom background**\n` +
        `• **Option A (Direct upload):** Send an image into chat with \`.h\` as the message caption.\n` +
        `• **Option B (Link):** Type \`.h <image_url>\` (e.g. \`.h https://i.imgur.com/example.png\`).\n` +
        `• **Option C (Slash):** Run \`/h image:[upload]\` or \`/h url:[link]\`.\n\n` +
        `> 💡 **Permanent Cloud Storage:** Your background is converted to permanent data storage in our Supabase database — **it will never expire or reset** when servers restart!\n\n` +
        `### 📋 Profile Commands:\n` +
        `• \`.profile [@DiscordUser/user]\` — Render your HD esports player card with 3D skins, clan tag, and K/D. Mention anyone to see their linked profile!\n` +
        `• \`.inv [@DiscordUser/user]\` — View a player's inventory grid & Bolt valuation. Mention anyone to see their inventory!\n` +
        `• \`.h [image/url]\` — Set or update your custom profile card background.\n` +
        `• \`.link <user>\` — Securely link your Discord account to your Kirka profile.\n` +
        `• \`.unlink\` — Disconnect your linked profile.`
      )
      .setFooter({ text: 'KirkaHub Guide • Use buttons below to switch sections' });
  }

  if (category === 'trading') {
    return new EmbedBuilder()
      .setTitle('🔄 Live Trades & 3D Skin Catalog')
      .setColor(0x38bdf8)
      .setDescription(
        `### 📈 Real-Time Trading Portal (\`.trade\`)\n` +
        `The bot connects directly to **Luke Skywalk\'s Live Kirka Trades API** and evaluates deals using the official community **Bolt Pricing Sheet** (\`⚡ Bolts\`).\n\n` +
        `**Visual Graphic Cards:** Every trade listing renders a visual card with official Kirka 3D weapon renders, rarity borders, and a profit/loss assessment!\n\n` +
        `### 📋 Trading Commands:\n` +
        `• \`.trade\` — Browse all current active trade offers on Kirka.\n` +
        `• \`.trade <skin>\` — Search active listings for a specific skin (e.g. \`.trade Hi-Score\`, \`.trade Shark\`, \`.trade Sinister\`).\n` +
        `• \`.trade history [skin]\` — Search completed and accepted trade history deals.\n` +
        `• \`.skin <name>\` — Inspect any skin in the game with its live market value in Bolts, rarity, and Kirka 3D preview link.\n` +
        `• \`.store [view]\` — View live in-game store bundles, weapon skins, and limited stock counters (e.g. Capybara 12/25 left) with renders.\n` +
        `• \`.storeupdate\` — Subscribe to real-time pings whenever a new limited drop occurs or the store rotates.\n` +
        `• \`.inv [user]\` — Render an ultra-sharp 2X HD inventory grid card showing a player\'s owned items and total inventory valuation in Bolts!\n\n` +
        `> 💡 **One-Click Switcher:** When viewing trades, use the \`[Show Trade History 📜]\` and \`[Show Active Offers 🟢]\` buttons to toggle modes without retyping!`
      )
      .setFooter({ text: 'KirkaHub Guide • Use buttons below to switch sections' });
  }

  if (category === 'weapons') {
    return new EmbedBuilder()
      .setTitle('🔫 Weapon Arsenal & TTK Frame Data')
      .setColor(0xf59e0b)
      .setDescription(
        `### ⚔️ Frame-Accurate Kirka Weapon Metrics (\`.weapon\` & \`.compare\`)\n` +
        `Analyze real in-game physics, DPS, recoil, and Time-To-Kill (TTK) against Kirka\'s 100 HP health pool.\n\n` +
        `**Single Weapon Card:** Shows official 3D render, Headshot/Body/Limb damage breakdown, RPM fire rate, reload time, effective engagement range, and tactical Pros & Cons.\n\n` +
        `**Shootout Comparison:** Compares two weapons side-by-side with \`🏆\` winner badges highlighting faster TTK, higher damage, bigger magazine, and faster reload.\n\n` +
        `### 📋 Weapon Commands:\n` +
        `• \`.weapon <gun>\` — Inspect a weapon (e.g. \`.weapon AR-9\`, \`.gun SCAR\`, \`.ttk VITA\`).\n` +
        `• \`.compare <gun1> <gun2>\` — Compare two guns head-to-head (e.g. \`.compare AR-9 SCAR\`, \`.weapon MAC-10 vs Weatie\`).\n` +
        `• \`.weapons\` — Display quick stats and damage for all 10 Kirka weapons.\n\n` +
        `**Available Guns:** \`AR-9\`, \`SCAR\`, \`LAR\`, \`M60\`, \`VITA\`, \`MAC-10\`, \`Weatie\`, \`Shark\`, \`Revolver\`, \`Bayonet\`.`
      )
      .setFooter({ text: 'KirkaHub Guide • Use buttons below to switch sections' });
  }

  if (category === 'clans') {
    return new EmbedBuilder()
      .setTitle('🎲 Chest Simulator, Clans & Competitive')
      .setColor(0x22c55e)
      .setDescription(
        `### 🎁 Official Chest Opening Simulator (\`.unbox\`)\n` +
        `Test your luck opening authentic Kirka chests with official drop probabilities, skin renders, and market price tags!\n` +
        `• \`.unbox\` — Opens a Wood Chest (50 Coins).\n` +
        `• \`.unbox <chest>\` — Choose \`ice\`, \`golden\`, \`halloween\`, or \`christmas\`.\n` +
        `• Includes an interactive \`[🎲 Open Another]\` button to spam unbox!\n\n` +
        `### 🏆 Clans & Leaderboards:\n` +
        `• \`.clan <tag>\` — Generate a visual roster card with member stats, level, and war points.\n` +
        `• \`.ranked [category]\` — View the top competitive Kirka players in Solo, Ranked, or 1v1.\n` +
        `• \`.leaderboard\` — Inspect top global players by kills, wins, and level.\n` +
        `• \`.quests\` — View live daily and weekly in-game Kirka quests and diamond rewards.\n\n` +
        `### 🌐 Live Server Browser (\`.servers\`):\n` +
        `• \`.servers [region]\` — View active rooms and matches in \`india\`, \`asia\`, \`eu\`, \`na\`, or \`sa\`.\n` +
        `• Renders real Kirka map background screenshots for every room, player counts (\`1/8\`), and interactive region switch buttons!`
      )
      .setFooter({ text: 'KirkaHub Guide • Use buttons below to switch sections' });
  }

  // Default 'home' Overview Embed
  return new EmbedBuilder()
    .setTitle('🎮 KirkaHub Bot — Official Guide & Commands')
    .setColor(0x38bdf8)
    .setDescription(
      `Welcome to **KirkaHub Bot**, the ultimate companion for Kirka.io players, traders, and competitive clans!\n\n` +
      `### ⚡ Quick Start for New Players:\n` +
      `**1.** Run \`.link <Username>\` to link your Kirka account.\n` +
      `**2.** Type \`.profile\` to view your rendered esports player card.\n` +
      `**3.** Customize your card with \`.h <image>\` — **it will never expire!**\n` +
      `**4.** Check live trades with \`.trade <skin>\` or inspect guns with \`.weapon <name>\`.\n` +
      `**5.** Test your unboxing luck with \`.unbox golden\`!\n\n` +
      `### 🗂️ Command Categories:\n` +
      `• **👤 Profile & Background:** \`.profile\`, \`.link\`, \`.h\` (Custom BG), \`.unlink\`\n` +
      `• **🎒 Inventory & Skins:** \`.inv [user]\`, \`.skin <name>\`\n` +
      `• **🔄 Live Trading:** \`.trade [skin]\`, \`.trade history [skin]\`\n` +
      `• **🔫 Weapons & TTK:** \`.weapon <gun>\`, \`.compare <gun1> <gun2>\`, \`.weapons\`\n` +
      `• **🎲 Chests & Quests:** \`.unbox [chest]\`, \`.quests\`\n` +
      `• **🏆 Clans & Ranked:** \`.clan <tag>\`, \`.ranked\`, \`.leaderboard\`\n` +
      `• **🌐 Live Server Browser:** \`.servers [region]\`, \`.rooms\` (India, Asia, EU, NA, SA)\n\n` +
      `> 💡 **Tip:** Every command supports both slash (\`/command\`) and prefix (\`.command\`) triggers! Click any button below for a detailed walkthrough.`
    )
    .setFooter({ text: 'KirkaHub Bot • Select a category below to learn more' })
    .setTimestamp();
}

export function buildHelpButtons(activeCategory = 'home') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_cat_home')
      .setLabel('🏠 Overview')
      .setStyle(activeCategory === 'home' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_cat_profile')
      .setLabel('👤 Profile & Custom BG (.h)')
      .setStyle(activeCategory === 'profile' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_cat_trading')
      .setLabel('🔄 Live Trades & Skins')
      .setStyle(activeCategory === 'trading' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_cat_weapons')
      .setLabel('🔫 Weapons & TTK')
      .setStyle(activeCategory === 'weapons' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_cat_clans')
      .setLabel('🎲 Chests & Clans')
      .setStyle(activeCategory === 'clans' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

export async function execute(interaction) {
  const chosenCat = interaction.options.getString('category') || 'home';

  const reply = await interaction.reply({
    embeds: [buildHelpEmbed(chosenCat)],
    components: [buildHelpButtons(chosenCat)]
  });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: 'Use your own `/help` or `.help` command to browse!', ephemeral: true });
    }

    await btn.deferUpdate();
    const cat = btn.customId.replace('help_cat_', '');

    await interaction.editReply({
      embeds: [buildHelpEmbed(cat)],
      components: [buildHelpButtons(cat)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_dis_1').setLabel('🏠 Overview').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_2').setLabel('👤 Profile & BG').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_3').setLabel('🔄 Trades').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_4').setLabel('🔫 Weapons').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setLabel('🌐 Open KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app')
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch {}
  });
}

export async function executePrefix(message, args = []) {
  let category = 'home';
  if (args.length > 0) {
    const raw = args[0].toLowerCase();
    if (raw.includes('prof') || raw.includes('bg') || raw === 'h' || raw.includes('back')) {
      category = 'profile';
    } else if (raw.includes('trade') || raw.includes('skin')) {
      category = 'trading';
    } else if (raw.includes('gun') || raw.includes('weap') || raw.includes('ttk')) {
      category = 'weapons';
    } else if (raw.includes('clan') || raw.includes('box') || raw.includes('chest')) {
      category = 'clans';
    }
  }

  const replyMsg = await message.reply({
    embeds: [buildHelpEmbed(category)],
    components: [buildHelpButtons(category)]
  });

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== message.author.id) {
      return btn.reply({ content: 'Use your own `.help` or `/help` command to browse!', ephemeral: true });
    }

    await btn.deferUpdate();
    const cat = btn.customId.replace('help_cat_', '');

    await replyMsg.edit({
      embeds: [buildHelpEmbed(cat)],
      components: [buildHelpButtons(cat)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_dis_1').setLabel('🏠 Overview').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_2').setLabel('👤 Profile & BG').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_3').setLabel('🔄 Trades').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('help_dis_4').setLabel('🔫 Weapons').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setLabel('🌐 Open KirkaHub').setStyle(ButtonStyle.Link).setURL('https://kirkahub.vercel.app')
      );
      await replyMsg.edit({ components: [disabledRow] });
    } catch {}
  });
}
