import { createCanvas } from '@napi-rs/canvas';
import { getCachedImage } from './imageLoader.js';

// Helper to draw rounded rectangle
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the authentic Kirka server browser card
 */
export async function renderServerBrowserCard({ region, rooms, totalPlayers }) {
  const displayRooms = rooms.slice(0, 8); // Display top 8 most populated matches
  const rowHeight = 58;
  const rowGap = 10;
  const headerHeight = 70;
  const padding = 24;

  const width = 840;
  const contentHeight = displayRooms.length > 0 
    ? headerHeight + (displayRooms.length * (rowHeight + rowGap)) + 16
    : 240;
  const height = Math.max(contentHeight, 260);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Outer Card Background (Deep Esports Obsidian Navy Gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c111e');
  bgGrad.addColorStop(0.5, '#12182b');
  bgGrad.addColorStop(1, '#090d17');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  roundedRect(ctx, 1, 1, width - 2, height - 2, 16);
  ctx.stroke();

  // 2. Top Header Bar
  // Authentic Game Button for Active Region
  const btnText = region.name.toUpperCase();
  ctx.font = '900 13px "Inter", "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(btnText).width;
  const btnW = textWidth + 28;
  const btnH = 32;
  const btnX = padding;
  const btnY = 26;

  // 3D Game Button Box (Kirka slate style with bottom bevel)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  btnGrad.addColorStop(0, '#2e3d57');
  btnGrad.addColorStop(1, '#1b2435');
  ctx.fillStyle = btnGrad;
  roundedRect(ctx, btnX, btnY, btnW, btnH, 6);
  ctx.fill();
  ctx.restore();

  // Bottom 3D Bevel line
  ctx.fillStyle = '#0f1623';
  roundedRect(ctx, btnX + 1, btnY + btnH - 3, btnW - 2, 3, 2);
  ctx.fill();

  // Button Border
  ctx.strokeStyle = '#43587d';
  ctx.lineWidth = 1.5;
  roundedRect(ctx, btnX, btnY, btnW, btnH, 6);
  ctx.stroke();

  // Button Text
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btnText, btnX + (btnW / 2), btnY + (btnH / 2) - 1);

  // Region Title next to Button
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SERVERS', btnX + btnW + 12, btnY + (btnH / 2));

  // Right Side Stats (Players count)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#10b981';
  ctx.font = '800 15px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`${totalPlayers} PLAYERS ONLINE`, width - padding, 34);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`${rooms.length} Active Match Rooms`, width - padding, 52);

  // Separator line under header
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(width - padding, headerHeight);
  ctx.stroke();

  // 3. Render Match Rooms
  if (displayRooms.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(`No active matches right now in ${region.name}. Be the first to start a match!`, width / 2, height / 2 + 20);
    return canvas.toBuffer('image/png');
  }

  let startY = headerHeight + 14;

  for (let i = 0; i < displayRooms.length; i++) {
    const room = displayRooms[i];
    const rowX = padding;
    const rowY = startY + (i * (rowHeight + rowGap));
    const rowW = width - (padding * 2);
    const rowH = rowHeight;
    const isFull = room.isFull;

    ctx.save();

    // Clip to rounded row container
    roundedRect(ctx, rowX, rowY, rowW, rowH, 10);
    ctx.clip();

    // Draw Map Background Image if available
    const mapNameClean = room.map || 'Shipment';
    const mapUrl = `https://api2.kirka.io/api/map-image/${encodeURIComponent(mapNameClean)}/mini/v1785719320996.webp`;
    let mapImg = await getCachedImage(mapUrl);
    if (!mapImg) {
      mapImg = await getCachedImage('https://api2.kirka.io/api/map-image/Shipment/mini/v1785719320996.webp');
    }

    if (mapImg) {
      // Draw map image stretched/cropped across row
      ctx.drawImage(mapImg, rowX, rowY - 20, rowW, rowH + 40);
    } else {
      ctx.fillStyle = '#182035';
      ctx.fillRect(rowX, rowY, rowW, rowH);
    }

    // Overlay dark tint so text and buttons pop with 100% clarity
    const overlayGrad = ctx.createLinearGradient(rowX, rowY, rowX + rowW, rowY);
    if (isFull) {
      overlayGrad.addColorStop(0, 'rgba(15, 20, 32, 0.90)');
      overlayGrad.addColorStop(0.6, 'rgba(18, 24, 38, 0.88)');
      overlayGrad.addColorStop(1, 'rgba(22, 28, 45, 0.92)');
    } else {
      overlayGrad.addColorStop(0, 'rgba(16, 23, 40, 0.82)');
      overlayGrad.addColorStop(0.5, 'rgba(20, 29, 52, 0.75)');
      overlayGrad.addColorStop(1, 'rgba(18, 25, 44, 0.85)');
    }
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(rowX, rowY, rowW, rowH);

    ctx.restore();

    // Row Border
    ctx.strokeStyle = isFull ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, rowX, rowY, rowW, rowH, 10);
    ctx.stroke();

    // --- Left Text: Number + Mode_Map + Region Tag ---
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Index number
    ctx.fillStyle = isFull ? '#64748b' : '#cbd5e1';
    ctx.font = '800 17px "Inter", "Segoe UI", sans-serif';
    const indexText = `${i + 1}. `;
    ctx.fillText(indexText, rowX + 16, rowY + (rowH / 2));
    const indexWidth = ctx.measureText(indexText).width;

    // Mode_Map (e.g. TKO_Pool, SND_Favela)
    ctx.fillStyle = isFull ? '#94a3b8' : '#ffffff';
    ctx.font = '900 18px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(room.title, rowX + 16 + indexWidth, rowY + (rowH / 2));
    const titleWidth = ctx.measureText(room.title).width;

    // Server Region Tag (e.g. ASIA~Dq3q2a5Yk)
    ctx.fillStyle = '#7888a5';
    ctx.font = '600 13px "Courier New", monospace';
    ctx.fillText(room.tag, rowX + 16 + indexWidth + titleWidth + 14, rowY + (rowH / 2) + 1);

    // --- Right Side: Player Count (No JOIN button) ---
    const rightPadding = 24;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    if (isFull) {
      ctx.fillStyle = '#64748b';
      ctx.font = '800 18px "Inter", monospace';
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.font = '900 19px "Inter", monospace';
    }
    ctx.fillText(`${room.players} / ${room.maxPlayers}`, rowX + rowW - rightPadding, rowY + (rowH / 2));
  }

  return canvas.toBuffer('image/png');
}
