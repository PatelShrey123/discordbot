import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';

const imagePath = 'C:\\Users\\Shrey\\.gemini\\antigravity\\brain\\f585adfd-da6b-4a56-a234-14ec6557e960\\.user_uploaded\\media__1785522428777.png';

async function analyze() {
  try {
    const buffer = fs.readFileSync(imagePath);
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const w = img.width;
    const h = img.height;
    
    console.log('Scanning image columns at Y = 100 for cell boundaries...');
    let currentBlock = [];
    for (let x = 0; x < w; x++) {
      const p = ctx.getImageData(x, 100, 1, 1).data;
      const hex = '#' + [p[0], p[1], p[2]].map(val => val.toString(16).padStart(2, '0')).join('');
      
      // If color is NOT #111111 or #000000, it's inside a cell or border!
      const isBg = (hex === '#111111' || hex === '#000000');
      if (!isBg) {
        currentBlock.push(x);
      } else {
        if (currentBlock.length > 0) {
          console.log(`Block from X = ${currentBlock[0]} to ${currentBlock[currentBlock.length - 1]} (width: ${currentBlock.length})`);
          currentBlock = [];
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

analyze();
