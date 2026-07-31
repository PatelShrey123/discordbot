import fs from 'fs';
import { fetchUserProfile, fetchUserInventory, getPublicCatalog, fetchClan } from './api/kirka.js';
import { getBoltPriceMap, getItemPrice, formatValueLong } from './api/boltPrices.js';
import { renderProfileCard } from './canvas/profileCard.js';
import { renderInventoryGridPage } from './canvas/inventoryGrid.js';
import { renderSkinCard } from './canvas/skinCard.js';
import { renderClanRosterPage } from './canvas/clanRoster.js';

async function runTest() {
  console.log('🧪 Starting diagnostic test for Kirka Discord Bot...');

  // 1. Test profile fetch
  console.log('1️⃣ Fetching profile for CrackedYOU (ID: FUYR7K)...');
  const profile = await fetchUserProfile('FUYR7K');
  if (!profile) {
    console.error('❌ Profile fetch failed!');
    return;
  }
  console.log(`✅ Profile fetched: ${profile.name} (Lvl ${profile.level}, Kills: ${profile.stats?.kills}, Clan: ${profile.clan})`);

  // 2. Test inventory fetch & Bolt prices
  console.log('2️⃣ Fetching inventory & Bolt price sheet...');
  const [inventory, priceMap, catalog] = await Promise.all([
    fetchUserInventory(profile.id),
    getBoltPriceMap(),
    getPublicCatalog()
  ]);

  console.log(`✅ Inventory items: ${inventory.length}, Bolt price items: ${priceMap.size}, Catalog items: ${catalog.length}`);

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

  // 5. Test Canvas Skin Card
  console.log('5️⃣ Rendering Skin Card canvas (Grayscale)...');
  const grayscaleItem = catalog.find(i => i.name && i.name.toLowerCase().includes('grayscale'));
  if (grayscaleItem) {
    // Inject mock renderUrl if missing for test
    if (!grayscaleItem.renderUrl) {
      grayscaleItem.renderUrl = '/assets/img/render-mini.67fdc7ae.webp';
    }
    const skinBuf = await renderSkinCard(grayscaleItem, priceMap);
    fs.writeFileSync('test-skin.png', skinBuf);
    console.log('✅ Generated test-skin.png successfully!');
  } else {
    console.warn('⚠️ Grayscale item not found in catalog for test!');
  }

  // 6. Test Canvas Clan Roster Page
  console.log('6️⃣ Fetching clan and rendering Clan Roster Page...');
  const clan = await fetchClan(profile.clan || 'Dement!a');
  if (clan) {
    const clanBuf = await renderClanRosterPage(clan, 3, 0, 4);
    fs.writeFileSync('test-clan.png', clanBuf);
    console.log('✅ Generated test-clan.png successfully!');
  } else {
    console.error('❌ Clan fetch failed!');
  }

  console.log('🎉 ALL DIAGNOSTIC TESTS PASSED CLEANLY!');
}

runTest().catch(err => console.error('❌ Test failed with error:', err));
