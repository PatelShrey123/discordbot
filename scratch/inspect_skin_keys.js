import { getPublicCatalog } from '../src/api/kirka.js';
import { getBoltPriceMap } from '../src/api/boltPrices.js';

async function run() {
  try {
    const catalog = await getPublicCatalog();
    const priceMap = await getBoltPriceMap();

    // Inspect first 3 catalog items
    console.log('--- CATALOG ITEMS ---');
    console.log(JSON.stringify(catalog.slice(0, 3), null, 2));

    // Inspect a few price map entries
    console.log('--- PRICE MAP ENTRIES ---');
    const keys = Object.keys(priceMap);
    console.log(`Total price map keys: ${keys.length}`);
    for (let i = 0; i < Math.min(keys.length, 3); i++) {
      console.log(keys[i], ':', JSON.stringify(priceMap[keys[i]], null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
