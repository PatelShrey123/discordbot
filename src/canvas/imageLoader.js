import { loadImage } from '@napi-rs/canvas';

const imageCache = new Map();

/**
  * Fetch and cache loaded image objects in memory to prevent slow duplicate network requests.
  */
export async function getCachedImage(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  if (imageCache.has(cleanUrl)) {
    return imageCache.get(cleanUrl);
  }

  // Handle local files directly or remote proxies
  let targetUrl = cleanUrl;
  const isLocal = cleanUrl.startsWith('.') || 
                  cleanUrl.startsWith('/') || 
                  cleanUrl.startsWith('data:') || 
                  /^[a-zA-Z]:\\/.test(cleanUrl);
                  
  if (!isLocal) {
    targetUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
  }

  try {
    const img = await loadImage(targetUrl);
    imageCache.set(cleanUrl, img);
    return img;
  } catch (err) {
    console.warn(`[ImageLoader] Failed to download or parse image: ${cleanUrl} (${err.message})`);
    // Store null temporarily to prevent constant retries of failing urls
    imageCache.set(cleanUrl, null);
    throw err;
  }
}
