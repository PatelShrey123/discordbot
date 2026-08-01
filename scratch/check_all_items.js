import dotenv from 'dotenv';
import { fetchUserProfile, fetchUserInventory } from '../src/api/kirka.js';
import { getBoltPriceMap, getItemPrice } from '../src/api/boltPrices.js';

dotenv.config();

async function run() {
  const profile = await fetchUserProfile('FUYR7K');
  const inventory = await fetchUserInventory(profile.id);
  const priceMap = await getBoltPriceMap();

  console.log(`Player: ${profile.name} (ID: ${profile.id})`);
  
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

  console.log(`Total sorted items: ${sortedInventory.length}`);
  sortedInventory.forEach((invItem, idx) => {
    const item = invItem.item || invItem;
    const price = getItemPrice(priceMap, item);
    console.log(`${idx + 1}. Name: ${item.name}, Price: ${price}, Rarity: ${item.rarity}, Qty: ${invItem.amount}`);
  });
}

run().then(() => process.exit(0));
