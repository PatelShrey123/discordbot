import dotenv from 'dotenv';
import { fetchUserProfile, fetchUserInventory } from '../src/api/kirka.js';

dotenv.config();

async function run() {
  const profile = await fetchUserProfile('FUYR7K');
  if (!profile) {
    console.error('Player not found!');
    process.exit(1);
  }
  console.log(`Player: ${profile.name} (ID: ${profile.id})`);
  const inventory = await fetchUserInventory(profile.id);
  console.log(`Inventory count: ${inventory.length}`);
  inventory.slice(0, 10).forEach(invItem => {
    const item = invItem.item || invItem;
    console.log(`- Name: ${item.name}, Rarity: ${item.rarity}, Amount: ${invItem.amount}`);
  });
}

run().then(() => process.exit(0));
