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
    return imageCache.get(cleanUrl);
  }

  // Handle local files or data URIs directly
  const isLocal = cleanUrl.startsWith('.') || 
                  cleanUrl.startsWith('/') || 
                  cleanUrl.startsWith('data:') || 
                  /^[a-zA-Z]:\\/.test(cleanUrl);
                  
  if (isLocal) {
    try {
      const img = await loadImage(cleanUrl);
      imageCache.set(cleanUrl, img);
      return img;
    } catch (err) {
      console.warn(`[ImageLoader] Failed to load local image: ${cleanUrl} (${err.message})`);
      imageCache.set(cleanUrl, null);
      return null;
    }
  }

  // Remote image loading: Fetch direct image buffer with browser User-Agent
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const img = await loadImage(buffer);
    imageCache.set(cleanUrl, img);
    return img;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[ImageLoader] Failed to fetch remote image direct: ${cleanUrl} (${err.message})`);
    imageCache.set(cleanUrl, null);
    return null;
  }
}
