import { loadImage } from '@napi-rs/canvas';

const imageCache = new Map();

/**
  * Fetch and cache loaded image objects in memory.
  * Direct downloads without proxy to bypass weserv.nl blocks/rate-limits on hosting environments.
  */
export async function getCachedImage(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  if (imageCache.has(cleanUrl)) {
    const cached = imageCache.get(cleanUrl);
    if (cached) return cached;
  }

  // Handle local files or data URIs directly
  const isLocal = cleanUrl.startsWith('.') || 
                  cleanUrl.startsWith('/') || 
                  cleanUrl.startsWith('data:') || 
                  /^[a-zA-Z]:\\/.test(cleanUrl);
                  
  if (isLocal) {
    try {
      const img = await loadImage(cleanUrl);
      if (img) imageCache.set(cleanUrl, img);
      return img;
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
        if (img) {
          imageCache.set(cleanUrl, img);
          return img;
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  console.warn(`[ImageLoader] All fetch attempts failed for: ${cleanUrl}`);
  return null;
}
