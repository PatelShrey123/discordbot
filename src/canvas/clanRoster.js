import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCachedImage } from './imageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bgPath = join(__dirname, '../../assets/bg.jpg');

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'RobotoMono');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Doto.ttf'), 'RobotoMono-Bold');
} catch (err) {
  console.warn('Failed to register Doto fonts in clanRoster:', err.message);
}

export async function renderClanRosterPage(clan, rank, pageIdx, totalPages) {
  // Render at 2x resolution for ultra-sharp high-definition image quality
  const scale = 2;
  const width = 640 * scale;
  const height = 440 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw premium background (car headlights bg, matching profile card!)
  try {
    const bgImg = await getCachedImage(bgPath);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#2c2d30';
      ctx.fillRect(0, 0, width, height);
    }
  } catch (err) {
    ctx.fillStyle = '#2c2d30';
    ctx.fillRect(0, 0, width, height);
  }

  // Semi-transparent dark overlay for high contrast text readability (matching profile!)
  ctx.fillStyle = 'rgba(10, 11, 15, 0.7)';
  ctx.fillRect(0, 0, width, height);

  // Outer border frame (light grey #808080)
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(0, 0, width, height);

  // Group members by role and sort by contribution score
  const members = clan.members || [];
  const leaders = members.filter(m => m.role === 'LEADER').sort((a, b) => b.allScores - a.allScores);
  const officers = members.filter(m => m.role === 'OFFICER').sort((a, b) => b.allScores - a.allScores);
  const newbies = members.filter(m => m.role === 'NEWBIE').sort((a, b) => b.allScores - a.allScores);

  const listItems = [];

  // Cyan/teal headers for roles
  if (leaders.length > 0) {
    listItems.push({ type: 'header', text: `Leader [${leaders.length}]`, color: '#00ffff' });
    leaders.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (officers.length > 0) {
    listItems.push({ type: 'header', text: `Officers [${officers.length}]`, color: '#00ffff' });
    officers.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (newbies.length > 0) {
    listItems.push({ type: 'header', text: `Newbies [${newbies.length}]`, color: '#00ffff' });
    newbies.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  // Layout parameters scaled for 2x
  const leftX = 20 * scale;
  const rightX = 335 * scale;
  const colW = 285 * scale;
  const rowH = 24 * scale;

  // Draw central partition line in light grey
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(320 * scale, 0);
  ctx.lineTo(320 * scale, height);
  ctx.stroke();

  let itemsLeft = [];
  let itemsRight = [];

  if (pageIdx === 0) {
    itemsLeft = listItems.slice(0, 10);
    itemsRight = listItems.slice(10, 26);
  } else {
    const startIndex = 26 + (pageIdx - 1) * 32;
    itemsLeft = listItems.slice(startIndex, startIndex + 16);
    itemsRight = listItems.slice(startIndex + 16, startIndex + 32);
  }

  // Draw "Clan Page" Box on Page 1 (Discord dark grey theme with 2x2 grid layout)
  if (pageIdx === 0) {
    const boxY = 15 * scale;
    const boxH = 112 * scale; // Perfect spacing
    
    ctx.fillStyle = '#1e1f22'; // Dark container background
    ctx.beginPath();
    ctx.roundRect(leftX, boxY, colW, boxH, 6 * scale);
    ctx.fill();
    
    ctx.strokeStyle = '#3f4248';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Box Header: Centered Clan Name (Cooler RobotoMono font)
    ctx.font = 'bold 24px RobotoMonoBold';
    ctx.fillStyle = '#5865f2'; // Discord Blurple
    ctx.textAlign = 'center';
    ctx.fillText(clan.name || 'Clan Profile', leftX + colW / 2, boxY + 24 * scale);

    // Subtle divider under name
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(leftX + 20 * scale, boxY + 32 * scale);
    ctx.lineTo(leftX + colW - 20 * scale, boxY + 32 * scale);
    ctx.stroke();

    // Draw inner 2x2 grid dividers
    const gridCenterY = boxY + 72 * scale;
    ctx.beginPath();
    // Vertical partition
    ctx.moveTo(leftX + colW / 2, boxY + 38 * scale);
    ctx.lineTo(leftX + colW / 2, boxY + boxH - 8 * scale);
    // Horizontal partition
    ctx.moveTo(leftX + 20 * scale, gridCenterY);
    ctx.lineTo(leftX + colW - 20 * scale, gridCenterY);
    ctx.stroke();

    // Box detail helper (Using cool RobotoMono fonts)
    const drawCell = (label, val, x, y) => {
      ctx.textAlign = 'center';
      // Label (grey, size 13px)
      ctx.font = 'bold 13px RobotoMono';
      ctx.fillStyle = '#8e9297'; 
      ctx.fillText(label, x, y);
      
      // Value (white, size 15px)
      ctx.font = 'bold 15px RobotoMono';
      ctx.fillStyle = '#ffffff'; 
      ctx.fillText(val, x, y + 18 * scale);
    };

    const sinceDate = clan.createdAt ? new Date(clan.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    const rankVal = rank > 0 ? `#${rank}` : 'Unranked';

    // Quadrant 1 (Top Left)
    drawCell('SCORE', (clan.allScores || 0).toLocaleString(), leftX + colW / 4, boxY + 48 * scale);
    // Quadrant 2 (Top Right)
    drawCell('LEADERBOARD', rankVal, leftX + (colW / 4) * 3, boxY + 48 * scale);
    // Quadrant 3 (Bottom Left)
    drawCell('MEMBERS', `${members.length}`, leftX + colW / 4, boxY + 86 * scale);
    // Quadrant 4 (Bottom Right)
    drawCell('SINCE', sinceDate, leftX + (colW / 4) * 3, boxY + 86 * scale);
  }

  // Helper to draw item (perfectly aligned matching Image 9, using monospaced fonts!)
  const drawRow = (item, x, y) => {
    if (item.type === 'header') {
      ctx.font = 'bold 24px RobotoMono';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.text, x, y + 16 * scale);
    } else {
      const u = item.data.user || {};
      const scoreVal = (item.data.allScores || 0).toLocaleString();

      ctx.font = '22px RobotoMono';

      // Level (white)
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${u.level || 0}`, x, y + 16 * scale);

      // Pipe separator (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillText('|', x + 35 * scale, y + 16 * scale);

      // Name (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillText(u.name || 'Unknown', x + 48 * scale, y + 16 * scale);

      // Score (white)
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(scoreVal, x + colW, y + 16 * scale);
    }
  };

  // Render left column
  let currentY = pageIdx === 0 ? 140 * scale : 20 * scale;
  itemsLeft.forEach(item => {
    drawRow(item, leftX, currentY);
    currentY += rowH;
  });

  // Render right column
  currentY = 20 * scale;
  itemsRight.forEach(item => {
    drawRow(item, rightX, currentY);
    currentY += rowH;
  });

  // Footer: Page indicator in grey (Using RobotoMono)
  ctx.font = '20px RobotoMono';
  ctx.fillStyle = '#8e9297';
  ctx.textAlign = 'left';
  ctx.fillText(`Page #${pageIdx + 1}/${totalPages}`, leftX, height - 16 * scale);

  return canvas.toBuffer('image/png');
}
