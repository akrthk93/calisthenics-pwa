// Renders public/icon.svg to the PNG icons the PWA manifest and iOS need.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
const opaque = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));

await sharp(svg, { density: 384 }).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile('public/icon-512.png');
// iOS adds its own rounded mask and needs an opaque square.
await sharp(opaque, { density: 384 }).resize(180, 180).flatten({ background: '#121412' }).png().toFile('public/apple-touch-icon.png');
console.log('icons rendered');
