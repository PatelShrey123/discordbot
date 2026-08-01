import dotenv from 'dotenv';
import { fetchUserProfile, fetchUserInventory } from '../src/api/kirka.js';

dotenv.config();

async function run() {
  const profile = await fetchUserProfile('FUYR7K');
  const inventory = await fetchUserInventory(profile.id);
  
  const found = inventory.filter(invItem => {
    const item = invItem.item || invItem;
    return item.name.toLowerCase().includes('grayscale') || item.name.toLowerCase().includes('arachne');
  });

  console.log(`Found matching items: ${found.length}`);
  found.forEach(f => {
    console.log(`- ${f.item.name}: ${f.amount}`);
  });
}

run().then(() => process.exit(0));
