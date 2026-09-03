import { createCanvas, loadImage } from '@napi-rs/canvas';
import pkg from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = pkg;
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve('cache/gifs');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const RARITY_COLORS = {
  MYTHICAL: { glow: 'rgba(234, 88, 12, 0.3)', border: '#ea580c' },
  LEGENDARY: { glow: 'rgba(251, 191, 36, 0.3)', border: '#fbbf24' },
  EPIC: { glow: 'rgba(168, 85, 247, 0.3)', border: '#a855f7' },
  RARE: { glow: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6' },
  UNCOMMON: { glow: 'rgba(16, 185, 129, 0.3)', border: '#10b981' },
  COMMON: { glow: 'rgba(156, 163, 175, 0.2)', border: '#9ca3af' }
};

/**
 * Generate a high-performance 3D turntable rotating animated GIF.
 * Runs 100% reliably in pure Node.js on Render.com/Linux without WebGL or GPU dependencies!
 *
 * @param {Object} item - Kirka item object
 * @param {string} [textureUrl] - Optional fallback texture URL
 * @param {string} [weaponType] - Weapon or character type
 * @returns {Promise<Buffer|null>}
 */
export async function renderSkin3DGif(item, textureUrl = null, weaponType = null) {
  try {
    const rawName = item?.name || 'unknown';
    const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const rarity = (item?.rarity || 'COMMON').toUpperCase();
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;

    const cacheFile = path.join(CACHE_DIR, `${cleanName}_${rarity.toLowerCase()}.gif`);

    // 1. Check disk cache for 0ms instant response
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile);
    }

    // 2. Resolve render source (prefer high-res renderUrl, fallback to textureUrl)
    let imageUrl = item?.renderUrl;
    if (!imageUrl && textureUrl) {
      imageUrl = textureUrl;
    }
    if (!imageUrl) {
      return null;
    }

    // Clean any malformed prefix from Kirka API
    if (imageUrl.includes('data:image')) {
      const idx = imageUrl.indexOf('data:image');
      imageUrl = imageUrl.substring(idx);
    }

    let imageBuffer;
    if (imageUrl.startsWith('data:image')) {
      const b64 = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(b64, 'base64');
    } else {
      const res = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (!res.ok) return null;
      imageBuffer = Buffer.from(await res.arrayBuffer());
    }

    const skinImage = await loadImage(imageBuffer);
    if (!skinImage.width || !skinImage.height) return null;

    const isCharacter = item?.type === 'BODY_SKIN' || weaponType === 'CHARACTER';
    const width = isCharacter ? 320 : 380;
    const height = isCharacter ? 320 : 230;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const frames = 16;
    const gif = GIFEncoder();

    // Determine render size to fill canvas nicely
    let targetW, targetH;
    if (isCharacter) {
      targetH = height * 0.76;
      targetW = (targetH / skinImage.height) * skinImage.width;
    } else {
      targetW = width * 0.75;
      targetH = (targetW / skinImage.width) * skinImage.height;
    }

    const centerY = height / 2 - (isCharacter ? 4 : 8);

    for (let i = 0; i < frames; i++) {
      const angle = (i / frames) * Math.PI * 2;
      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bgGrad = ctx.createRadialGradient(width / 2, centerY, 10, width / 2, centerY, width * 0.65);
      bgGrad.addColorStop(0, '#141824');
      bgGrad.addColorStop(1, '#07090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Rarity ambient glow
      const glowGrad = ctx.createRadialGradient(width / 2, centerY, 20, width / 2, centerY, width * 0.5);
      glowGrad.addColorStop(0, colors.glow);
      glowGrad.addColorStop(1, 'rgba(7, 9, 14, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 3D Turntable Platform / Shadow
      const pedestalY = isCharacter ? height - 32 : height - 26;
      ctx.save();
      ctx.translate(width / 2, pedestalY);
      ctx.scale(1, 0.28);

      // Dark drop shadow
      ctx.beginPath();
      ctx.arc(0, 0, isCharacter ? 65 : 100, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();

      // Glowing turntable rim
      ctx.beginPath();
      ctx.arc(0, 0, isCharacter ? 70 : 105, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = colors.border;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.restore();

      // 3D Perspective Rotation Simulation
      ctx.save();
      ctx.translate(width / 2, centerY);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Perspective depth scaling
      const zDepth = 1 + sinA * 0.14;
      const scaleX = cosA * zDepth;
      const scaleY = zDepth;

      ctx.scale(scaleX, scaleY);

      // Dynamic lighting shimmer as front angle sweeps past
      if (sinA > 0) {
        ctx.filter = `brightness(${1 + sinA * 0.22})`;
      } else {
        ctx.filter = `brightness(${0.8 + (1 + sinA) * 0.2})`;
      }

      ctx.drawImage(skinImage, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();

      // Sleek UI corner reticles
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      const cSize = 10;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(12, 12 + cSize); ctx.lineTo(12, 12); ctx.lineTo(12 + cSize, 12); ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(width - 12, height - 12 - cSize); ctx.lineTo(width - 12, height - 12); ctx.lineTo(width - 12 - cSize, height - 12); ctx.stroke();

      // Subtle "360° PREVIEW" watermark
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = colors.border;
      ctx.globalAlpha = 0.55;
      ctx.textAlign = 'right';
      ctx.fillText('360° PREVIEW', width - 14, 20);

      // Encode frame
      const imgData = ctx.getImageData(0, 0, width, height);
      const palette = quantize(imgData.data, 64);
      const index = applyPalette(imgData.data, palette);
      gif.writeFrame(index, width, height, { palette, delay: 1000 / 12 });
    }

    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    // Save to disk cache
    fs.writeFileSync(cacheFile, gifBuffer);
    console.log(`[Skin3DGif] Generated 360 preview GIF for ${rawName} (${(gifBuffer.length / 1024).toFixed(1)} KB)`);

    return gifBuffer;
  } catch (err) {
    console.error(`[Skin3DGif] Error generating 3D GIF for ${item?.name}:`, err.message);
    return null;
  }
}
