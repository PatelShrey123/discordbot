import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bgPath = join(__dirname, '../../assets/bg.jpg');

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

export async function renderProfileCard(profile) {
  const width = 760;
  const height = 460;
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

  // 1. Draw Custom Black Car with Headlights Background
  try {
    const bgImg = await loadImage(bgPath);
    ctx.drawImage(bgImg, 0, 0, width, height);
  } catch (err) {
    // Fallback gradient if background fails to load
    const gradBg = ctx.createLinearGradient(0, 0, width, height);
    gradBg.addColorStop(0, '#090a0f');
    gradBg.addColorStop(1, '#020205');
    ctx.fillStyle = gradBg;
    ctx.fillRect(0, 0, width, height);
  }

  // Semi-transparent dark overlay for high contrast text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, height);

  // 2. Avatar Box (Top Left)
  const avatarX = 35;
  const avatarY = 30;
  const avatarSize = 90;

  ctx.fillStyle = '#111827';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  ctx.strokeStyle = '#f59e0b'; // Gold border for avatar
  ctx.lineWidth = 3;
  ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

  // Try loading active body skin image if available
  const avatarUrl = profile?.activeBodySkin?.renderUrl || profile?.activeBodySkin?.textureUrl;
  if (avatarUrl) {
    try {
      const fullAvatarUrl = avatarUrl.startsWith('/') ? `https://kirka.io${avatarUrl}` : avatarUrl;
      const avatarImg = await loadImage(`https://images.weserv.nl/?url=${encodeURIComponent(fullAvatarUrl)}`);
      ctx.drawImage(avatarImg, avatarX + 5, avatarY + 5, avatarSize - 10, avatarSize - 10);
    } catch (e) {
      // Fallback
    }
  }

  // 3. Username & Clan Tag
  const nameX = 145;
  const nameY = 70;

  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#ffffff'; // White name text to pop against black backdrop
  ctx.textAlign = 'left';
  ctx.fillText(`${profile?.name || 'Unknown'}${clanTag}`, nameX, nameY);

  // Kirka Logo Badge (Top Right)
  ctx.save();
  ctx.translate(width - 135, 35);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(0, 0, 100, 36, 6);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = 'black 20px sans-serif';
  ctx.fillStyle = '#05060b';
  ctx.textAlign = 'center';
  ctx.fillText('KIRKA', 50, 25);
  ctx.restore();

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
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`${formatNumber(currentXp)} / ${formatNumber(xpUntilNext)}`, width / 2 - 20, barY + 22);

  ctx.textAlign = 'right';
  ctx.fillText(`${pct}%`, barX + barW - 15, barY + 22);

  // 5. Stats Table (3 Rows - NO Kirka ID)
  // Row 1 & 2 have 5 columns, Row 3 has 4 columns (centered)
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

  const row3 = [
    { label: 'W/L', val: wl },
    { label: 'Coins', val: formatNumber(profile?.coins || 0) },
    { label: 'Diamonds', val: formatNumber(profile?.diamonds || profile?.gems || 0) },
    { label: 'Total XP', val: formatNumber(totalXp) }
  ];

  const gridStartY = 210;
  const rowHeight = 70;

  // Draw Row 1 (5 columns)
  const colWidth5 = (width - 70) / 5;
  row1.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, gridStartY);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, gridStartY + 28);
  });

  // Draw Row 2 (5 columns)
  row2.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    const y = gridStartY + rowHeight;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  // Draw Row 3 (4 columns centered - NO Kirka ID)
  const colWidth4 = (width - 70) / 4;
  row3.forEach((cell, idx) => {
    const x = barX + idx * colWidth4 + colWidth4 / 2;
    const y = gridStartY + 2 * rowHeight;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  // 6. Footer (No UUID string on the right)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, height - 35, width, 35);

  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.fillText('💬 Kirka Tracker Bot', 25, height - 12);

  return canvas.toBuffer('image/png');
}
