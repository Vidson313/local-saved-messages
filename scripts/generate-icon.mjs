import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateIcon() {
  const buildDir = path.join(process.cwd(), 'build');
  await fs.mkdir(buildDir, { recursive: true });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2AABEE" />
        <stop offset="100%" stop-color="#229ED9" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="60" fill="url(#grad)" />
    <!-- Telegram Saved Messages Bookmark Icon -->
    <path d="M78 52 C70 52 64 58 64 66 L64 204 C64 211 72 215 78 211 L128 174 L178 211 C184 215 192 211 192 204 L192 66 C192 58 186 52 178 52 Z" fill="#FFFFFF" />
  </svg>`;

  const png256 = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  await fs.writeFile(path.join(buildDir, 'icon.png'), png256);

  // Standard Windows ICO header for 256x256 PNG container
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // count: 1 image

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(0, 0);   // width 256 (0 = 256)
  icoEntry.writeUInt8(0, 1);   // height 256 (0 = 256)
  icoEntry.writeUInt8(0, 2);   // color palette
  icoEntry.writeUInt8(0, 3);   // reserved
  icoEntry.writeUInt16LE(1, 4); // color planes
  icoEntry.writeUInt16LE(32, 6); // bits per pixel
  icoEntry.writeUInt32LE(png256.length, 8); // size of image data
  icoEntry.writeUInt32LE(22, 12); // offset of image data (6 header + 16 entry = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoEntry, png256]);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('✓ Generated build/icon.png and build/icon.ico successfully.');
}

generateIcon().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
