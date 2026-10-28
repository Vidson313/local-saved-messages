import { promises as fs } from 'fs';
import path from 'path';
import assert from 'assert';

async function run() {
  console.log('Testing Electron asset preparation script...');
  const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicDest = path.join(standaloneDir, 'public');

  // Verify that required directories exist
  const staticStat = await fs.stat(staticDest);
  assert(staticStat.isDirectory(), '.next/standalone/.next/static must be a directory');

  const publicStat = await fs.stat(publicDest);
  assert(publicStat.isDirectory(), '.next/standalone/public must be a directory');

  console.log('✓ Asset preparation test passed.');
}

run().catch((err) => {
  console.error('✗ Asset preparation test failed:', err);
  process.exit(1);
});
