import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'Roboto-Bold');
} catch (err) {
  console.warn('Failed to register fonts in storeBanner:', err.message);
}

/**
 * Render a horizontal card banner showing all N limited drops side-by-side.
 * The order in the image strictly matches the ordered array (1st on the left, 2nd next to it, etc.)
 */
export async function renderLimitedDropsBanner(limitedDrops = []) {
  if (!limitedDrops || limitedDrops.length === 0) return null;

  const n = limitedDrops.length;
  const cardW = 310;
  const cardH = 390;
  const gap = 20;
  const padX = 25;
  const padY = 25;

  const width = padX * 2 + n * cardW + (n - 1) * gap;
  const height = cardH + padY * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Deep obsidian background
  ctx.fillStyle = '#0a0c12';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < n; i++) {
    const item = limitedDrops[i];
    const x = padX + i * (cardW + gap);
    const y = padY;

    // Card background
    ctx.fillStyle = '#131620';
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 16);
    ctx.fill();

    // Critical stock check (<= 5 units or sold out = intense red, otherwise gold)
    const isCritical = item.remainingUnits !== null && item.remainingUnits <= 5;
    const isSoldOut = item.isSoldOut;

    let borderColor = 'rgba(245, 158, 11, 0.45)';
    let pillBg = 'rgba(245, 158, 11, 0.15)';
    let pillBorder = '#f59e0b';
    let pillTextColor = '#fde68a';

    if (isSoldOut) {
      borderColor = 'rgba(100, 116, 139, 0.5)';
      pillBg = 'rgba(100, 116, 139, 0.2)';
      pillBorder = '#64748b';
      pillTextColor = '#94a3b8';
    } else if (isCritical) {
      borderColor = 'rgba(239, 68, 68, 0.75)';
      pillBg = 'rgba(239, 68, 68, 0.2)';
      pillBorder = '#ef4444';
      pillTextColor = '#fca5a5';
    }

    // Card border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Top stock pill
    const pillW = cardW - 36;
    const pillH = 34;
    const pillX = x + 18;
    const pillY = y + 16;

    ctx.fillStyle = pillBg;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.strokeStyle = pillBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Stock text
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = pillTextColor;
    ctx.textAlign = 'center';

    let stockText = `${item.remainingUnits ?? '?'} / ${item.totalUnits ?? '?'} UNITS LEFT`;
    if (isSoldOut) stockText = 'SOLD OUT';
    else if (isCritical) stockText = `LOW STOCK: ${item.remainingUnits} / ${item.totalUnits} LEFT`;

    ctx.fillText(stockText, pillX + pillW / 2, pillY + 22);

    // Center 3D skin render
    if (item.renderUrl) {
      try {
        const img = await getCachedImage(item.renderUrl);
        if (img) {
          const maxImgW = cardW - 40;
          const maxImgH = 205;
          let drawW = maxImgW;
          let drawH = (img.height / img.width) * drawW;
          if (drawH > maxImgH) {
            drawH = maxImgH;
            drawW = (img.width / img.height) * drawH;
          }

          const imgX = x + (cardW - drawW) / 2;
          const imgY = y + 62 + (maxImgH - drawH) / 2;
          ctx.drawImage(img, imgX, imgY, drawW, drawH);
        }
      } catch (err) {
        console.warn(`[StoreBanner] Failed to draw skin image for ${item.name}:`, err.message);
      }
    }

    // Item name
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + cardW / 2, y + cardH - 74);

    // Weapon or character type
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(item.weapon || item.type, x + cardW / 2, y + cardH - 50);

    // Diamond price
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${item.priceDiamonds.toLocaleString()} Diamonds`, x + cardW / 2, y + cardH - 22);
  }

  return canvas.toBuffer('image/png');
}
