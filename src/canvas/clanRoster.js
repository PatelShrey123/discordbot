import { createCanvas } from '@napi-rs/canvas';

export async function renderClanRosterPage(clan, rank, pageIdx, totalPages) {
  // Render at 2x resolution for ultra-sharp high-definition image quality
  const scale = 2;
  const width = 640 * scale;
  const height = 440 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Sleek deep space black background matching website theme
  ctx.fillStyle = '#08090a';
  ctx.fillRect(0, 0, width, height);

  // Group members by role and sort by contribution score
  const members = clan.members || [];
  const leaders = members.filter(m => m.role === 'LEADER').sort((a, b) => b.allScores - a.allScores);
  const officers = members.filter(m => m.role === 'OFFICER').sort((a, b) => b.allScores - a.allScores);
  const newbies = members.filter(m => m.role === 'NEWBIE').sort((a, b) => b.allScores - a.allScores);

  const listItems = [];

  // Theme gold color palette for roles
  if (leaders.length > 0) {
    listItems.push({ type: 'header', text: `Leader [${leaders.length}]`, color: '#f59e0b' }); // Bright gold
    leaders.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (officers.length > 0) {
    listItems.push({ type: 'header', text: `Officers [${officers.length}]`, color: '#fbbf24' }); // Warm gold
    officers.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (newbies.length > 0) {
    listItems.push({ type: 'header', text: `Newbies [${newbies.length}]`, color: '#d97706' }); // Bronze gold
    newbies.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  // Layout parameters scaled for 2x
  const leftX = 20 * scale;
  const rightX = 335 * scale;
  const colW = 285 * scale;
  const rowH = 24 * scale;

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

  // Draw "Clan Page" Box on Page 1 (Golden & Black Theme)
  if (pageIdx === 0) {
    ctx.fillStyle = '#111215'; // Dark grey-black container
    ctx.beginPath();
    ctx.roundRect(leftX, 15 * scale, colW, 110 * scale, 6 * scale);
    ctx.fill();
    
    // Gold highlighted border
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Box Header "Clan Page"
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fbbf24'; // Warm Gold
    ctx.textAlign = 'center';
    ctx.fillText('Clan Page', leftX + colW / 2, 36 * scale);

    // Box details (2 column layout inside box)
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    
    // Column 1
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Name:', leftX + 15 * scale, 58 * scale);
    ctx.fillText('Score:', leftX + 15 * scale, 80 * scale);
    ctx.fillText('Since:', leftX + 15 * scale, 102 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(clan.name || 'Unknown', leftX + 60 * scale, 58 * scale);
    ctx.fillText((clan.allScores || 0).toLocaleString(), leftX + 60 * scale, 80 * scale);
    
    const sinceDate = clan.createdAt ? new Date(clan.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    ctx.fillText(sinceDate, leftX + 60 * scale, 102 * scale);

    // Column 2
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Members:', leftX + 155 * scale, 58 * scale);
    ctx.fillText('Leaderboard:', leftX + 155 * scale, 80 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${members.length}`, leftX + 225 * scale, 58 * scale);
    ctx.fillText(rank > 0 ? `#${rank}` : 'Unranked', leftX + 242 * scale, 80 * scale);
  }

  // Helper to draw item (perfectly aligned using precise X coordinates instead of monospace)
  const drawRow = (item, x, y) => {
    if (item.type === 'header') {
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.text, x, y + 16 * scale);
    } else {
      const u = item.data.user || {};
      const scoreVal = (item.data.allScores || 0).toLocaleString();

      ctx.font = '24px system-ui, -apple-system, sans-serif';

      // Level
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(`${u.level || 0}`, x, y + 16 * scale);

      // Pipe separator
      ctx.fillStyle = '#475569';
      ctx.fillText('|', x + 25 * scale, y + 16 * scale);

      // Name (Standard readable sans-serif font)
      ctx.fillStyle = '#ffffff';
      ctx.fillText(u.name || 'Unknown', x + 38 * scale, y + 16 * scale);

      // Score (Pop out in matching warm Gold)
      ctx.fillStyle = '#fbbf24';
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

  // Footer: Page indicator
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`Page #${pageIdx + 1}/${totalPages}`, leftX, height - 16 * scale);

  return canvas.toBuffer('image/png');
}
