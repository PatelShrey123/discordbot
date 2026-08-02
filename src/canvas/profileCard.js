import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bgPath = join(__dirname, '../../assets/bg.jpg');

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'RobotoBold');
} catch (err) {
  console.warn('Failed to register Roboto fonts in profileCard:', err.message);
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

export async function renderProfileCard(profile, customBgUrl = null) {
  const width = 760;
  const height = 425; // Adjusted height since footer is removed
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Safely extract stats from Kirka API schema
  const stats = profile?.stats || {};
  const kills = stats.kills ?? profile?.kills ?? 0;
  const deaths = stats.deaths ?? profile?.deaths ?? 0;
  const headshots = stats.headshots ?? profile?.headshots ?? 0;
  const scores = stats.scores ?? profile?.score ?? 0;
  const played = stats.games ?? profile?.gamesPlayed ?? 0;
  const won = stats.wins ?? profile?.victories ?? 0;
  const lost = Math.max(0, played - won);

  const kdr = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
  const wl = lost > 0 ? (won / lost).toFixed(2) : won.toFixed(2);
  const kpg = played > 0 ? (kills / played).toFixed(2) : '0.00';

  const level = profile?.level || 1;
  const currentXp = profile?.xpSinceLastLevel ?? 0;
  const xpUntilNext = profile?.xpUntilNextLevel ?? 410000;
  const totalXp = profile?.totalXp ?? profile?.xp ?? 0;
  const pct = Math.min(100, Math.max(0, Math.round((currentXp / xpUntilNext) * 100)));

  const clanStr = typeof profile?.clan === 'string' ? profile.clan : profile?.clan?.name || '';
  const clanTag = clanStr ? ` [${clanStr}]` : '';

  // 1. Draw Custom Background (Custom or default black car with headlights bg)
  let bgImg = null;
  if (customBgUrl) {
    try {
      bgImg = await getCachedImage(customBgUrl);
    } catch (err) {
      console.warn('[ProfileCard] Failed to load custom background, falling back to default:', err.message);
    }
  }

  if (!bgImg) {
    try {
      bgImg = await getCachedImage(bgPath);
    } catch (err) {
      console.warn('[ProfileCard] Failed to load default background:', err.message);
    }
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    const gradBg = ctx.createLinearGradient(0, 0, width, height);
    gradBg.addColorStop(0, '#090a0f');
    gradBg.addColorStop(1, '#020205');
    ctx.fillStyle = gradBg;
    ctx.fillRect(0, 0, width, height);
  }

  // Semi-transparent dark overlay for high contrast text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, height);

  // 2. Avatar Box (Top Left) - Render pixel-art face of equipped skin
  const avatarX = 35;
  const avatarY = 30;
  const avatarSize = 90;

  ctx.fillStyle = '#111827';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  ctx.strokeStyle = '#f59e0b'; // Gold border for avatar
  ctx.lineWidth = 3;
  ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

  // Load and render character face crop from texture sheet
  let textureUrl = profile?.activeBodySkin?.textureUrl || profile?.activeBodySkin?.renderUrl;
  if (textureUrl) {
    try {
      let cleanUrl = textureUrl.trim();
      if (cleanUrl.includes('data:image/')) {
        cleanUrl = cleanUrl.substring(cleanUrl.indexOf('data:image/'));
      }
      
      let finalUrl = cleanUrl;
      if (!cleanUrl.startsWith('data:')) {
        finalUrl = cleanUrl.startsWith('/') ? `https://kirka.io${cleanUrl}` : cleanUrl;
      }
      const textureImg = await getCachedImage(finalUrl);
      
      // Check if texture image is loaded successfully and has expected dimensions
      if (textureImg && textureImg.width > 0 && textureImg.height > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = false; // Keep sharp pixel-art style!

        const scale = textureImg.width / 64;

        // 1. Draw base head front face: source rect (8, 8, 8, 8)
        ctx.drawImage(
          textureImg,
          8 * scale, 8 * scale, 8 * scale, 8 * scale, // source
          avatarX + 4, avatarY + 4, avatarSize - 8, avatarSize - 8 // dest
        );

        // 2. Draw overlay head front face (hair/hat): source rect (40, 8, 8, 8)
        ctx.drawImage(
          textureImg,
          40 * scale, 8 * scale, 8 * scale, 8 * scale, // source
          avatarX + 4, avatarY + 4, avatarSize - 8, avatarSize - 8 // dest
        );

        ctx.restore();
      }
    } catch (e) {
      console.warn('Failed to render pixel-art avatar face, using fallback render:', e.message);
      // Fallback: draw full skin render scaled down
      try {
        const renderUrl = profile?.activeBodySkin?.renderUrl;
        if (renderUrl) {
          const fullRenderUrl = renderUrl.startsWith('/') ? `https://kirka.io${renderUrl}` : renderUrl;
          const avatarImg = await getCachedImage(fullRenderUrl);
          if (avatarImg) {
            ctx.drawImage(avatarImg, avatarX + 8, avatarY + 5, avatarSize - 16, avatarSize - 10);
          }
        }
      } catch (err) {}
    }
  }

  // 3. Username & Clan Tag
  const nameX = 145;
  const nameY = 80; // slightly lower center

  ctx.font = 'bold 34px RobotoBold';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${profile?.name || 'Unknown'}${clanTag}`, nameX, nameY);

  // 4. XP Progress Bar
  const barX = 35;
  const barY = 140;
  const barW = width - 70;
  const barH = 32;

  // Bar Container
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 16);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Progress Fill
  if (pct > 0) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(barX + 2, barY + 2, Math.max(16, (barW - 4) * (pct / 100)), barH - 4, 14);
    ctx.fill();
  }

  // XP Text
  ctx.font = 'bold 16px RobotoBold';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`${formatNumber(currentXp)} / ${formatNumber(xpUntilNext)}`, width / 2 - 20, barY + 22);

  ctx.textAlign = 'right';
  ctx.fillText(`${pct}%`, barX + barW - 15, barY + 22);

  // 5. Stats Table (3 Rows - NO Kirka ID)
  const row1 = [
    { label: 'Level', val: level },
    { label: 'Score', val: formatNumber(scores) },
    { label: 'Kills', val: formatNumber(kills) },
    { label: 'Deaths', val: formatNumber(deaths) },
    { label: 'Headshots', val: formatNumber(headshots) }
  ];

  const row2 = [
    { label: 'Played', val: formatNumber(played) },
    { label: 'Won', val: formatNumber(won) },
    { label: 'Lost', val: formatNumber(lost) },
    { label: 'KPG', val: kpg },
    { label: 'KDR', val: kdr }
  ];

  const getAccountAgeDays = (createdAt) => {
    if (!createdAt) return '—';
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const row3 = [
    { label: 'W/L', val: wl },
    { label: 'Coins', val: formatNumber(profile?.coins || 0) },
    { label: 'Diamonds', val: formatNumber(profile?.diamonds || profile?.gems || 0) },
    { label: 'Total XP', val: formatNumber(totalXp) },
    { label: 'Created', val: getAccountAgeDays(profile?.createdAt) }
  ];

  const gridStartY = 210;
  const rowHeight = 70;

  // Draw Row 1 (5 columns)
  const colWidth5 = (width - 70) / 5;
  row1.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    ctx.font = 'bold 16px RobotoBold';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, gridStartY);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, gridStartY + 28);
  });

  // Draw Row 2 (5 columns)
  row2.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    const y = gridStartY + rowHeight;
    ctx.font = 'bold 16px RobotoBold';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  // Draw Row 3 (5 columns aligned)
  row3.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    const y = gridStartY + 2 * rowHeight;
    ctx.font = 'bold 16px RobotoBold';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  return canvas.toBuffer('image/png');
}
