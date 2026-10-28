const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  console.log('Running afterPack hook: copying complete standalone Next.js build...');
  const appOutDir = context.appOutDir;
  const standaloneSrc = path.join(__dirname, '..', '.next', 'standalone');
  const standaloneDest = path.join(appOutDir, 'resources', 'standalone');

  fs.mkdirSync(standaloneDest, { recursive: true });

  fs.cpSync(standaloneSrc, standaloneDest, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const normalized = src.replace(/\\/g, '/');
      // Exclude local uploaded files (preserve .gitkeep)
      if (normalized.includes('/public/uploads/') && !normalized.endsWith('.gitkeep')) {
        return false;
      }
      // Exclude test database files generated during local test runs
      if (normalized.includes('/data/test-atomic')) {
        return false;
      }
      return true;
    }
  });

  console.log('✓ Successfully copied complete standalone bundle to:', standaloneDest);
};
