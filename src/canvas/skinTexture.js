import { createCanvas } from '@napi-rs/canvas';
import { getCachedImage } from './imageLoader.js';
import { cleanItemUrl } from '../api/kirka.js';

// Character skins are 64x64 pixel-art sheets; Discord would show them as a speck, and its own
// scaling would blur them. Anything this small is enlarged with nearest-neighbour so each texel
// stays a crisp square. Weapon textures are already 1024px and are only capped, never enlarged.
const SMALL_TEXTURE = 128;
const UPSCALED_SIZE = 512;
const MAX_SIZE = 1024;

/**
 * Turn a skin's texture into a PNG Discord can attach.
 *
 * Textures arrive in three shapes: a kirka.io asset URL, an api2 skin-texture URL, or (for most
 * character skins) a base64 data: URI. Embeds cannot show data: URIs at all, so the texture is
 * always drawn here and sent as a file rather than linked.
 *
 * Returns null when no texture can be loaded, so the caller can fall back to the render.
 */
export async function renderSkinTexture(item) {
  const name = (item?.name || '').replace(/^_+/, '').trim();
  const candidates = [
    item?.textureUrl,
    // Newer skins live on api2 even when the catalogue entry has no usable texture URL
    cleanItemUrl(null, name, true),
  ].filter(Boolean);

  let img = null;
  for (const url of [...new Set(candidates)]) {
    img = await getCachedImage(url);
    if (img) break;
  }
  if (!img || !img.width || !img.height) return null;

  const longest = Math.max(img.width, img.height);
  const scale = longest <= SMALL_TEXTURE
    ? Math.floor(UPSCALED_SIZE / longest)
    : Math.min(1, MAX_SIZE / longest);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = longest > SMALL_TEXTURE;
  ctx.drawImage(img, 0, 0, w, h);

  return {
    buffer: canvas.toBuffer('image/png'),
    width: img.width,
    height: img.height,
  };
}
