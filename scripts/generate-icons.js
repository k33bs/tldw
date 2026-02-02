// Simple script to generate extension icons
// Run with: node scripts/generate-icons.js

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'assets', 'icons');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background (YouTube red)
  ctx.fillStyle = '#CC0000';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // Play button triangle
  ctx.fillStyle = '#FFFFFF';
  const centerX = size / 2;
  const centerY = size / 2;
  const triangleSize = size * 0.35;

  ctx.beginPath();
  ctx.moveTo(centerX - triangleSize * 0.4, centerY - triangleSize * 0.5);
  ctx.lineTo(centerX - triangleSize * 0.4, centerY + triangleSize * 0.5);
  ctx.lineTo(centerX + triangleSize * 0.6, centerY);
  ctx.closePath();
  ctx.fill();

  // Summary lines (bullet points)
  ctx.fillStyle = '#FFFFFF';
  const lineWidth = size * 0.03;
  const lineHeight = size * 0.08;
  const startX = centerX + triangleSize * 0.15;
  const startY = centerY + triangleSize * 0.7;

  for (let i = 0; i < 3; i++) {
    const y = startY + i * (lineHeight + size * 0.03);
    ctx.fillRect(startX - size * 0.2, y, size * 0.4 - i * size * 0.08, lineWidth);
  }

  return canvas.toBuffer('image/png');
}

// Ensure directory exists
mkdirSync(iconsDir, { recursive: true });

// Generate icons
const sizes = [16, 48, 128];
for (const size of sizes) {
  const buffer = generateIcon(size);
  writeFileSync(join(iconsDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png`);
}

console.log('Icons generated successfully!');
