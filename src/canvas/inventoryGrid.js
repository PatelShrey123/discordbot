import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { getItemPrice, formatValueShort } from '../api/boltPrices.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'Roboto');
} catch (err) {
  console.warn('Failed to register Roboto fonts in inventoryGrid:', err.message);
}

// Exact colors matching the user screenshot
const RARITY_COLORS = {
  contraband: '#ef4444', // Bright Red
  exotic:     '#ef4444', // Bright Red
  mythical:   '#ef4444', // Bright Red
  mythic:     '#ef4444', // Bright Red
  legendary:  '#eab308', // Gold/Yellow
  epic:       '#a855f7', // Purple
  rare:       '#3b82f6', // Blue
  uncommon:   '#22c55e', // Green
  common:     '#64748b'  // Grey
};

function getRarityColor(rarity) {
  if (!rarity) return '#2a2b2d';
  const clean = rarity.toLowerCase().trim();
  return RARITY_COLORS[clean] || '#2a2b2d';
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderInventoryGridPage({ items, pageItems, priceMap, pageIndex, totalPages, username }) {
  // Render at 2x resolution for ultra-sharp high-definition image quality
  const scale = 2;
  const width = 930 * scale;
  const height = 530 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background (Muted radial vignette)
  const bgGrad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width * 0.8);
  bgGrad.addColorStop(0, '#101115');
  bgGrad.addColorStop(1, '#06070a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Load coin image locally
  let coinImg = null;
  try {
    const coinPath = join(__dirname, '../../public/kirka_coin.png');
    if (fs.existsSync(coinPath)) {
      const coinBuf = fs.readFileSync(coinPath);
      coinImg = await loadImage(coinBuf);
    }
  } catch (err) {
    // Fail silently
  }

  const cols = 5;
  const cellW = 170 * scale; 
  const cellH = 90 * scale;  
  const gapX = 10 * scale;
  const gapY = 10 * scale;
  const startX = 20 * scale;
  const startY = 20 * scale;

  const displayItems = pageItems.slice(0, 25);

  // Pre-load all 25 skin images in parallel (using our robust direct loader)
  const loadedImages = await Promise.all(
    displayItems.map(async (invItem) => {
      const item = invItem.item || invItem;
      const imgUrl = item.renderUrl || item.textureUrl;
      if (imgUrl) {
        try {
          const cleanUrl = imgUrl.trim();
          let targetUrl = cleanUrl;
          if (cleanUrl.startsWith('https://kirka.iodata:')) {
            targetUrl = cleanUrl.substring(16); // strip 'https://kirka.io' (length of 'https://kirka.io' is 16)
          } else if (cleanUrl.startsWith('/data:')) {
            targetUrl = cleanUrl.substring(1);
          } else if (cleanUrl.startsWith('/')) {
            targetUrl = `https://kirka.io${cleanUrl}`;
          }
          return await getCachedImage(targetUrl);
        } catch (err) {
          return null;
        }
      }
      return null;
    })
  );

  // Draw 5x5 Grid
  for (let i = 0; i < 25; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = startX + c * (cellW + gapX);
    const y = startY + r * (cellH + gapY);

    const invItem = displayItems[i];
    if (!invItem) {
      // Empty card slot placeholder matching Prototype C
      ctx.fillStyle = '#08090d';
      drawRoundedRect(ctx, x, y, cellW, cellH, 12 * scale);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1 * scale;
      drawRoundedRect(ctx, x, y, cellW, cellH, 12 * scale);
      ctx.stroke();
      continue;
    }

    const item = invItem.item || invItem;
    const qty = invItem.amount || 1;
    const itemImg = loadedImages[i];
    const price = getItemPrice(priceMap, item);
    const formattedPrice = price > 0 ? formatValueShort(price) : '—';
    const borderColor = getRarityColor(item.rarity);

    // Card background (#08090d)
    ctx.fillStyle = '#08090d';
    drawRoundedRect(ctx, x, y, cellW, cellH, 12 * scale);
    ctx.fill();

    // Rarity outline border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5 * scale;
    drawRoundedRect(ctx, x, y, cellW, cellH, 12 * scale);
    ctx.stroke();

    // Quantity Tag in top right corner (small dark badge)
    const badgeW = 22 * scale;
    const badgeH = 14 * scale;
    const badgeX = x + cellW - badgeW - 8 * scale;
    const badgeY = y + 8 * scale;
    ctx.fillStyle = '#11131e';
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5 * scale;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4 * scale);
    ctx.stroke();

    ctx.font = `bold ${8.5 * scale}px Roboto`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(`x${qty}`, badgeX + badgeW/2, badgeY + badgeH - 3.5 * scale);

    // Draw item image centered in upper area
    if (itemImg) {
      const rawName = (item.name || 'Item').replace(/^_+/, '').trim();
      const isCharacter = item.type === 'BODY_SKIN' || rawName.toLowerCase().includes('character') || rawName.toLowerCase().includes('skin');
      let imgW, imgH;
      if (isCharacter) {
        imgH = 48 * scale;
        imgW = (itemImg.width / itemImg.height) * imgH;
        if (imgW > 64 * scale) {
          imgW = 64 * scale;
          imgH = (itemImg.height / itemImg.width) * imgW;
        }
      } else {
        imgW = 85 * scale;
        imgH = (itemImg.height / itemImg.width) * imgW;
        if (imgH > 40 * scale) {
          imgH = 40 * scale;
          imgW = (itemImg.width / itemImg.height) * imgH;
        }
      }

      ctx.drawImage(
        itemImg,
        x + (cellW - imgW) / 2,
        y + 12 * scale + (cellH - 32 * scale - imgH) / 2,
        imgW,
        imgH
      );
    }

    // Divider line above bottom bar
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + cellH - 26 * scale);
    ctx.lineTo(x + cellW - 10 * scale, y + cellH - 26 * scale);
    ctx.stroke();

    // Bottom Left: Item Name only
    const rawName = (item.name || 'Item').replace(/^_+/, '').trim();
    ctx.font = `bold ${12.5 * scale}px Roboto`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    let displayName = rawName;
    if (displayName.length > 18) {
      displayName = displayName.substring(0, 16) + '..';
    }
    ctx.fillText(displayName, x + 10 * scale, y + cellH - 9 * scale);

    // Bottom Right: Coin Icon & Price only
    ctx.font = `bold ${12.5 * scale}px Roboto`;
    ctx.fillStyle = '#eab308'; // Bold yellow price value
    ctx.textAlign = 'right';
    ctx.fillText(formattedPrice, x + cellW - 10 * scale, y + cellH - 9 * scale);

    if (coinImg && price > 0) {
      const priceStrWidth = ctx.measureText(formattedPrice).width;
      const coinSize = 11 * scale;
      ctx.drawImage(
        coinImg,
        x + cellW - 10 * scale - priceStrWidth - coinSize - 4 * scale,
        y + cellH - 9 * scale - coinSize + 2 * scale,
        coinSize,
        coinSize
      );
    }
  }

  return canvas.toBuffer('image/png');
}
