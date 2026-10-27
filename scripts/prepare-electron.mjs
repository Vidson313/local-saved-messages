import { promises as fs } from 'fs';
import path from 'path';

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function prepare() {
  const root = process.cwd();
  const standaloneDir = path.join(root, '.next', 'standalone');
  const staticSrc = path.join(root, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicSrc = path.join(root, 'public');
  const publicDest = path.join(standaloneDir, 'public');

  console.log('Preparing standalone assets for Electron packaging...');

  try {
    await copyDir(staticSrc, staticDest);
    console.log('✓ Copied .next/static to standalone build');
  } catch (err) {
    console.error('Error copying .next/static:', err);
    throw err;
  }

  try {
    await copyDir(publicSrc, publicDest);
    console.log('✓ Copied public/ to standalone build');
  } catch (err) {
    console.error('Error copying public/:', err);
    throw err;
  }

  console.log('✓ Standalone Electron asset preparation complete.');
}

prepare().catch((err) => {
  console.error('Preparation failed:', err);
  process.exit(1);
});
