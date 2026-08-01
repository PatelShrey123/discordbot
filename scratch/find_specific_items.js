import dotenv from 'dotenv';
import { fetchUserProfile, fetchUserInventory } from '../src/api/kirka.js';

dotenv.config();

async function run() {
  const profile = await fetchUserProfile('FUYR7K');
  const inventory = await fetchUserInventory(profile.id);
  
  const targetNames = ['Arachne', 'CV01', 'Oblivion', 'Sketched', 'Ortus', 'Forbidden', 'Fallout'];
  
  console.log(`Checking ${targetNames.join(', ')} in FUYR7K's inventory...`);
  
  inventory.forEach(invItem => {
    const item = invItem.item || invItem;
    if (targetNames.some(name => item.name.toLowerCase().includes(name.toLowerCase()))) {
      console.log(`- Found: ${item.name} (${invItem.amount})`);
    }
  });
}

run().then(() => process.exit(0));
