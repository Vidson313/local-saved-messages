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
    dereference: true
  });

  console.log('✓ Successfully copied complete standalone bundle including all node_modules to:', standaloneDest);
};
