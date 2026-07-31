import fs from 'fs';
import { fetchUserProfile, fetchUserInventory } from './api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from './api/boltPrices.js';
import { renderProfileCard } from './canvas/profileCard.js';
import { renderInventoryGridPage } from './canvas/inventoryGrid.js';

async function runTest() {
  console.log('🧪 Starting diagnostic test for Kirka Discord Bot...');

  // 1. Test profile fetch using shortId FUYR7K (CrackedYOU)
  console.log('1️⃣ Fetching profile for CrackedYOU (ID: FUYR7K)...');
  const profile = await fetchUserProfile('FUYR7K');
  if (!profile) {
    console.error('❌ Profile fetch failed!');
    return;
  }
  console.log(`✅ Profile fetched: ${profile.name} (Lvl ${profile.level}, Kills: ${profile.stats?.kills}, Clan: ${profile.clan})`);

  // 2. Test inventory fetch & Bolt prices
  console.log('2️⃣ Fetching inventory & Bolt price sheet...');
  const [inventory, priceMap] = await Promise.all([
    fetchUserInventory(profile.id),
    getBoltPriceMap()
  ]);

  console.log(`✅ Inventory items: ${inventory.length}, Bolt price items: ${priceMap.size}`);

  let totalVal = 0;
  inventory.forEach(invItem => {
    const item = invItem.item || invItem;
    totalVal += getItemPrice(priceMap, item) * (invItem.amount || 1);
  });
  console.log(`💰 Total Valuation for ${profile.name}: ${formatValueLong(totalVal)}`);

  // 3. Test Canvas Profile Card
  console.log('3️⃣ Rendering Profile Card canvas...');
  const profileBuf = await renderProfileCard(profile);
  fs.writeFileSync('test-profile.png', profileBuf);
  console.log('✅ Generated test-profile.png successfully!');

  // 4. Test Canvas Inventory Grid
  console.log('4️⃣ Rendering Inventory Grid canvas...');
  const invBuf = await renderInventoryGridPage({
    items: inventory,
    pageItems: inventory.slice(0, 25),
    priceMap,
    pageIndex: 0,
    totalPages: Math.ceil(inventory.length / 25),
    username: profile.name
  });
  fs.writeFileSync('test-inventory.png', invBuf);
  console.log('✅ Generated test-inventory.png successfully!');

  console.log('🎉 ALL DIAGNOSTIC TESTS PASSED CLEANLY!');
}

runTest().catch(err => console.error('❌ Test failed with error:', err));
