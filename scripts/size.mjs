// Prints the raw and gzipped size of the widget bundle and fails above the 30 KB budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 30 * 1024;
const code = readFileSync(new URL('../dist/concierge.js', import.meta.url));
const gz = gzipSync(code, { level: 9 }).length;
console.warn(`concierge.js: ${(code.length / 1024).toFixed(2)} KB raw, ${(gz / 1024).toFixed(2)} KB gzipped (budget 30 KB)`);
if (gz > BUDGET) process.exit(1);
