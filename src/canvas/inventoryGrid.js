import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getItemPrice, formatValueShort } from '../api/boltPrices.js';

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

function getProxiedImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  const cleanUrl = url.startsWith('/') ? `https://kirka.io${url}` : url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
}

export async function renderInventoryGridPage({ items, pageItems, priceMap, pageIndex, totalPages, username }) {
  const width = 830;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark obsidian background matching premium dashboard style
  ctx.fillStyle = '#0f111a';
  ctx.fillRect(0, 0, width, height);

  const cols = 5;
  const cellW = 152;
  const cellH = 76;
  const gapX = 10;
  const gapY = 10;
  const startX = 15;
  const startY = 15;

  const displayItems = pageItems.slice(0, 25);

  // Pre-load all 25 skin images in parallel
  const loadedImages = await Promise.all(
    displayItems.map(async (invItem) => {
      const item = invItem.item || invItem;
      const imgUrl = item.renderUrl || item.textureUrl;
      if (imgUrl) {
        try {
          const proxied = getProxiedImageUrl(imgUrl);
          return await loadImage(proxied);
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

    // Cell Background - Dark Card
    ctx.fillStyle = '#05060b';
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 8);
    ctx.fill();

    // Rarity Colored Border (Image 1 style)
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Item Name Header (Top Center)
    const rawName = (item.name || 'Item').replace(/^_+/, '').trim();
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';

    let displayName = rawName;
    if (displayName.length > 18) {
      displayName = displayName.substring(0, 16) + '..';
    }
    ctx.fillText(displayName, x + cellW / 2, y + 15);

    // Item Render Image (Middle Center - much larger to occupy the full cell body)
    if (itemImg) {
      // Determine correct aspect-ratio scaling so weapons are wide and characters are tall
      const isCharacter = item.type === 'BODY_SKIN' || rawName.toLowerCase().includes('character') || rawName.toLowerCase().includes('skin');
      
      let imgW, imgH;
      if (isCharacter) {
        // Character models are tall
        imgH = 46;
        imgW = (itemImg.width / itemImg.height) * imgH;
        // Keep inside bounds
        if (imgW > 60) {
          imgW = 60;
          imgH = (itemImg.height / itemImg.width) * imgW;
        }
      } else {
        // Weapon models are wide
        imgW = 85;
        imgH = (itemImg.height / itemImg.width) * imgW;
        // Keep inside bounds
        if (imgH > 40) {
          imgH = 40;
          imgW = (itemImg.width / itemImg.height) * imgH;
        }
      }

      ctx.drawImage(
        itemImg, 
        x + (cellW - imgW) / 2, 
        y + 16 + (cellH - 22 - imgH) / 2, 
        imgW, 
        imgH
      );
    }

    // Price Text (Bottom Left)
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fbbf24'; // Warm Gold
    ctx.textAlign = 'left';
    ctx.fillText(formattedPrice, x + 8, y + cellH - 8);

    // Quantity (Bottom Right)
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`x${qty}`, x + cellW - 8, y + cellH - 8);
  }

  return canvas.toBuffer('image/png');
}
