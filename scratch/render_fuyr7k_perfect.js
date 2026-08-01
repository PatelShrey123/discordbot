import dotenv from 'dotenv';
import fs from 'fs';
import { fetchUserProfile, fetchUserInventory } from '../src/api/kirka.js';
import { getBoltPriceMap, getItemPrice } from '../src/api/boltPrices.js';
import { renderInventoryGridPage } from '../src/canvas/inventoryGrid.js';
import { loadImage } from '@napi-rs/canvas';

dotenv.config();

const targetPath = 'C:/Users/Shrey/.gemini/antigravity/brain/f585adfd-da6b-4a56-a234-14ec6557e960/inventory_fuyr7k.png';

// Enhanced loader with 30s timeout and retries
const imageCache = new Map();
async function getCachedImageLongTimeout(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  if (imageCache.has(cleanUrl)) {
    return imageCache.get(cleanUrl);
  }

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
      imageCache.set(cleanUrl, null);
      return null;
    }
  }

  // 30 second timeout and retry logic
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s per attempt

    try {
      const res = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const img = await loadImage(buffer);
      imageCache.set(cleanUrl, img);
      return img;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Attempt ${attempt}/3] Failed to fetch image: ${cleanUrl} (${err.message})`);
      if (attempt === 3) {
        imageCache.set(cleanUrl, null);
        return null;
      }
      // Wait 1s before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function run() {
  // Override the imageLoader.js function globally for this test context
  const imageLoaderModule = await import('../src/canvas/imageLoader.js');
  imageLoaderModule.getCachedImage = getCachedImageLongTimeout;

  console.log('Fetching CrackedYOU (FUYR7K)...');
  const profile = await fetchUserProfile('FUYR7K');
  if (!profile) {
    console.error('Player not found!');
    process.exit(1);
  }

  console.log('Fetching inventory...');
  const inventory = await fetchUserInventory(profile.id);
  if (!inventory || inventory.length === 0) {
    console.error('No items found in inventory!');
    process.exit(1);
  }

  console.log('Fetching prices...');
  const priceMap = await getBoltPriceMap();

  const getSortWeight = (invItem) => {
    const item = invItem.item || invItem;
    const price = getItemPrice(priceMap, item);
    if (price > 0) return price;

    const rarity = (item.rarity || '').toLowerCase().trim();
    switch (rarity) {
      case 'contraband': return 50000000;
      case 'exotic':      return 35000000;
      case 'mythical':
      case 'mythic':     return 20000000;
      case 'legendary':  return 4000000;
      case 'epic':       return 500000;
      case 'rare':       return 50000;
      case 'uncommon':   return 5000;
      default:           return 1;
    }
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    return getSortWeight(b) - getSortWeight(a);
  });

  const pageItems = sortedInventory.slice(0, 25);

  console.log('Rendering canvas page...');
  const imageBuffer = await renderInventoryGridPage({
    items: sortedInventory,
    pageItems,
    priceMap,
    pageIndex: 0,
    totalPages: Math.ceil(sortedInventory.length / 25),
    username: profile.name
  });

  fs.writeFileSync(targetPath, imageBuffer);
  console.log('Saved perfect image successfully to', targetPath);
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Error rendering:', err);
  process.exit(1);
});
