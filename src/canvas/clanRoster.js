import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'RobotoBold');
} catch (err) {
  console.warn('Failed to register Roboto fonts in clanRoster:', err.message);
}

export async function renderClanRosterPage(clan, rank, pageIdx, totalPages) {
  // Render at 2x resolution for ultra-sharp high-definition image quality
  const scale = 2;
  const width = 640 * scale;
  const height = 440 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Medium-dark grey background matching the uploaded screenshot (#2c2d30)
  ctx.fillStyle = '#2c2d30';
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

  // Draw "Clan Page" Box on Page 1 (Discord dark grey theme)
  if (pageIdx === 0) {
    ctx.fillStyle = '#1e1f22'; // Dark container background
    ctx.beginPath();
    ctx.roundRect(leftX, 15 * scale, colW, 110 * scale, 6 * scale);
    ctx.fill();
    
    ctx.strokeStyle = '#3f4248';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Box Header "Clan Page"
    ctx.font = 'bold 30px RobotoBold';
    ctx.fillStyle = '#5865f2'; // Discord Blurple
    ctx.textAlign = 'center';
    ctx.fillText('Clan Page', leftX + colW / 2, 36 * scale);

    // Box details (2 column layout inside box)
    ctx.font = 'bold 22px RobotoBold';
    
    // Column 1
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5865f2';
    ctx.fillText('Name:', leftX + 15 * scale, 58 * scale);
    ctx.fillText('Score:', leftX + 15 * scale, 80 * scale);
    ctx.fillText('Since:', leftX + 15 * scale, 102 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(clan.name || 'Unknown', leftX + 65 * scale, 58 * scale);
    ctx.fillText((clan.allScores || 0).toLocaleString(), leftX + 65 * scale, 80 * scale);
    
    const sinceDate = clan.createdAt ? new Date(clan.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    ctx.fillText(sinceDate, leftX + 65 * scale, 102 * scale);

    // Column 2
    ctx.fillStyle = '#5865f2';
    ctx.fillText('Members:', leftX + 155 * scale, 58 * scale);
    ctx.fillText('Leaderboard:', leftX + 155 * scale, 80 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${members.length}`, leftX + 225 * scale, 58 * scale);
    ctx.fillText(rank > 0 ? `#${rank}` : 'Unranked', leftX + 248 * scale, 80 * scale);
  }

  // Helper to draw item (perfectly aligned matching Image 9)
  const drawRow = (item, x, y) => {
    if (item.type === 'header') {
      ctx.font = 'bold 26px RobotoBold';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.text, x, y + 16 * scale);
    } else {
      const u = item.data.user || {};
      const scoreVal = (item.data.allScores || 0).toLocaleString();

      ctx.font = 'bold 24px Roboto';

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

  // Footer: Page indicator in grey
  ctx.font = 'bold 22px Roboto';
  ctx.fillStyle = '#8e9297';
  ctx.textAlign = 'left';
  ctx.fillText(`Page #${pageIdx + 1}/${totalPages}`, leftX, height - 16 * scale);

  return canvas.toBuffer('image/png');
}
