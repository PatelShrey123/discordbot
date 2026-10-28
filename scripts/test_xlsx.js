import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('C:/Users/Shrey/.gemini/antigravity/scratch/bliss_price_list.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: ['A', 'B', 'C', 'D', 'E'] });

console.log('Total rows parsed with xlsx:', rows.length);
console.log('Sample row 0:', rows[0]);
console.log('Sample row 1:', rows[1]);
console.log('Sample row 5:', rows[5]);
