import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ComponentType } from 'discord.js';
import { renderWeaponCard } from '../canvas/weaponCard.js';

export const WEAPON_DATA = {
  'ar-9': {
    id: 'ar-9',
    name: 'AR-9',
    category: 'Assault Rifle',
    icon: '🎯',
    color: '#38bdf8',
    renderUrl: 'https://kirka.io/assets/img/render-mini.a775673e.webp',
    damage: { body: 22, head: 33, limb: 18 },
    headshotMultiplier: 1.5,
    fireRateRPM: 600,
    shotDelayMs: 100,
    magSize: 30,
    reloadSec: 1.8,
    ttkBodyMs: 400,
    ttkHeadMs: 300,
    stkBody: 5,
    stkHead: 4,
    range: 'Medium (15 - 45m)',
    recoil: 'Low / Easy Control',
    pros: ['Very consistent recoil spray', 'Versatile across all Kirka maps', 'Fast 1.8s tactical reload'],
    cons: ['Out-damaged point-blank by MAC-10', 'Lower bullet damage than SCAR']
  },
  'scar': {
    id: 'scar',
    name: 'SCAR',
    category: 'Heavy Assault Rifle',
    icon: '💥',
    color: '#f59e0b',
    renderUrl: 'https://kirka.io/assets/img/render-mini.3fe021a4.webp',
    damage: { body: 30, head: 45, limb: 24 },
    headshotMultiplier: 1.5,
    fireRateRPM: 450,
    shotDelayMs: 133,
    magSize: 25,
    reloadSec: 2.0,
    ttkBodyMs: 399,
    ttkHeadMs: 266,
    stkBody: 4,
    stkHead: 3,
    range: 'Medium - Long (20 - 60m)',
    recoil: 'Moderate Kick',
    pros: ['Heavy 30 HP damage per bullet', 'Lethal 3-shot headshot kill (266ms)', 'Dominates mid-to-long sightlines'],
    cons: ['Slower fire rate (450 RPM)', 'Small 25-round magazine']
  },
  'lar': {
    id: 'lar',
    name: 'LAR',
    category: 'Marksman Rifle (DMR)',
    icon: '⚡',
    color: '#a855f7',
    renderUrl: 'https://kirka.io/assets/img/render-mini.350f0d22.webp',
    damage: { body: 38, head: 57, limb: 30 },
    headshotMultiplier: 1.5,
    fireRateRPM: 360,
    shotDelayMs: 166,
    magSize: 15,
    reloadSec: 1.7,
    ttkBodyMs: 332,
    ttkHeadMs: 166,
    stkBody: 3,
    stkHead: 2,
    range: 'Long (25 - 80m)',
    recoil: 'Sharp Vertical Kick',
    pros: ['Insane 166ms 2-tap headshot TTK', 'Pinpoint first-shot accuracy', 'Highest semi-auto burst in game'],
    cons: ['Very punishing if you miss shots', 'Small 15-round magazine capacity']
  },
  'm60': {
    id: 'm60',
    name: 'M60',
    category: 'Light Machine Gun',
    icon: '🛡️',
    color: '#ef4444',
    renderUrl: 'https://kirka.io/assets/img/render-mini.fc7a7fad.webp',
    damage: { body: 20, head: 30, limb: 16 },
    headshotMultiplier: 1.5,
    fireRateRPM: 650,
    shotDelayMs: 92,
    magSize: 60,
    reloadSec: 3.2,
    ttkBodyMs: 368,
    ttkHeadMs: 276,
    stkBody: 5,
    stkHead: 4,
    range: 'Medium (10 - 40m)',
    recoil: 'Continuous Shake',
    pros: ['Massive 60-round drum magazine', 'Continuous pre-fire corner pressure', 'Excellent multi-kill squad wipe'],
    cons: ['Slowest reload in Kirka (3.2s)', 'Slight movement penalty']
  },
  'vita': {
    id: 'vita',
    name: 'VITA',
    category: 'Bolt-Action Sniper',
    icon: '🔭',
    color: '#06b6d4',
    renderUrl: 'https://kirka.io/assets/img/render-mini.8e651770.webp',
    damage: { body: 90, head: 150, limb: 75 },
    headshotMultiplier: 1.67,
    fireRateRPM: 42,
    shotDelayMs: 1420,
    magSize: 5,
    reloadSec: 2.4,
    ttkBodyMs: 1420,
    ttkHeadMs: 0,
    stkBody: 2,
    stkHead: 1,
    range: 'Extreme Long (30 - 100m+)',
    recoil: 'High Bolt Jump',
    pros: ['Instant 1-shot kill to head (0ms TTK)', 'Maximum optic zoom magnification', 'Controls long lanes entirely'],
    cons: ['Extremely slow bolt cycle delay (1.4s)', 'Vulnerable at close range']
  },
  'mac-10': {
    id: 'mac-10',
    name: 'MAC-10',
    category: 'Submachine Gun',
    icon: '🔥',
    color: '#ec4899',
    renderUrl: 'https://kirka.io/assets/img/render-mini.0bf6c729.webp',
    damage: { body: 16, head: 24, limb: 13 },
    headshotMultiplier: 1.5,
    fireRateRPM: 900,
    shotDelayMs: 66,
    magSize: 32,
    reloadSec: 1.5,
    ttkBodyMs: 396,
    ttkHeadMs: 264,
    stkBody: 7,
    stkHead: 5,
    range: 'Close (0 - 20m)',
    recoil: 'High Vertical Climb',
    pros: ['Fastest firing primary (900 RPM)', 'Melts opponents in close quarters', 'Rapid 1.5s reload'],
    cons: ['Heavy damage falloff beyond 25m', 'Eats through ammo very quickly']
  },
  'weatie': {
    id: 'weatie',
    name: 'Weatie',
    category: 'Submachine Gun',
    icon: '🌀',
    color: '#10b981',
    renderUrl: 'https://kirka.io/assets/img/render-mini.cd1660a4.webp',
    damage: { body: 18, head: 27, limb: 14 },
    headshotMultiplier: 1.5,
    fireRateRPM: 750,
    shotDelayMs: 80,
    magSize: 40,
    reloadSec: 1.9,
    ttkBodyMs: 400,
    ttkHeadMs: 240,
    stkBody: 6,
    stkHead: 4,
    range: 'Close - Mid (5 - 30m)',
    recoil: 'Predictable Horizontal Spread',
    pros: ['High 40-round magazine capacity', 'Superior mobile hipfire accuracy', 'Balanced close-to-mid spray'],
    cons: ['Slightly lower close burst than MAC-10', 'Slower reload than AR-9']
  },
  'shark': {
    id: 'shark',
    name: 'Shark',
    category: 'Pump Shotgun',
    icon: '🦈',
    color: '#6366f1',
    renderUrl: 'https://kirka.io/assets/img/render-mini.67fdc7ae.webp',
    damage: { body: 105, head: 140, limb: 70 },
    headshotMultiplier: 1.33,
    fireRateRPM: 70,
    shotDelayMs: 857,
    magSize: 6,
    reloadSec: 2.4,
    ttkBodyMs: 0,
    ttkHeadMs: 0,
    stkBody: 1,
    stkHead: 1,
    range: 'Point Blank (0 - 10m)',
    recoil: 'Heavy Pump Snap',
    pros: ['Instant 1-pump kill point-blank (0ms TTK)', 'Deadly corner-jump peeking', 'Kings of indoor room control'],
    cons: ['Severe pellet spread past 15m', 'Long recovery delay between pumps']
  },
  'revolver': {
    id: 'revolver',
    name: 'Revolver',
    category: 'Heavy Handgun',
    icon: '🤠',
    color: '#eab308',
    renderUrl: 'https://kirka.io/assets/img/render-mini.f5c8d716.webp',
    damage: { body: 45, head: 68, limb: 35 },
    headshotMultiplier: 1.5,
    fireRateRPM: 210,
    shotDelayMs: 285,
    magSize: 6,
    reloadSec: 1.6,
    ttkBodyMs: 570,
    ttkHeadMs: 285,
    stkBody: 3,
    stkHead: 2,
    range: 'All Ranges (Sidearm)',
    recoil: 'Heavy Single-Action Kick',
    pros: ['Pocket sniper: 68 HP headshot', 'Instant switch-finisher for weak targets', 'High first-shot accuracy'],
    cons: ['Only 6-round cylinder', 'Requires high aim discipline']
  },
  'bayonet': {
    id: 'bayonet',
    name: 'Bayonet',
    category: 'Melee Knife',
    icon: '🗡️',
    color: '#cbd5e1',
    renderUrl: 'https://kirka.io/assets/img/render-mini.e0f2bc80.webp',
    damage: { body: 50, head: 100, limb: 50 },
    headshotMultiplier: 2.0,
    fireRateRPM: 120,
    shotDelayMs: 500,
    magSize: 'Infinite',
    reloadSec: 0,
    ttkBodyMs: 500,
    ttkHeadMs: 0,
    stkBody: 2,
    stkHead: 1,
    range: 'Melee (2.5m)',
    recoil: 'None',
    pros: ['Instant 1-hit kill backstab (0ms TTK)', 'Fastest sprint speed while held', 'Completely silent attack'],
    cons: ['Must be in melee range', 'High risk against shotguns']
  }
};

export function findWeapon(input) {
  if (!input) return null;
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const ALIASES = {
    'ar9': 'ar-9',
    'ar': 'ar-9',
    'scar': 'scar',
    'lar': 'lar',
    'dmr': 'lar',
    'm60': 'm60',
    'lmg': 'm60',
    'vita': 'vita',
    'sniper': 'vita',
    'mac': 'mac-10',
    'mac10': 'mac-10',
    'weatie': 'weatie',
    'weevl': 'weatie',
    'p90': 'weatie',
    'shark': 'shark',
    'shotgun': 'shark',
    'shotty': 'shark',
    'revolver': 'revolver',
    'pistol': 'revolver',
    'magnum': 'revolver',
    'bayonet': 'bayonet',
    'knife': 'bayonet',
    'blade': 'bayonet',
    'dagger': 'bayonet'
  };

  const matchedKey = ALIASES[clean];
  if (matchedKey && WEAPON_DATA[matchedKey]) {
    return WEAPON_DATA[matchedKey];
  }

  for (const [k, w] of Object.entries(WEAPON_DATA)) {
    if (k.replace(/[^a-z0-9]/g, '') === clean || w.name.toLowerCase().includes(input.toLowerCase())) {
      return w;
    }
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('weapon')
  .setDescription('View in-depth Kirka weapon stats, frame data, TTK, or compare two weapons head-to-head')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('gun')
      .setDescription('Primary weapon to inspect (e.g. AR-9, SCAR, VITA, LAR, Shark)')
      .setRequired(true)
      .addChoices(
        { name: '🎯 AR-9 (Assault Rifle)', value: 'ar-9' },
        { name: '💥 SCAR (Heavy Rifle)', value: 'scar' },
        { name: '⚡ LAR (Marksman DMR)', value: 'lar' },
        { name: '🛡️ M60 (Light Machine Gun)', value: 'm60' },
        { name: '🔭 VITA (Sniper Rifle)', value: 'vita' },
        { name: '🔥 MAC-10 (Close SMG)', value: 'mac-10' },
        { name: '🌀 Weatie (Balanced SMG)', value: 'weatie' },
        { name: '🦈 Shark (Pump Shotgun)', value: 'shark' },
        { name: '🤠 Revolver (Heavy Sidearm)', value: 'revolver' },
        { name: '🗡️ Bayonet (Melee Knife)', value: 'bayonet' }
      )
  )
  .addStringOption(option =>
    option.setName('compare_with')
      .setDescription('Optional second weapon to compare head-to-head against (e.g. SCAR, MAC-10)')
      .setRequired(false)
      .addChoices(
        { name: '🎯 AR-9', value: 'ar-9' },
        { name: '💥 SCAR', value: 'scar' },
        { name: '⚡ LAR', value: 'lar' },
        { name: '🛡️ M60', value: 'm60' },
        { name: '🔭 VITA', value: 'vita' },
        { name: '🔥 MAC-10', value: 'mac-10' },
        { name: '🌀 Weatie', value: 'weatie' },
        { name: '🦈 Shark', value: 'shark' },
        { name: '🤠 Revolver', value: 'revolver' },
        { name: '🗡️ Bayonet', value: 'bayonet' }
      )
  );

export function buildWeaponEmbed(w1, w2 = null) {
  if (w2) {
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Head-to-Head: ${w1.name} vs ${w2.name}`)
      .setColor('#38bdf8')
      .setDescription(
        `**${w1.name}**: \`${w1.category}\`  •  **${w2.name}**: \`${w2.category}\`\n\n` +
        `• **Headshot TTK:** ${w1.ttkHeadMs < w2.ttkHeadMs ? `🏆 **${w1.name}** (${w1.ttkHeadMs}ms)` : `🏆 **${w2.name}** (${w2.ttkHeadMs}ms)`}\n` +
        `• **Body TTK:** ${w1.ttkBodyMs < w2.ttkBodyMs ? `🏆 **${w1.name}** (${w1.ttkBodyMs}ms)` : `🏆 **${w2.name}** (${w2.ttkBodyMs}ms)`}\n` +
        `• **Fire Rate:** ${w1.fireRateRPM > w2.fireRateRPM ? `🏆 **${w1.name}** (${w1.fireRateRPM} RPM)` : `🏆 **${w2.name}** (${w2.fireRateRPM} RPM)`}\n` +
        `• **Per Shot Damage:** ${w1.damage.body > w2.damage.body ? `🏆 **${w1.name}** (${w1.damage.body} HP)` : `🏆 **${w2.name}** (${w2.damage.body} HP)`}\n` +
        `• **Reload Speed:** ${w1.reloadSec < w2.reloadSec ? `🏆 **${w1.name}** (${w1.reloadSec}s)` : `🏆 **${w2.name}** (${w2.reloadSec}s)`}`
      )
      .setImage('attachment://weapon-card.png')
      .setFooter({ text: 'KirkaHub Weapon Arsenal • Frame-accurate In-Game Metrics' })
      .setTimestamp();
    return embed;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${w1.icon} ${w1.name} — Detailed Weapon Profile`)
    .setColor(w1.color || '#38bdf8')
    .setDescription(
      `**Category:** \`${w1.category}\`\n` +
      `**Time-To-Kill (TTK):** ⚡ **${w1.ttkHeadMs}ms** (Head)  |  ⚡ **${w1.ttkBodyMs}ms** (Body)\n` +
      `**Damage:** Head **${w1.damage.head} HP** (${w1.headshotMultiplier}x)  •  Body **${w1.damage.body} HP**  •  Limb **${w1.damage.limb} HP**\n` +
      `**Fire Rate:** **${w1.fireRateRPM} RPM** (${w1.shotDelayMs}ms delay between bullets)\n` +
      `**Magazine:** **${w1.magSize} Rounds**  |  **Reload:** **${w1.reloadSec}s**\n` +
      `**Optimal Range:** ${w1.range}  |  **Recoil:** ${w1.recoil}`
    )
    .setImage('attachment://weapon-card.png')
    .setFooter({ text: 'KirkaHub Weapon Arsenal • Use .compare <gun1> <gun2> for head-to-head' })
    .setTimestamp();
  return embed;
}

export function buildWeaponButtons(w1, w2 = null) {
  const row = new ActionRowBuilder();

  if (w2) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`weapon_inspect_${w1.id}`)
        .setLabel(`Inspect ${w1.name}`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`weapon_inspect_${w2.id}`)
        .setLabel(`Inspect ${w2.name}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 View 3D Models')
        .setStyle(ButtonStyle.Link)
        .setURL('https://kirkahub.vercel.app/catalog')
    );
  } else {
    const rival = w1.id === 'ar-9' ? 'scar' : (w1.id === 'scar' ? 'ar-9' : (w1.id === 'mac-10' ? 'weatie' : 'ar-9'));
    const rivalObj = WEAPON_DATA[rival];
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`weapon_compare_${w1.id}_${rival}`)
        .setLabel(`⚔️ Compare with ${rivalObj.name}`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel('🌐 View 3D Models')
        .setStyle(ButtonStyle.Link)
        .setURL('https://kirkahub.vercel.app/catalog')
    );
  }

  return row;
}

export async function execute(interaction) {
  await interaction.deferReply();

  const gun1Key = interaction.options.getString('gun');
  const gun2Key = interaction.options.getString('compare_with');

  const w1 = findWeapon(gun1Key) || WEAPON_DATA['ar-9'];
  const w2 = gun2Key ? findWeapon(gun2Key) : null;

  const cardBuf = await renderWeaponCard(w1, w2);
  const attachment = new AttachmentBuilder(cardBuf, { name: 'weapon-card.png' });

  const message = await interaction.editReply({
    embeds: [buildWeaponEmbed(w1, w2)],
    files: [attachment],
    components: [buildWeaponButtons(w1, w2)]
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 90000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: 'Use your own `/weapon` or `.weapon` command!', ephemeral: true });
    }

    await btn.deferUpdate();

    if (btn.customId.startsWith('weapon_inspect_')) {
      const targetId = btn.customId.replace('weapon_inspect_', '');
      const targetW = WEAPON_DATA[targetId] || w1;
      const newBuf = await renderWeaponCard(targetW, null);
      const newAttachment = new AttachmentBuilder(newBuf, { name: 'weapon-card.png' });

      await interaction.editReply({
        embeds: [buildWeaponEmbed(targetW, null)],
        files: [newAttachment],
        components: [buildWeaponButtons(targetW, null)]
      });
    } else if (btn.customId.startsWith('weapon_compare_')) {
      const parts = btn.customId.replace('weapon_compare_', '').split('_');
      const targetW1 = WEAPON_DATA[parts[0]] || w1;
      const targetW2 = WEAPON_DATA[parts[1]] || WEAPON_DATA['scar'];
      const newBuf = await renderWeaponCard(targetW1, targetW2);
      const newAttachment = new AttachmentBuilder(newBuf, { name: 'weapon-card.png' });

      await interaction.editReply({
        embeds: [buildWeaponEmbed(targetW1, targetW2)],
        files: [newAttachment],
        components: [buildWeaponButtons(targetW1, targetW2)]
      });
    }
  });
}

export async function executePrefix(message, args = []) {
  if (args.length === 0) {
    // Overview of all weapons
    const listText = Object.values(WEAPON_DATA)
      .map(w => `• **${w.icon} ${w.name}** (\`${w.category}\`) — **${w.damage.body} HP** dmg | **${w.fireRateRPM} RPM** | **${w.ttkHeadMs}ms** TTK`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🔫 Kirka.io Arsenal & Weapon Database')
      .setColor('#38bdf8')
      .setDescription(
        `Select any weapon to view in-depth frame data, recoil, and TTK:\n\n${listText}\n\n` +
        `**Commands:**\n` +
        `• \`.weapon <name>\` (e.g. \`.weapon AR-9\`, \`.weapon VITA\`, \`.weapon Shark\`)\n` +
        `• \`.compare <gun1> <gun2>\` (e.g. \`.compare AR-9 SCAR\`, \`.weapon MAC-10 vs Weatie\`)`
      )
      .setFooter({ text: 'KirkaHub Weapon Arsenal' });

    return message.reply({ embeds: [embed] });
  }

  // Parse args for comparison (e.g. "ar-9 vs scar", "ar-9 scar", "compare ar-9 scar")
  const filteredArgs = args.filter(a => a.toLowerCase() !== 'vs' && a.toLowerCase() !== 'compare');
  const w1 = findWeapon(filteredArgs[0]);

  if (!w1) {
    return message.reply(`❌ Could not find weapon \`${args[0]}\`.\nAvailable weapons: **AR-9, SCAR, LAR, M60, VITA, MAC-10, Weatie, Shark, Revolver, Bayonet**.`);
  }

  const w2 = filteredArgs.length > 1 ? findWeapon(filteredArgs[1]) : null;

  await message.channel.sendTyping();

  const cardBuf = await renderWeaponCard(w1, w2);
  const attachment = new AttachmentBuilder(cardBuf, { name: 'weapon-card.png' });

  const replyMsg = await message.reply({
    embeds: [buildWeaponEmbed(w1, w2)],
    files: [attachment],
    components: [buildWeaponButtons(w1, w2)]
  });

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 90000
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== message.author.id) {
      return btn.reply({ content: 'Use your own `.weapon` command!', ephemeral: true });
    }

    await btn.deferUpdate();

    if (btn.customId.startsWith('weapon_inspect_')) {
      const targetId = btn.customId.replace('weapon_inspect_', '');
      const targetW = WEAPON_DATA[targetId] || w1;
      const newBuf = await renderWeaponCard(targetW, null);
      const newAttachment = new AttachmentBuilder(newBuf, { name: 'weapon-card.png' });

      await replyMsg.edit({
        embeds: [buildWeaponEmbed(targetW, null)],
        files: [newAttachment],
        components: [buildWeaponButtons(targetW, null)]
      });
    } else if (btn.customId.startsWith('weapon_compare_')) {
      const parts = btn.customId.replace('weapon_compare_', '').split('_');
      const targetW1 = WEAPON_DATA[parts[0]] || w1;
      const targetW2 = WEAPON_DATA[parts[1]] || WEAPON_DATA['scar'];
      const newBuf = await renderWeaponCard(targetW1, targetW2);
      const newAttachment = new AttachmentBuilder(newBuf, { name: 'weapon-card.png' });

      await replyMsg.edit({
        embeds: [buildWeaponEmbed(targetW1, targetW2)],
        files: [newAttachment],
        components: [buildWeaponButtons(targetW1, targetW2)]
      });
    }
  });
}
