import { createCanvas, loadImage } from '@napi-rs/canvas';

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
  const winRate = played > 0 ? (won / played).toFixed(2) : '0.00';
  const kpg = played > 0 ? (kills / played).toFixed(2) : '0.00';

  const level = profile?.level || 1;
  const currentXp = profile?.xpSinceLastLevel ?? 0;
  const xpUntilNext = profile?.xpUntilNextLevel ?? 410000;
  const totalXp = profile?.totalXp ?? profile?.xp ?? 0;
  const pct = Math.min(100, Math.max(0, Math.round((currentXp / xpUntilNext) * 100)));

  const clanStr = typeof profile?.clan === 'string' ? profile.clan : profile?.clan?.name || '';
  const clanTag = clanStr ? ` [${clanStr}]` : '';

  // 1. Background - Dark Kirka Teal/Green Voxel Map Style
  const gradBg = ctx.createLinearGradient(0, 0, width, height);
  gradBg.addColorStop(0, '#122e25');
  gradBg.addColorStop(0.5, '#163a2f');
  gradBg.addColorStop(1, '#0b1d17');
  ctx.fillStyle = gradBg;
  ctx.fillRect(0, 0, width, height);

  // Subtle background map blocks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(0, 0, width * 0.7, height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(width * 0.7, 0, width * 0.3, height);

  // 2. Avatar Box (Top Left)
  const avatarX = 35;
  const avatarY = 30;
  const avatarSize = 90;

  ctx.fillStyle = '#374151';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
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
  ctx.fillStyle = '#f59e0b'; // Kirka Gold
  ctx.textAlign = 'left';
  ctx.fillText(`${profile?.name || 'Unknown'}${clanTag}`, nameX, nameY);

  // Kirka Logo Badge (Top Right)
  ctx.save();
  ctx.translate(width - 135, 35);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(0, 0, 100, 36, 6);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = 'black 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('KIRKA', 50, 25);
  ctx.restore();

  // 4. XP Progress Bar
  const barX = 35;
  const barY = 140;
  const barW = width - 70;
  const barH = 32;

  // Bar Container
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 16);
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
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

  // 5. Stats Table (3 Rows x 5 Cols matching Image 2)
  const statsGrid = [
    [
      { label: 'Level', val: level },
      { label: 'Score', val: formatNumber(scores) },
      { label: 'Kills', val: formatNumber(kills) },
      { label: 'Deaths', val: formatNumber(deaths) },
      { label: 'Headshots', val: formatNumber(headshots) }
    ],
    [
      { label: 'Played', val: formatNumber(played) },
      { label: 'Won', val: formatNumber(won) },
      { label: 'Lost', val: formatNumber(lost) },
      { label: 'KPG', val: kpg },
      { label: 'KDR', val: kdr }
    ],
    [
      { label: 'W/L', val: winRate },
      { label: 'Coins', val: formatNumber(profile?.coins || 0) },
      { label: 'Diamonds', val: formatNumber(profile?.diamonds || profile?.gems || 0) },
      { label: 'Total XP', val: formatNumber(totalXp) },
      { label: 'Kirka ID', val: (profile?.shortId || profile?.id || 'N/A').substring(0, 8).toUpperCase() }
    ]
  ];

  const gridStartY = 210;
  const rowHeight = 70;
  const colWidth = (width - 70) / 5;

  statsGrid.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      const x = barX + cIdx * colWidth + colWidth / 2;
      const y = gridStartY + rIdx * rowHeight;

      // Label
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#fbbf24'; // Warm Gold
      ctx.textAlign = 'center';
      ctx.fillText(cell.label, x, y);

      // Value
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(cell.val), x, y + 28);
    });
  });

  // 6. Footer
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, height - 35, width, 35);

  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'left';
  ctx.fillText('💬 Kirka Tracker Bot', 25, height - 12);

  ctx.textAlign = 'right';
  ctx.fillText(`ID: ${profile?.id || ''}`, width - 25, height - 12);

  return canvas.toBuffer('image/png');
}
