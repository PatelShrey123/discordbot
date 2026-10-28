import { getBoltPriceMap, getLastPriceSource, formatValueShort } from '../src/api/boltPrices.js';

async function test() {
  console.log('Testing getBoltPriceMap()...');
  const map = await getBoltPriceMap();
  console.log('Price map size:', map.size);
  console.log('Source:', getLastPriceSource());
  const sample1 = map.get('1337_shark');
  console.log('1337_shark:', sample1);
  const sample2 = map.get('2025 bayonet_bayonet');
  console.log('2025 bayonet_bayonet:', sample2);
}

test();
