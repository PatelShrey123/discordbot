import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Shrey%4013569@db.bxebfeyqchjukibgfeqs.supabase.co:5432/postgres';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

export async function runMigration() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/skin_owners?select=skin_id&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      console.log('✅ [Migration] skin_owners table verified via Supabase HTTPS REST API!');
      return;
    }
  } catch (err) {
    console.warn('[Migration] REST check note:', err.message);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigration();
}
