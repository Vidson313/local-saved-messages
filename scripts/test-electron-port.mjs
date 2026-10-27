import assert from 'assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findFreePort } = require('../electron/port.cjs');

async function testPort() {
  console.log('Testing dynamic port allocation...');
  const port = await findFreePort(3000);
  assert(typeof port === 'number' && port >= 1024 && port <= 65535, 'Port must be a valid number');
  console.log(`✓ Port allocation returned valid port: ${port}`);
}

testPort().catch((err) => {
  console.error('✗ Port allocation test failed:', err);
  process.exit(1);
});
