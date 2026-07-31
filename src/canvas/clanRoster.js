import { createCanvas } from '@napi-rs/canvas';

export async function renderClanRosterPage(clan, rank, pageIdx, totalPages) {
  const width = 640;
  const height = 440;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark charcoal/slate background matching Image 8
  ctx.fillStyle = '#121316';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Group members by role and sort by contribution score
  const members = clan.members || [];
  const leaders = members.filter(m => m.role === 'LEADER').sort((a, b) => b.allScores - a.allScores);
  const officers = members.filter(m => m.role === 'OFFICER').sort((a, b) => b.allScores - a.allScores);
  const newbies = members.filter(m => m.role === 'NEWBIE').sort((a, b) => b.allScores - a.allScores);

  // Build the flat list of elements to render (headers and members)
  const listItems = [];

  if (leaders.length > 0) {
    listItems.push({ type: 'header', text: `Leader [${leaders.length}]`, color: '#22c55e' });
    leaders.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (officers.length > 0) {
    listItems.push({ type: 'header', text: `Officers [${officers.length}]`, color: '#3b82f6' });
    officers.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  if (newbies.length > 0) {
    listItems.push({ type: 'header', text: `Newbies [${newbies.length}]`, color: '#06b6d4' });
    newbies.forEach(m => listItems.push({ type: 'member', data: m }));
  }

  // Layout calculations
  const leftX = 20;
  const rightX = 330;
  const colW = 290;
  const rowH = 26;

  // On page 0 (Page 1):
  // Left column top has the "Clan Page" info box (takes up Y from 20 to 140)
  // Left column rows start at Y = 150 (leaves room for 10 items)
  // Right column rows start at Y = 20 (leaves room for 15 items)
  // On pages 1+ (Pages 2+):
  // Left and Right columns start at Y = 20 (leaves room for 15 items in each column)

  let itemsLeft = [];
  let itemsRight = [];

  if (pageIdx === 0) {
    // Page 1
    // Left column gets first 10 items
    itemsLeft = listItems.slice(0, 10);
    // Right column gets next 15 items
    itemsRight = listItems.slice(10, 25);
  } else {
    // Page 2, 3, etc.
    const startIndex = 25 + (pageIdx - 1) * 30;
    itemsLeft = listItems.slice(startIndex, startIndex + 15);
    itemsRight = listItems.slice(startIndex + 15, startIndex + 30);
  }

  // Draw "Clan Page" Box on Page 1
  if (pageIdx === 0) {
    ctx.fillStyle = '#17191e';
    ctx.beginPath();
    ctx.roundRect(leftX, 20, colW, 115, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    // Box Header "Clan Page"
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#8b5cf6'; // Violet/Purple
    ctx.textAlign = 'center';
    ctx.fillText('Clan Page', leftX + colW / 2, 42);

    // Box details (2 column layout inside box)
    ctx.font = '12px sans-serif';
    
    // Column 1 (labels)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b5cf6';
    ctx.fillText('Name:', leftX + 15, 68);
    ctx.fillText('Score:', leftX + 15, 90);
    ctx.fillText('Since:', leftX + 15, 112);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(clan.name || 'Unknown', leftX + 60, 68);
    ctx.fillText((clan.allScores || 0).toLocaleString(), leftX + 60, 90);
    
    const sinceDate = clan.createdAt ? new Date(clan.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    ctx.fillText(sinceDate, leftX + 60, 112);

    // Column 2 (members and leaderboard)
    ctx.fillStyle = '#8b5cf6';
    ctx.fillText('Members:', leftX + 165, 68);
    ctx.fillText('Leaderboard:', leftX + 165, 90);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${members.length}`, leftX + 245, 68);
    ctx.fillText(rank > 0 ? `#${rank}` : 'Unranked', leftX + 245, 90);
  }

  // Helper to draw item (either header or member row)
  const drawRow = (item, x, y) => {
    if (item.type === 'header') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.text, x, y + 16);
    } else {
      const u = item.data.user || {};
      const scoreVal = (item.data.allScores || 0).toLocaleString();

      // Level
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(`${u.level || 0}`, x, y + 16);

      // Pipe separator
      ctx.fillStyle = '#475569';
      ctx.fillText('|', x + 25, y + 16);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.fillText(u.name || 'Unknown', x + 35, y + 16);

      // Score
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'right';
      ctx.fillText(scoreVal, x + colW, y + 16);
    }
  };

  // Render left column
  let currentY = pageIdx === 0 ? 150 : 25;
  itemsLeft.forEach(item => {
    drawRow(item, leftX, currentY);
    currentY += rowH;
  });

  // Render right column
  currentY = 25;
  itemsRight.forEach(item => {
    drawRow(item, rightX, currentY);
    currentY += rowH;
  });

  // Footer: Page indicator
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(`Page #${pageIdx + 1}/${totalPages}`, leftX, height - 15);

  return canvas.toBuffer('image/png');
}
