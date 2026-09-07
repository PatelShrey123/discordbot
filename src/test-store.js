import { getParsedStore } from './api/store.js';
import { buildStoreEmbed } from './commands/store.js';
import { subscribeUser, isUserSubscribed, unsubscribeUser, getSubscriptions } from './utils/storeNotifier.js';

async function runStoreTests() {
  console.log('🧪 Running Kirka Store & Drop Notification verification tests...\n');

  // 1. Test live API parsing
  console.log('1️⃣ Fetching and parsing live Kirka Store data...');
  const store = await getParsedStore();
  console.log(`✅ Limited drops found: ${store.limitedDrops.length}`);
  store.limitedDrops.forEach(d => {
    console.log(`   • ${d.name} (${d.weapon}): ${d.remainingUnits}/${d.totalUnits} left — ${d.priceDiamonds} 💎 (Render: ${d.renderUrl ? 'OK' : 'MISSING'})`);
  });

  if (store.featuredSet) {
    console.log(`✅ Featured set found: "${store.featuredSet.name}" (${store.featuredSet.items.length} items, ${store.featuredSet.priceDiamonds} 💎)`);
  }

  console.log(`✅ Daily shop items: ${store.dailyShop.length}`);
  console.log(`✅ Active themed bundles: ${store.activeBundles.length}`);

  // Assertions
  if (store.limitedDrops.length === 0) {
    throw new Error('Expected at least 1 limited drop in live store!');
  }
  const capy = store.limitedDrops.find(d => d.name.toLowerCase().includes('capy'));
  if (capy) {
    console.log(`✅ Verified Capy limited edition: ${capy.remainingUnits}/${capy.totalUnits} units left.`);
  }

  // 2. Test Discord Embed Generation
  console.log('\n2️⃣ Testing Discord Embed Generation...');
  const embed = buildStoreEmbed(store, 'all');
  console.log(`✅ Embed Title: "${embed.data.title}"`);
  console.log(`✅ Embed Fields count: ${embed.data.fields?.length}`);
  console.log(`✅ Embed Image URL: ${embed.data.image?.url || 'None'}`);

  // 3. Test Subscription System
  console.log('\n3️⃣ Testing Store Subscription Manager...');
  const testUserId = 'test_user_12345';
  const testChannelId = 'test_channel_67890';

  // Clear any existing test sub
  unsubscribeUser(testUserId);
  console.log(`   Initial isSubbed: ${isUserSubscribed(testUserId)} (expected false)`);

  // Subscribe
  const subResult = subscribeUser(testUserId, testChannelId, 'guild_1');
  console.log(`   After subscribe isSubbed: ${isUserSubscribed(testUserId)} (isNew: ${subResult.isNew})`);

  if (!isUserSubscribed(testUserId)) {
    throw new Error('User should be subscribed!');
  }

  // Unsubscribe
  const unsubResult = unsubscribeUser(testUserId);
  console.log(`   After unsubscribe isSubbed: ${isUserSubscribed(testUserId)} (removed: ${unsubResult.removed})`);

  if (isUserSubscribed(testUserId)) {
    throw new Error('User should be unsubscribed!');
  }

  console.log('\n🎉 ALL STORE & NOTIFIER TESTS PASSED CLEANLY!');
}

runStoreTests().catch(err => {
  console.error('❌ Store Test Failed:', err);
  process.exit(1);
});
