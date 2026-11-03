import { loadImage } from '@napi-rs/canvas';

// Decoded images cost width x height x 4 bytes each (a 1024px weapon texture is 4 MB) and used to
// be kept forever, so a day of /inventory paging filled the free host's 512 MB and crashed it.
// The cache is now capped by size and drops the least recently used images first.
const CACHE_BUDGET_BYTES = 48 * 1024 * 1024;
const imageCache = new Map(); // url -> { img, bytes }, oldest use first
let cacheBytes = 0;

function recall(url) {
  const entry = imageCache.get(url);
  if (!entry) return null;
  imageCache.delete(url); // re-insert so it counts as the newest use
  imageCache.set(url, entry);
  return entry.img;
}

function remember(url, img, cache) {
  if (!cache) return img;
  const bytes = (img.width || 0) * (img.height || 0) * 4;
  if (bytes > CACHE_BUDGET_BYTES / 4) return img; // one huge image would evict everything else
  const previous = imageCache.get(url); // two commands can fetch the same image at once
  if (previous) {
    imageCache.delete(url);
    cacheBytes -= previous.bytes;
  }
  imageCache.set(url, { img, bytes });
  cacheBytes += bytes;
  for (const [key, entry] of imageCache) {
    if (cacheBytes <= CACHE_BUDGET_BYTES) break;
    imageCache.delete(key);
    cacheBytes -= entry.bytes;
  }
  return img;
}

/**
  * Fetch and cache loaded image objects in memory.
  * Direct downloads without proxy to bypass weserv.nl blocks/rate-limits on hosting environments.
  * Pass { cache: false } for big one-off images (texture sheets) so they don't push out the renders.
  */
export async function getCachedImage(url, { cache = true } = {}) {
  if (!url) return null;
  const cleanUrl = url.trim();

  const cached = recall(cleanUrl);
  if (cached) return cached;

  // Handle local files or data URIs directly
  const isLocal = cleanUrl.startsWith('.') || 
                  cleanUrl.startsWith('/') || 
                  cleanUrl.startsWith('data:') || 
                  /^[a-zA-Z]:\\/.test(cleanUrl);
                  
  if (isLocal) {
    try {
      const img = await loadImage(cleanUrl);
      return img ? remember(cleanUrl, img, cache) : img;
    } catch (err) {
      console.warn(`[ImageLoader] Failed to load local image: ${cleanUrl} (${err.message})`);
      return null;
    }
  }

  // Attempt 1: Remote image loading with direct fetch & browser User-Agent
  const urlsToTry = [cleanUrl];
  if (cleanUrl.includes('/v') && cleanUrl.endsWith('.webp')) {
    const stripped = cleanUrl.replace(/\/v\d+\.webp$/, '');
    if (stripped !== cleanUrl) urlsToTry.push(stripped);
  }
  // Also add weserv.nl proxy as backup for cloud hosts
  if (cleanUrl.startsWith('http')) {
    urlsToTry.push(`https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&default=404`);
  }

  for (const targetUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'referer': 'https://kirka.io/'
        }
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const img = await loadImage(buffer);
        if (img) return remember(cleanUrl, img, cache);
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  console.warn(`[ImageLoader] All fetch attempts failed for: ${cleanUrl}`);
  return null;
}

/**
 * Fetch raw binary buffer of an image (used for GIF decoding).
 */
export async function getRawImageBuffer(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  const isLocal = cleanUrl.startsWith('.') || 
                  cleanUrl.startsWith('/') || 
                  cleanUrl.startsWith('data:') || 
                  /^[a-zA-Z]:\\/.test(cleanUrl);
                  
  if (isLocal) {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(cleanUrl);
    } catch (err) {
      console.warn(`[ImageLoader] Failed to read local file buffer: ${cleanUrl} (${err.message})`);
      return null;
    }
  }

  const urlsToTry = [cleanUrl];
  if (cleanUrl.startsWith('http')) {
    urlsToTry.push(`https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&default=404`);
  }

  for (const targetUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'referer': 'https://kirka.io/'
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return null;
}
