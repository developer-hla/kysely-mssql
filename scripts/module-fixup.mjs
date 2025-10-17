/**
 * Post-build script to add package.json files to dist folders.
 *
 * - dist/cjs/ needs package.json with "type": "commonjs" (explicit CJS)
 * - dist/esm/ needs package.json with "type": "module" (explicit ESM)
 *
 * This ensures Node.js interprets the files correctly based on their location.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Add type: "commonjs" to dist/cjs
writeFileSync(
  join(rootDir, 'dist', 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs', sideEffects: false }, null, 2)
);

// Add type: "module" to dist/esm
writeFileSync(
  join(rootDir, 'dist', 'esm', 'package.json'),
  JSON.stringify({ type: 'module', sideEffects: false }, null, 2)
);

console.log('✓ Added package.json files to dist/cjs and dist/esm');
