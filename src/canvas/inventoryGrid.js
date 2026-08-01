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

// Exact colors matching the user screenshot
const RARITY_COLORS = {
  contraband: '#ef4444', // Bright Red
  exotic:     '#ef4444', // Bright Red
  mythical:   '#ef4444', // Bright Red
  mythic:     '#ef4444', // Bright Red
  legendary:  '#f97316', // Orange
  epic:       '#a855f7', // Purple
  rare:       '#3b82f6', // Blue
  uncommon:   '#22c55e', // Green
  common:     '#2a2b2d'  // Dark Grey/Slate (matching Blackhole cell border)
};

function getRarityColor(rarity) {
  if (!rarity) return '#2a2b2d';
  const clean = rarity.toLowerCase().trim();
  return RARITY_COLORS[clean] || '#2a2b2d';
}

export async function renderInventoryGridPage({ items, pageItems, priceMap, pageIndex, totalPages, username }) {
  // Render at 2x resolution for ultra-sharp high-definition image quality
  const scale = 2;
  const width = 930 * scale;
  const height = 530 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Dark grey slate canvas background (#1a1b20)
  ctx.fillStyle = '#1a1b20';
  ctx.fillRect(0, 0, width, height);

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

    // Cell Background - Slate Card (#22232a)
    ctx.fillStyle = '#22232a';
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 14 * scale); // Highly rounded corners
    ctx.fill();

    // Card Outline Border (Subtle white overlay)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Bottom colored stripe representing rarity (6px high scaled)
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.roundRect(x, y + cellH - 6 * scale, cellW, 6 * scale, [0, 0, 14 * scale, 14 * scale]);
    ctx.fill();

    // Item Name Header (Top Center, white text)
    const rawName = (item.name || 'Item').replace(/^_+/, '').trim();
    ctx.font = `bold ${13 * scale}px RobotoBold`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    let displayName = rawName;
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 18) + '..';
    }
    ctx.fillText(displayName, x + cellW / 2, y + 24 * scale);

    // Item Render Image (Middle Center - scaled and centered)
    if (itemImg) {
      const isCharacter = item.type === 'BODY_SKIN' || rawName.toLowerCase().includes('character') || rawName.toLowerCase().includes('skin');
      
      let imgW, imgH;
      if (isCharacter) {
        // Character models stand upright and tall
        imgH = 54 * scale;
        imgW = (itemImg.width / itemImg.height) * imgH;
        if (imgW > 70 * scale) {
          imgW = 70 * scale;
          imgH = (itemImg.height / itemImg.width) * imgW;
        }
      } else {
        // Weapon models stretch wide
        imgW = 95 * scale;
        imgH = (itemImg.height / itemImg.width) * imgW;
        if (imgH > 48 * scale) {
          imgH = 48 * scale;
          imgW = (itemImg.width / itemImg.height) * imgH;
        }
      }

      ctx.drawImage(
        itemImg, 
        x + (cellW - imgW) / 2, 
        y + 20 * scale + (cellH - 32 * scale - imgH) / 2, 
        imgW, 
        imgH
      );
    }

    // Price Text (Bottom Left, white text)
    ctx.font = `bold ${12 * scale}px RobotoBold`;
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'left';
    ctx.fillText(formattedPrice, x + 14 * scale, y + cellH - 14 * scale);

    // Quantity (Bottom Right, white text)
    ctx.font = `bold ${12 * scale}px RobotoBold`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(String(qty), x + cellW - 14 * scale, y + cellH - 14 * scale);
  }

  return canvas.toBuffer('image/png');
}
