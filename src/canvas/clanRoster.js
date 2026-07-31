import { createCanvas } from '@napi-rs/canvas';

export async function renderClanRosterPage(clan, rank, pageIdx, totalPages) {
  const width = 640;
  const height = 440;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark slate/black background matching official bot look
  ctx.fillStyle = '#0f1013';
  ctx.fillRect(0, 0, width, height);

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
  const rightX = 335;
  const colW = 285;
  const rowH = 24;

  let itemsLeft = [];
  let itemsRight = [];

  if (pageIdx === 0) {
    // Page 1
    itemsLeft = listItems.slice(0, 10);
    itemsRight = listItems.slice(10, 26); // Fits up to 16 items on the right side
  } else {
    // Pages 2+
    const startIndex = 26 + (pageIdx - 1) * 32;
    itemsLeft = listItems.slice(startIndex, startIndex + 16);
    itemsRight = listItems.slice(startIndex + 16, startIndex + 32);
  }

  // Draw "Clan Page" Box on Page 1
  if (pageIdx === 0) {
    ctx.fillStyle = '#15171c';
    ctx.beginPath();
    ctx.roundRect(leftX, 15, colW, 110, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Box Header "Clan Page"
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#635df7'; // Official bot purplish-blue
    ctx.textAlign = 'center';
    ctx.fillText('Clan Page', leftX + colW / 2, 34);

    // Box details (2 column layout inside box)
    ctx.font = '12px sans-serif';
    
    // Column 1 (labels)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#635df7';
    ctx.fillText('Name:', leftX + 12, 56);
    ctx.fillText('Score:', leftX + 12, 78);
    ctx.fillText('Since:', leftX + 12, 100);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(clan.name || 'Unknown', leftX + 54, 56);
    ctx.fillText((clan.allScores || 0).toLocaleString(), leftX + 54, 78);
    
    const sinceDate = clan.createdAt ? new Date(clan.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    ctx.fillText(sinceDate, leftX + 54, 100);

    // Column 2 (members and leaderboard)
    ctx.fillStyle = '#635df7';
    ctx.fillText('Members:', leftX + 148, 56);
    ctx.fillText('Leaderboard:', leftX + 148, 78);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${members.length}`, leftX + 215, 56);
    ctx.fillText(rank > 0 ? `#${rank}` : 'Unranked', leftX + 230, 78);
  }

  // Helper to draw item (either header or member row)
  const drawRow = (item, x, y) => {
    if (item.type === 'header') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.text, x, y + 15);
    } else {
      const u = item.data.user || {};
      const scoreVal = (item.data.allScores || 0).toLocaleString();

      // Roster list font matches official monospace layout
      ctx.font = '13px monospace';

      // Level
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(`${u.level || 0}`, x, y + 15);

      // Pipe separator
      ctx.fillStyle = '#475569';
      ctx.fillText('|', x + 25, y + 15);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.fillText(u.name || 'Unknown', x + 38, y + 15);

      // Score
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'right';
      ctx.fillText(scoreVal, x + colW, y + 15);
    }
  };

  // Render left column
  let currentY = pageIdx === 0 ? 140 : 20;
  itemsLeft.forEach(item => {
    drawRow(item, leftX, currentY);
    currentY += rowH;
  });

  // Render right column
  currentY = 20;
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
