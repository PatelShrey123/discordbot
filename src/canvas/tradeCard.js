import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { formatValueShort, formatValueLong } from '../api/boltPrices.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'Roboto-Bold');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/RobotoMono-Bold.ttf'), 'RobotoMono-Bold');
} catch (err) {
  console.warn('Failed to register fonts in tradeCard:', err.message);
}

const RARITY_COLORS = {
  exotic:     '#00ffff',
  contraband: '#ef4444',
  mythical:   '#ef4444',
  mythic:     '#ef4444',
  m:          '#ef4444',
  legendary:  '#eab308',
  l:          '#eab308',
  epic:       '#a855f7',
  e:          '#a855f7',
  rare:       '#3b82f6',
  r:          '#3b82f6',
  uncommon:   '#22c55e',
  u:          '#22c55e',
  common:     '#94a3b8',
  c:          '#94a3b8'
};

function getRarityColor(rarity) {
  if (!rarity) return '#64748b';
  const clean = rarity.toLowerCase().trim();
  return RARITY_COLORS[clean] || '#64748b';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderTradeCard(trade, options = {}) {
  const scale = 2;
  const width = 940 * scale;
  const height = 540 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const baseW = 940;
  const baseH = 540;

  // Background gradient (Deep obsidian slate)
  const bgGrad = ctx.createRadialGradient(baseW / 2, baseH / 2, 100, baseW / 2, baseH / 2, baseW);
  bgGrad.addColorStop(0, '#151722');
  bgGrad.addColorStop(1, '#090a0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Outer border
  ctx.strokeStyle = '#222536';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, baseW - 2, baseH - 2);

  const isHistory = trade.type === 'history';

  // 1. TOP HEADER
  // Status Pill
  const statusX = 35;
  const statusY = 25;
  const statusText = isHistory ? 'COMPLETED TRADE' : 'ACTIVE OFFER';
  const statusBg = isHistory ? 'rgba(168, 85, 247, 0.18)' : 'rgba(34, 197, 94, 0.18)';
  const statusBorder = isHistory ? '#a855f7' : '#22c55e';
  const statusColor = isHistory ? '#d8b4fe' : '#4ade80';

  ctx.fillStyle = statusBg;
  ctx.strokeStyle = statusBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, statusX, statusY, 130, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = statusColor;
  ctx.font = 'bold 11px Roboto-Bold, sans-serif';
  ctx.fillText((isHistory ? '🤝 ' : '🟢 ') + statusText, statusX + 10, statusY + 17);

  // Trade ID
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px RobotoMono-Bold, monospace';
  ctx.fillText(`Trade #${trade.tradeId || 'Unknown'}`, statusX + 145, statusY + 18);

  // Trader Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Roboto-Bold, sans-serif';
  const traderText = isHistory
    ? `From: ${trade.offerer || 'Trader'}  ➔  To: ${trade.accepter || 'Accepter'}`
    : `Trader: ${trade.userAndTag || 'Unknown'}`;
  ctx.fillText(traderText, statusX, statusY + 48);

  // Right-aligned Info: Date & Pagination
  ctx.textAlign = 'right';
  if (trade.updatedAt) {
    const d = new Date(trade.updatedAt);
    const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Roboto, sans-serif';
    ctx.fillText(dateStr, baseW - 35, statusY + 18);
  }
  if (options.index !== undefined && options.totalCount) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px RobotoMono-Bold, monospace';
    ctx.fillText(`Listing ${options.index + 1} of ${options.totalCount}`, baseW - 35, statusY + 42);
  }
  ctx.textAlign = 'left';

  // 2. MAIN PANELS (Split layout: Offered vs Wanted)
  const panelW = 415;
  const panelH = 340;
  const panelY = 95;
  const leftX = 35;
  const rightX = baseW - panelW - 35;

  // Render Panel Helper
  const drawPanel = (x, title, totalVal, items, isWanted) => {
    // Panel background card
    const cardGrad = ctx.createLinearGradient(x, panelY, x, panelY + panelH);
    cardGrad.addColorStop(0, '#12141e');
    cardGrad.addColorStop(1, '#0b0c13');
    ctx.fillStyle = cardGrad;
    roundRect(ctx, x, panelY, panelW, panelH, 12);
    ctx.fill();

    ctx.strokeStyle = isWanted ? '#38bdf8' : '#eab308';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Panel Header
    ctx.fillStyle = isWanted ? '#38bdf8' : '#eab308';
    ctx.font = 'bold 13px Roboto-Bold, sans-serif';
    ctx.fillText(title.toUpperCase(), x + 18, panelY + 30);

    // Total Value Pill
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px RobotoMono-Bold, monospace';
    const valText = totalVal > 0 ? `⚡ ${formatValueShort(totalVal)} Bolts` : '⚡ Unpriced';
    ctx.fillText(valText, x + panelW - 18, panelY + 30);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x + 18, panelY + 42);
    ctx.lineTo(x + panelW - 18, panelY + 42);
    ctx.stroke();

    // Items list (up to 3 items)
    const itemStartY = panelY + 54;
    const rowH = 82;

    if (!items || items.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 13px Roboto, sans-serif';
      ctx.fillText('(No items specified)', x + 25, itemStartY + 40);
      return;
    }

    const displayItems = items.slice(0, 3);
    for (let i = 0; i < displayItems.length; i++) {
      const it = displayItems[i];
      const rowY = itemStartY + (i * (rowH + 10));

      // Row background
      ctx.fillStyle = '#0a0b10';
      roundRect(ctx, x + 15, rowY, panelW - 30, rowH, 8);
      ctx.fill();

      // Rarity border on row
      const rarityCol = getRarityColor(it.rarity || it.r);
      ctx.strokeStyle = rarityCol;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Item image placeholder / thumbnail
      const imgX = x + 23;
      const imgY = rowY + 9;
      const imgSize = 64;

      ctx.fillStyle = '#161922';
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 6);
      ctx.fill();

      if (it.renderImg) {
        try {
          ctx.drawImage(it.renderImg, imgX + 2, imgY + 2, imgSize - 4, imgSize - 4);
        } catch {}
      }

      // Item Name
      const textX = imgX + imgSize + 14;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Roboto-Bold, sans-serif';
      const name = it.name || it.i || 'Unknown';
      ctx.fillText(name.length > 20 ? name.slice(0, 18) + '...' : name, textX, rowY + 28);

      // Quantity & Rarity
      const qty = it.quantity || it.q || '1';
      ctx.fillStyle = rarityCol;
      ctx.font = 'bold 11px RobotoMono-Bold, monospace';
      ctx.fillText(`x${qty}  •  ${(it.rarityFull || it.rarity || it.r || 'Skin').toUpperCase()}`, textX, rowY + 48);

      // Price
      const price = it.price || 0;
      ctx.fillStyle = price > 0 ? '#fde047' : '#64748b';
      ctx.font = 'bold 11px RobotoMono-Bold, monospace';
      ctx.fillText(price > 0 ? `⚡ ${formatValueShort(price * (parseInt(qty, 10) || 1))} Bolts` : '⚡ Special / No Price', textX, rowY + 66);
    }

    if (items.length > 3) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Roboto, sans-serif';
      ctx.fillText(`+ ${items.length - 3} more item(s)...`, x + 25, itemStartY + (3 * (rowH + 10)) - 2);
    }
  };

  // Pre-load images
  const allItems = [...(trade.offered || []), ...(trade.wanted || [])];
  await Promise.all(allItems.map(async (it) => {
    if (it.renderUrl) {
      it.renderImg = await getCachedImage(it.renderUrl);
    }
  }));

  // Draw Offered & Wanted Panels
  drawPanel(leftX, isHistory ? 'Items Given' : 'Offered Items', trade.offeredTotal || 0, trade.offered, false);
  drawPanel(rightX, isHistory ? 'Items Received' : 'Wanted Items', trade.wantedTotal || 0, trade.wanted, true);

  // 3. CENTER BADGE (⇄ or VS)
  const centerX = baseW / 2;
  const centerY = panelY + (panelH / 2);

  ctx.fillStyle = '#0f111a';
  ctx.strokeStyle = '#2d3348';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⇄', centerX, centerY + 7);
  ctx.textAlign = 'left';

  // 4. BOTTOM BAR: Deal Assessment & Summary
  const btmY = panelY + panelH + 18;
  const btmW = baseW - 70;
  const btmH = 48;

  ctx.fillStyle = '#0d0f17';
  roundRect(ctx, leftX, btmY, btmW, btmH, 8);
  ctx.fill();
  ctx.strokeStyle = '#1e2230';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Assessment text
  let assessmentColor = '#94a3b8';
  let assessmentIcon = '⚖️';
  if (trade.assessment === 'Overpay') {
    assessmentColor = '#4ade80';
    assessmentIcon = '🟢';
  } else if (trade.assessment === 'Underpay') {
    assessmentColor = '#f87171';
    assessmentIcon = '🔴';
  } else if (trade.assessment === 'Fair') {
    assessmentColor = '#38bdf8';
    assessmentIcon = '⚖️';
  }

  ctx.fillStyle = assessmentColor;
  ctx.font = 'bold 13px Roboto-Bold, sans-serif';
  ctx.fillText(`${assessmentIcon} Valuation: ${trade.assessment} (${trade.diffText || 'Fair'})`, leftX + 18, btmY + 29);

  // Right watermark
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Roboto, sans-serif';
  ctx.fillText('KirkaHub Trading Portal  •  Live Skywalk API', leftX + btmW - 18, btmY + 29);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
