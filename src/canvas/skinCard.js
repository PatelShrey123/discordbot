import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { getBoltPriceMap, getItemPrice } from '../api/boltPrices.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'RobotoBold');
} catch (err) {
  console.warn('Failed to register Roboto fonts in skinCard:', err.message);
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
  return RARITY_COLORS[clean] || '#ef4444';
}

export async function renderSkinCard(item, priceMap) {
  const width = 640;
  const height = 380;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark slate/charcoal background matching Image 5
  ctx.fillStyle = '#22252c';
  ctx.fillRect(0, 0, width, height);

  // Border frame (matching the red/gold border style)
  const rarityColor = getRarityColor(item.rarity);
  ctx.strokeStyle = rarityColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, width, height);

  const leftPanelW = 230;

  // Draw central partition line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPanelW, 0);
  ctx.lineTo(leftPanelW, height);
  ctx.stroke();

  // LEFT PANEL: Badges
  const itemType = item.type === 'BODY_SKIN' ? 'Character' : (item.parent?.name || 'Weapon Skin');
  const itemName = item.name.replace(/^_+/, '').trim();
  const priceVal = getItemPrice(priceMap, item);
  const formattedPrice = priceVal > 0 ? priceVal.toLocaleString('en-US') : 'Unknown';

  const badges = [
    { text: itemName, color: '#e2e8f0', isRarity: false },
    { text: itemType, color: '#94a3b8', isRarity: false },
    { text: item.rarity || 'Common', color: rarityColor, isRarity: true }
  ];

  let currentY = 25;
  badges.forEach((badge) => {
    // Badge box
    ctx.fillStyle = '#0f1115';
    ctx.beginPath();
    ctx.roundRect(20, currentY, leftPanelW - 40, 36, 4);
    ctx.fill();

    // Border highlight
    ctx.strokeStyle = badge.isRarity ? badge.color : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Badge text
    ctx.font = 'bold 15px RobotoBold';
    ctx.fillStyle = badge.color;
    ctx.textAlign = 'center';
    ctx.fillText(badge.text, leftPanelW / 2, currentY + 23);

    currentY += 46;
  });

  // LEFT PANEL: Skin Value Box Section (Simplified to only display Bolt Price)
  ctx.fillStyle = '#17191e';
  ctx.beginPath();
  ctx.roundRect(20, 185, leftPanelW - 40, 150, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.stroke();

  // Header "Skin Value"
  ctx.font = 'bold 16px RobotoBold';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Skin Value', leftPanelW / 2, 215);

  // Underline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 222);
  ctx.lineTo(leftPanelW - 40, 222);
  ctx.stroke();

  // Label tag
  ctx.font = 'bold 12px RobotoBold';
  ctx.fillStyle = '#fbbf24'; // Golden Bolt text
  ctx.textAlign = 'left';
  ctx.fillText('BOLT', 28, 250);

  // Value box
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(28, 258, leftPanelW - 56, 42);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeRect(28, 258, leftPanelW - 56, 42);

  // Value text
  ctx.font = 'bold 16px RobotoBold';
  ctx.fillStyle = '#fbbf24'; // Warm Gold
  ctx.textAlign = 'center';
  ctx.fillText(formattedPrice, leftPanelW / 2, 285);

  // RIGHT PANEL: Large Item Render (NO GLOW / BLUR)
  const imgUrl = item.renderUrl || item.textureUrl;
  if (imgUrl) {
    try {
      const fullUrl = imgUrl.startsWith('/') ? `https://kirka.io${imgUrl}` : imgUrl;
      const itemImg = await getCachedImage(fullUrl);

      const padding = 35;
      const maxW = width - leftPanelW - 2 * padding;
      const maxH = height - 2 * padding;

      let drawW = maxW;
      let drawH = (itemImg.height / itemImg.width) * drawW;

      if (drawH > maxH) {
        drawH = maxH;
        drawW = (itemImg.width / itemImg.height) * drawH;
      }

      ctx.save();
      // Render clean, non-glowing raw image
      ctx.drawImage(
        itemImg,
        leftPanelW + padding + (maxW - drawW) / 2,
        padding + (maxH - drawH) / 2,
        drawW,
        drawH
      );
      ctx.restore();
    } catch (err) {
      console.warn('Failed to draw item image on skin card:', err.message);
    }
  }

  return canvas.toBuffer('image/png');
}
