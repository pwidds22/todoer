import sharp from 'sharp';
import { mkdir } from 'fs/promises';

await mkdir('resources', { recursive: true });

const SIZE = 1024;
const SPLASH_SIZE = 2732;
const PURPLE = '#7c3aed';
const BG_DARK = '#0a0a0a';

// Create the icon SVG (purple rounded rect with checkmark)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="102.4" fill="${PURPLE}"/>
  <path d="M148 262 l60 60 l156 -156" fill="none" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Generate icon-only.png (1024x1024)
await sharp(Buffer.from(iconSvg))
  .resize(SIZE, SIZE)
  .png()
  .toFile('resources/icon-only.png');
console.log('icon-only.png generated');

// Generate icon-foreground.png (checkmark on transparent bg, with padding)
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <path d="M148 262 l60 60 l156 -156" fill="none" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

await sharp(Buffer.from(foregroundSvg))
  .resize(SIZE, SIZE)
  .png()
  .toFile('resources/icon-foreground.png');
console.log('icon-foreground.png generated');

// Generate icon-background.png (solid purple)
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${PURPLE}"/>
</svg>`;

await sharp(Buffer.from(bgSvg))
  .resize(SIZE, SIZE)
  .png()
  .toFile('resources/icon-background.png');
console.log('icon-background.png generated');

// Generate splash.png (dark background with centered icon)
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_SIZE}" height="${SPLASH_SIZE}">
  <rect width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="${BG_DARK}"/>
  <g transform="translate(${(SPLASH_SIZE - 400) / 2}, ${(SPLASH_SIZE - 400) / 2})">
    <rect width="400" height="400" rx="80" fill="${PURPLE}"/>
    <path d="M115 204 l47 47 l122 -122" fill="none" stroke="white" stroke-width="37" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

await sharp(Buffer.from(splashSvg))
  .resize(SPLASH_SIZE, SPLASH_SIZE)
  .png()
  .toFile('resources/splash.png');
console.log('splash.png generated');

// Generate splash-dark.png (same as splash for our dark app)
await sharp(Buffer.from(splashSvg))
  .resize(SPLASH_SIZE, SPLASH_SIZE)
  .png()
  .toFile('resources/splash-dark.png');
console.log('splash-dark.png generated');

console.log('\nAll assets generated in resources/');
