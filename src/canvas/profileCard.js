import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage, getRawImageBuffer } from './imageLoader.js';
import { getVipProfileInfo } from '../utils/vip.js';
import omggif from 'omggif';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bgPath = join(__dirname, '../../assets/bg.jpg');

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'Roboto-Bold');
} catch (err) {
  console.warn('Failed to register Doto fonts in profileCard:', err.message);
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

function drawDiscordLogo(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = '#5865F2'; // Discord color
  
  ctx.beginPath();
  ctx.moveTo(18.97, 4.88);
  ctx.bezierCurveTo(17.62, 4.25, 16.17, 3.79, 14.64, 3.53);
  ctx.bezierCurveTo(14.45, 3.87, 14.24, 4.25, 14.09, 4.62);
  ctx.bezierCurveTo(12.45, 4.37, 10.82, 4.37, 9.22, 4.62);
  ctx.bezierCurveTo(9.07, 4.25, 8.85, 3.87, 8.66, 3.53);
  ctx.bezierCurveTo(7.13, 3.79, 5.68, 4.25, 4.33, 4.88);
  ctx.bezierCurveTo(1.6, 8.99, 0.9, 13.0, 1.27, 16.97);
  ctx.bezierCurveTo(3.07, 18.29, 4.79, 19.09, 6.49, 19.62);
  ctx.bezierCurveTo(6.91, 19.04, 7.29, 18.42, 7.61, 17.76);
  ctx.bezierCurveTo(6.99, 17.53, 6.4, 17.24, 5.84, 16.89);
  ctx.bezierCurveTo(5.99, 16.78, 6.13, 16.67, 6.27, 16.55);
  ctx.bezierCurveTo(9.68, 18.12, 13.39, 18.12, 16.75, 16.55);
  ctx.bezierCurveTo(16.89, 16.67, 17.03, 16.78, 17.18, 16.89);
  ctx.bezierCurveTo(16.62, 17.24, 16.03, 17.53, 15.41, 17.76);
  ctx.bezierCurveTo(15.73, 18.42, 16.11, 19.04, 16.53, 19.62);
  ctx.bezierCurveTo(18.23, 19.09, 19.95, 18.29, 21.75, 16.97);
  ctx.bezierCurveTo(22.19, 12.34, 21.01, 8.38, 19.18, 4.88);
  ctx.closePath();
  ctx.fill();

  // Left Eye
  ctx.beginPath();
  ctx.arc(8.02, 12.24, 1.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Right Eye
  ctx.beginPath();
  ctx.arc(15.98, 12.24, 1.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  
  ctx.restore();
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawLightning(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(9, 1);
  ctx.lineTo(3, 9);
  ctx.lineTo(8, 9);
  ctx.lineTo(7, 15);
  ctx.lineTo(13, 7);
  ctx.lineTo(8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Render all text, avatar, badges, progress bar, and stats onto a canvas.
 * Can be called onto a transparent canvas for overlaying onto GIF frames,
 * or onto an existing canvas for static rendering.
 */
export async function drawProfileForeground(ctx, width, height, profile, discordUsername = null) {
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

  // Semi-transparent dark overlay for high contrast text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, height);

  // Check VIP Status
  const vip = getVipProfileInfo(profile);

  // 2. Avatar Box (Top Left) - Render pixel-art face of equipped skin
  const avatarX = 35;
  const avatarY = 30;
  const avatarSize = 90;

  ctx.fillStyle = '#111827';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  ctx.strokeStyle = vip ? vip.borderColor : '#f59e0b';
  ctx.lineWidth = vip ? 3.5 : 3;
  if (vip) {
    ctx.save();
    ctx.shadowColor = vip.glowColor;
    ctx.shadowBlur = 14;
    ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } else {
    ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);
  }

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
      
      if (textureImg && textureImg.width > 0 && textureImg.height > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        const scale = textureImg.width / 64;

        // 1. Base head front face
        ctx.drawImage(
          textureImg,
          8 * scale, 8 * scale, 8 * scale, 8 * scale,
          avatarX + 4, avatarY + 4, avatarSize - 8, avatarSize - 8
        );

        // 2. Overlay head front face
        ctx.drawImage(
          textureImg,
          40 * scale, 8 * scale, 8 * scale, 8 * scale,
          avatarX + 4, avatarY + 4, avatarSize - 8, avatarSize - 8
        );

        ctx.restore();
      }
    } catch (e) {
      console.warn('Failed to render pixel-art avatar face, using fallback render:', e.message);
      try {
        const renderUrl = profile?.activeBodySkin?.renderUrl;
        if (renderUrl) {
          const fullRenderUrl = renderUrl.startsWith('/') ? `https://kirka.io${renderUrl}` : renderUrl;
          const avatarImg = await getCachedImage(fullRenderUrl);
          if (avatarImg) {
            ctx.drawImage(avatarImg, avatarX + 8, avatarY + 5, avatarSize - 16, avatarSize - 10);
          }
        }
      } catch {}
    }
  }

  // 3. Username & Clan Tag
  const nameX = 145;
  const nameY = 80;
  const fullName = `${profile?.name || 'Unknown'}${clanTag}`;

  const badgeW = 205;
  const badgeH = 46;
  const badgeX = width - 35 - badgeW;
  const badgeY = 52;

  const maxNameWidth = vip ? badgeX - nameX - 15 : width - nameX - 35;
  let fontSize = 34;
  ctx.font = `bold ${fontSize}px Roboto`;
  while (ctx.measureText(fullName).width > maxNameWidth && fontSize > 20) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px Roboto`;
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(fullName, nameX, nameY);

  // 3b. VIP Member Badge in Top Right
  if (vip) {
    ctx.save();
    ctx.shadowColor = vip.glowColor;
    ctx.shadowBlur = 16;

    const bgGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    bgGrad.addColorStop(0, vip.gradientStart);
    bgGrad.addColorStop(0.5, vip.gradientMiddle);
    bgGrad.addColorStop(1, vip.gradientEnd);

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
    ctx.fill();

    ctx.strokeStyle = vip.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    const topText = 'VIP MEMBER';
    ctx.font = 'bold 11px Roboto';
    const topTextWidth = ctx.measureText(topText).width;
    const topTotalW = topTextWidth + 16;
    const topStartX = badgeX + (badgeW - topTotalW) / 2;
    drawStar(ctx, topStartX + 4, badgeY + 14, 5, 5, 2.5, vip.secondaryColor);
    ctx.fillStyle = vip.secondaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(topText, topStartX + 16, badgeY + 18);

    const bottomText = vip.type === 'yip' ? 'YIP' : 'SOULLESS';
    ctx.font = 'bold 16px Roboto';
    const bottomTextWidth = ctx.measureText(bottomText).width;
    const bottomTotalW = bottomTextWidth + 18;
    const bottomStartX = badgeX + (badgeW - bottomTotalW) / 2;
    drawLightning(ctx, bottomStartX, badgeY + 24, 14, vip.primaryColor);
    ctx.fillStyle = vip.primaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(bottomText, bottomStartX + 18, badgeY + 37);

    ctx.restore();
  }

  // 4. XP Progress Bar
  const barX = 35;
  const barY = 140;
  const barW = width - 70;
  const barH = 32;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 16);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (pct > 0) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(barX + 2, barY + 2, Math.max(16, (barW - 4) * (pct / 100)), barH - 4, 14);
    ctx.fill();
  }

  ctx.font = 'bold 16px Roboto';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`${formatNumber(currentXp)} / ${formatNumber(xpUntilNext)}`, width / 2 - 20, barY + 22);

  ctx.textAlign = 'right';
  ctx.fillText(`${pct}%`, barX + barW - 15, barY + 22);

  // 5. Stats Table (3 Rows)
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
  const colWidth5 = (width - 70) / 5;

  row1.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    ctx.font = 'bold 16px Roboto';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, gridStartY);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, gridStartY + 28);
  });

  row2.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    const y = gridStartY + rowHeight;
    ctx.font = 'bold 16px Roboto';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  row3.forEach((cell, idx) => {
    const x = barX + idx * colWidth5 + colWidth5 / 2;
    const y = gridStartY + 2 * rowHeight;
    ctx.font = 'bold 16px Roboto';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, x, y);

    ctx.font = '22px Roboto';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(cell.val), x, y + 28);
  });

  // Footer bar
  const footerY = height - 40;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, footerY, width, 40);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(width, footerY);
  ctx.stroke();

  const discordLogoX = 35;
  const discordLogoY = footerY + 10;
  drawDiscordLogo(ctx, discordLogoX, discordLogoY, 20);

  ctx.font = 'bold 15px Roboto';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.fillText(discordUsername || 'Unknown', discordLogoX + 30, footerY + 25);
}

/**
 * Render animated profile card as GIF when custom background is an animated GIF.
 */
async function renderAnimatedProfileCard(profile, gifBuffer, discordUsername = null) {
  const width = 760;
  const height = 465;

  const reader = new omggif.GifReader(gifBuffer);
  const totalFrames = reader.numFrames();

  if (totalFrames <= 1) {
    return null; // Not animated
  }

  // Pre-render foreground overlay once for ultra-fast compositing
  const fgCanvas = createCanvas(width, height);
  const fgCtx = fgCanvas.getContext('2d');
  await drawProfileForeground(fgCtx, width, height, profile, discordUsername);

  // Target 16-20 frames for silky smooth animation with small file size (~1.2MB)
  const targetFrameCount = Math.min(20, Math.max(12, Math.round(totalFrames / 5)));
  const step = Math.max(1, Math.floor(totalFrames / targetFrameCount));
  const sampledIndices = [];
  for (let i = 0; i < totalFrames; i += step) {
    sampledIndices.push(i);
    if (sampledIndices.length >= 24) break;
  }

  const gifEncoder = GIFEncoder();
  const frameCanvas = createCanvas(width, height);
  const frameCtx = frameCanvas.getContext('2d');

  const srcWidth = reader.width;
  const srcHeight = reader.height;

  // Scale math to maintain aspect ratio and fill the 760x465 card
  const scale = Math.max(width / srcWidth, height / srcHeight);
  const drawW = srcWidth * scale;
  const drawH = srcHeight * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  const rgbaBuffer = new Uint8Array(srcWidth * srcHeight * 4);
  const tempSrcCanvas = createCanvas(srcWidth, srcHeight);
  const tempSrcCtx = tempSrcCanvas.getContext('2d');

  for (const fIdx of sampledIndices) {
    reader.decodeAndBlitFrameRGBA(fIdx, rgbaBuffer);
    const imgData = tempSrcCtx.createImageData(srcWidth, srcHeight);
    imgData.data.set(rgbaBuffer);
    tempSrcCtx.putImageData(imgData, 0, 0);

    // Draw scaled GIF background frame
    frameCtx.clearRect(0, 0, width, height);
    frameCtx.drawImage(tempSrcCanvas, offsetX, offsetY, drawW, drawH);

    // Composite pre-rendered foreground
    frameCtx.drawImage(fgCanvas, 0, 0);

    // Quantize to 256-color palette and write GIF frame
    const frameData = frameCtx.getImageData(0, 0, width, height).data;
    const palette = quantize(frameData, 256);
    const indexData = applyPalette(frameData, palette);

    const frameInfo = reader.frameInfo(fIdx);
    const delayMs = Math.max(70, (frameInfo.delay || 10) * 10 * step);

    gifEncoder.writeFrame(indexData, width, height, {
      palette,
      delay: delayMs
    });
  }

  gifEncoder.finish();
  const gifResult = Buffer.from(gifEncoder.bytes());
  gifResult.isAnimated = true;
  return gifResult;
}

export async function renderProfileCard(profile, customBgUrl = null, discordUsername = null) {
  const width = 760;
  const height = 465;

  // Check if custom background is an animated GIF
  const isGif = customBgUrl && (
    customBgUrl.toLowerCase().includes('.gif') || 
    customBgUrl.toLowerCase().includes('format=gif')
  );

  if (isGif) {
    try {
      const rawBuf = await getRawImageBuffer(customBgUrl);
      if (rawBuf && rawBuf.length > 0) {
        const animatedCard = await renderAnimatedProfileCard(profile, rawBuf, discordUsername);
        if (animatedCard) {
          return animatedCard;
        }
      }
    } catch (gifErr) {
      console.warn('[ProfileCard] Animated GIF render failed, falling back to static:', gifErr.message);
    }
  }

  // Static PNG rendering
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

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

  await drawProfileForeground(ctx, width, height, profile, discordUsername);

  const pngBuffer = canvas.toBuffer('image/png');
  pngBuffer.isAnimated = false;
  return pngBuffer;
}

