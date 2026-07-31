import { loadImage } from '@napi-rs/canvas';

const imageCache = new Map();

/**
  * Fetch and cache loaded image objects in memory to prevent slow duplicate network requests.
  * Remote requests include a 3.5-second timeout to prevent hangs.
  */
export async function getCachedImage(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  if (imageCache.has(cleanUrl)) {
    return imageCache.get(cleanUrl);
  }

  // Handle local files directly
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

  // Remote image loading with strict 3.5s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const targetUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0'
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
    console.warn(`[ImageLoader] Failed to download or parse remote image: ${cleanUrl} (${err.message})`);
    imageCache.set(cleanUrl, null);
    return null;
  }
}
