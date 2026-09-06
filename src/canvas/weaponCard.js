import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
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
  console.warn('Failed to register fonts in weaponCard:', err.message);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderWeaponCard(w1, w2 = null) {
  const isCompare = !!w2;
  const scale = 2;
  const baseW = isCompare ? 960 : 760;
  const baseH = 500;
  const width = baseW * scale;
  const height = baseH * scale;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background gradient (Deep esports charcoal slate)
  const bgGrad = ctx.createRadialGradient(baseW / 2, baseH / 2, 100, baseW / 2, baseH / 2, baseW);
  bgGrad.addColorStop(0, '#151722');
  bgGrad.addColorStop(1, '#090a0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Outer border
  ctx.strokeStyle = '#232738';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, baseW - 2, baseH - 2);

  // Pre-load weapon renders
  const [img1, img2] = await Promise.all([
    getCachedImage(w1.renderUrl),
    w2 ? getCachedImage(w2.renderUrl) : Promise.resolve(null)
  ]);

  if (!isCompare) {
    // -------------------------------------------------------------
    // SINGLE WEAPON VIEW
    // -------------------------------------------------------------
    // Header
    ctx.fillStyle = w1.color || '#38bdf8';
    ctx.font = 'bold 24px Roboto-Bold, sans-serif';
    ctx.fillText(`${w1.icon} ${w1.name}`, 35, 45);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px RobotoMono-Bold, monospace';
    ctx.fillText(`${w1.category.toUpperCase()} • 100 HP KIRKA METRICS`, 35, 68);

    // Left Panel: Big 3D weapon image
    const imgBoxX = 35;
    const imgBoxY = 90;
    const imgBoxW = 280;
    const imgBoxH = 260;

    ctx.fillStyle = '#0f111a';
    roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = w1.color || '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (img1) {
      try {
        ctx.drawImage(img1, imgBoxX + 15, imgBoxY + 15, imgBoxW - 30, imgBoxH - 30);
      } catch {}
    }

    // Weapon TTK Highlight Box under image
    const ttkBoxY = imgBoxY + imgBoxH + 16;
    ctx.fillStyle = '#10131d';
    roundRect(ctx, imgBoxX, ttkBoxY, imgBoxW, 105, 8);
    ctx.fill();
    ctx.strokeStyle = '#252a3d';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px RobotoMono-Bold, monospace';
    ctx.fillText('⚡ TIME-TO-KILL (TTK)', imgBoxX + 16, ttkBoxY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Roboto-Bold, sans-serif';
    ctx.fillText(`Head: ${w1.ttkHeadMs}ms  (${w1.stkHead} shots)`, imgBoxX + 16, ttkBoxY + 54);
    ctx.fillText(`Body: ${w1.ttkBodyMs}ms  (${w1.stkBody} shots)`, imgBoxX + 16, ttkBoxY + 84);

    // Right Panel: Stats Breakdown
    const statsX = 345;
    const statsY = 90;
    const statsW = baseW - statsX - 35;

    const drawStatRow = (label, val, barPct, color, y) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px RobotoMono-Bold, monospace';
      ctx.fillText(label.toUpperCase(), statsX, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px RobotoMono-Bold, monospace';
      ctx.fillText(val, statsX + statsW, y);
      ctx.textAlign = 'left';

      // Bar background
      ctx.fillStyle = '#161924';
      roundRect(ctx, statsX, y + 6, statsW, 8, 4);
      ctx.fill();

      // Bar fill
      ctx.fillStyle = color;
      const fillW = Math.max(8, Math.min(statsW, statsW * (barPct / 100)));
      roundRect(ctx, statsX, y + 6, fillW, 8, 4);
      ctx.fill();
    };

    let curY = statsY + 16;
    drawStatRow('Headshot Damage', `${w1.damage.head} HP (${w1.headshotMultiplier}x)`, (w1.damage.head / 150) * 100, '#ef4444', curY);
    curY += 46;
    drawStatRow('Body Damage', `${w1.damage.body} HP`, (w1.damage.body / 100) * 100, '#f59e0b', curY);
    curY += 46;
    drawStatRow('Fire Rate (RPM)', `${w1.fireRateRPM} RPM (${w1.shotDelayMs}ms delay)`, (w1.fireRateRPM / 900) * 100, '#38bdf8', curY);
    curY += 46;
    const magVal = typeof w1.magSize === 'number' ? `${w1.magSize} Rounds` : w1.magSize;
    const magPct = typeof w1.magSize === 'number' ? (w1.magSize / 60) * 100 : 100;
    drawStatRow('Magazine Capacity', magVal, magPct, '#a855f7', curY);
    curY += 46;
    drawStatRow('Reload Speed', `${w1.reloadSec}s`, Math.max(10, (1 - (w1.reloadSec / 3.5)) * 100), '#10b981', curY);

    // Pros & Cons Box
    const prosBoxY = curY + 36;
    ctx.fillStyle = '#0f111a';
    roundRect(ctx, statsX, prosBoxY, statsW, 115, 8);
    ctx.fill();
    ctx.strokeStyle = '#1e2230';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 11px Roboto-Bold, sans-serif';
    ctx.fillText('✔ STRENGTHS:', statsX + 16, prosBoxY + 24);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px Roboto, sans-serif';
    ctx.fillText(`• ${w1.pros[0] || 'High damage output'}`, statsX + 16, prosBoxY + 44);
    ctx.fillText(`• ${w1.pros[1] || 'Reliable accuracy'}`, statsX + 16, prosBoxY + 62);

    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 11px Roboto-Bold, sans-serif';
    ctx.fillText('✖ WEAKNESSES:', statsX + 16, prosBoxY + 84);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px Roboto, sans-serif';
    ctx.fillText(`• ${w1.cons[0] || 'Specific range requirement'}`, statsX + 16, prosBoxY + 102);

  } else {
    // -------------------------------------------------------------
    // WEAPON COMPARISON VIEW (W1 vs W2)
    // -------------------------------------------------------------
    // Title Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Roboto-Bold, sans-serif';
    ctx.fillText('⚔️ WEAPON HEAD-TO-HEAD COMPARISON', 35, 42);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px RobotoMono-Bold, monospace';
    ctx.fillText('KIRKA.IO DPS & TTK SHOOTOUT ANALYSIS', 35, 62);

    const colW = 420;
    const leftX = 35;
    const rightX = baseW - colW - 35;
    const contentY = 85;

    const drawWeaponCol = (w, x, isRight, otherW) => {
      // Box header
      ctx.fillStyle = '#10131d';
      roundRect(ctx, x, contentY, colW, 400, 10);
      ctx.fill();
      ctx.strokeStyle = w.color || '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Weapon Title & Category
      ctx.fillStyle = w.color || '#38bdf8';
      ctx.font = 'bold 18px Roboto-Bold, sans-serif';
      ctx.fillText(`${w.icon} ${w.name}`, x + 16, contentY + 28);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px RobotoMono-Bold, monospace';
      ctx.fillText(w.category.toUpperCase(), x + 16, contentY + 46);

      // Weapon Thumbnail
      const imgX = x + colW - 120;
      const imgY = contentY + 12;
      const imgObj = isRight ? img2 : img1;
      if (imgObj) {
        try {
          ctx.drawImage(imgObj, imgX, imgY, 105, 55);
        } catch {}
      }

      // Divider
      ctx.strokeStyle = '#1e2230';
      ctx.beginPath();
      ctx.moveTo(x + 16, contentY + 75);
      ctx.lineTo(x + colW - 16, contentY + 75);
      ctx.stroke();

      // Stats comparison rows
      let rowY = contentY + 102;
      const compRow = (label, val, isBetter) => {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px RobotoMono-Bold, monospace';
        ctx.fillText(label.toUpperCase(), x + 18, rowY);

        ctx.textAlign = 'right';
        ctx.fillStyle = isBetter ? '#4ade80' : '#ffffff';
        ctx.font = isBetter ? 'bold 12px RobotoMono-Bold, monospace' : '12px RobotoMono-Bold, monospace';
        ctx.fillText((isBetter ? '🏆 ' : '') + val, x + colW - 18, rowY);
        ctx.textAlign = 'left';
        rowY += 32;
      };

      // 1. Headshot Damage
      const headBetter = w.damage.head > otherW.damage.head;
      compRow('Headshot Damage', `${w.damage.head} HP (${w.headshotMultiplier}x)`, headBetter);

      // 2. Body Damage
      const bodyBetter = w.damage.body > otherW.damage.body;
      compRow('Body Damage', `${w.damage.body} HP`, bodyBetter);

      // 3. Fire Rate
      const rpmBetter = w.fireRateRPM > otherW.fireRateRPM;
      compRow('Fire Rate (RPM)', `${w.fireRateRPM} RPM`, rpmBetter);

      // 4. Head TTK
      const headTtkBetter = w.ttkHeadMs < otherW.ttkHeadMs;
      compRow('Headshot TTK', `${w.ttkHeadMs}ms (${w.stkHead} hits)`, headTtkBetter);

      // 5. Body TTK
      const bodyTtkBetter = w.ttkBodyMs < otherW.ttkBodyMs;
      compRow('Body TTK', `${w.ttkBodyMs}ms (${w.stkBody} hits)`, bodyTtkBetter);

      // 6. Magazine Capacity
      const mag1 = typeof w.magSize === 'number' ? w.magSize : 999;
      const mag2 = typeof otherW.magSize === 'number' ? otherW.magSize : 999;
      compRow('Mag Capacity', `${w.magSize} Rounds`, mag1 > mag2);

      // 7. Reload Speed
      compRow('Reload Speed', `${w.reloadSec}s`, w.reloadSec < otherW.reloadSec);

      // Bottom Verdict
      const vBoxY = contentY + 335;
      ctx.fillStyle = '#0a0b10';
      roundRect(ctx, x + 12, vBoxY, colW - 24, 52, 6);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px RobotoMono-Bold, monospace';
      ctx.fillText('BEST ENGAGEMENT RANGE', x + 20, vBoxY + 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Roboto-Bold, sans-serif';
      ctx.fillText(w.range, x + 20, vBoxY + 38);
    };

    drawWeaponCol(w1, leftX, false, w2);
    drawWeaponCol(w2, rightX, true, w1);

    // Center VS Badge
    const cX = baseW / 2;
    const cY = contentY + 180;
    ctx.fillStyle = '#0f111a';
    ctx.strokeStyle = '#2d3348';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cX, cY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px Roboto-Bold, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', cX, cY + 5);
    ctx.textAlign = 'left';
  }

  // Footer Branding
  ctx.fillStyle = '#475569';
  ctx.font = '10px Roboto, sans-serif';
  ctx.fillText('KirkaHub Weapon Arsenal • Real In-Game Physics & Frame Data', 35, baseH - 12);

  return canvas.toBuffer('image/png');
}
