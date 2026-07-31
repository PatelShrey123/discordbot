import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { getItemPrice, formatValueShort } from '../api/boltPrices.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'RobotoBold');
} catch (err) {
  console.warn('Failed to register Roboto fonts in inventoryGrid:', err.message);
}

const RARITY_COLORS = {
  contraband: '#ef4444',
  exotic:     '#ef4444',
  mythical:   '#ef4444',
  mythic:     '#ef4444',
  legendary:  '#f97316',
  epic:       '#3b82f6',
  rare:       '#3b82f6',
  uncommon:   '#22c55e',
  common:     '#64748b'
};

function getRarityColor(rarity) {
  if (!rarity) return '#64748b';
  const clean = rarity.toLowerCase().trim();
  return RARITY_COLORS[clean] || '#f97316';
}

export async function renderInventoryGridPage({ items, pageItems, priceMap, pageIndex, totalPages, username }) {
  // Canvas enlarged to 930x530 for massive high-definition grid blocks!
  const width = 930;
  const height = 530;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark premium card background matching dashboard
  ctx.fillStyle = '#0f111a';
  ctx.fillRect(0, 0, width, height);

  const cols = 5;
  const cellW = 172; // enlarged from 152
  const cellH = 92;  // enlarged from 76
  const gapX = 12;
  const gapY = 12;
  const startX = 20;
  const startY = 20;

  const displayItems = pageItems.slice(0, 25);

  // Pre-load all 25 skin images in parallel (using cache utility)
  const loadedImages = await Promise.all(
    displayItems.map(async (invItem) => {
      const item = invItem.item || invItem;
      const imgUrl = item.renderUrl || item.textureUrl;
      if (imgUrl) {
        try {
          const cleanUrl = imgUrl.trim();
          const targetUrl = cleanUrl.startsWith('/') ? `https://kirka.io${cleanUrl}` : cleanUrl;
          return await getCachedImage(targetUrl);
        } catch (err) {
          return null;
        }
      }
      return null;
    })
  );

  // Draw 5x5 Grid
  for (let i = 0; i < displayItems.length; i++) {
    const invItem = displayItems[i];
    const item = invItem.item || invItem;
    const qty = invItem.amount || 1;
    const itemImg = loadedImages[i];

    const r = Math.floor(i / cols);
    const c = i % cols;

    const x = startX + c * (cellW + gapX);
    const y = startY + r * (cellH + gapY);

    const price = getItemPrice(priceMap, item);
    const formattedPrice = price > 0 ? formatValueShort(price) : '—';
    const borderColor = getRarityColor(item.rarity);

    // Cell Background - Deep Obsidian Card
    ctx.fillStyle = '#05060b';
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 10); // smoother rounded corners
    ctx.fill();

    // Rarity Colored Border (2.5px thick for extra visual pop)
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Item Name Header (Top Center)
    const rawName = (item.name || 'Item').replace(/^_+/, '').trim();
    ctx.font = 'bold 12px RobotoBold';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';

    let displayName = rawName;
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 18) + '..';
    }
    ctx.fillText(displayName, x + cellW / 2, y + 18);

    // Item Render Image (Middle Center - enlarged to fill cell box clearly!)
    if (itemImg) {
      const isCharacter = item.type === 'BODY_SKIN' || rawName.toLowerCase().includes('character') || rawName.toLowerCase().includes('skin');
      
      let imgW, imgH;
      if (isCharacter) {
        // Character models stand upright and tall
        imgH = 58; // enlarged from 46
        imgW = (itemImg.width / itemImg.height) * imgH;
        if (imgW > 75) {
          imgW = 75;
          imgH = (itemImg.height / itemImg.width) * imgW;
        }
      } else {
        // Weapon models stretch wide
        imgW = 100; // enlarged from 85
        imgH = (itemImg.height / itemImg.width) * imgW;
        if (imgH > 50) {
          imgH = 50;
          imgW = (itemImg.width / itemImg.height) * imgH;
        }
      }

      ctx.drawImage(
        itemImg, 
        x + (cellW - imgW) / 2, 
        y + 18 + (cellH - 26 - imgH) / 2, 
        imgW, 
        imgH
      );
    }

    // Price Text (Bottom Left)
    ctx.font = 'bold 12px Roboto';
    ctx.fillStyle = '#fbbf24'; // Warm Gold
    ctx.textAlign = 'left';
    ctx.fillText(formattedPrice, x + 10, y + cellH - 10);

    // Quantity (Bottom Right)
    ctx.font = 'bold 12px Roboto';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`x${qty}`, x + cellW - 10, y + cellH - 10);
  }

  return canvas.toBuffer('image/png');
}
