#!/usr/bin/env node
/**
 * Replaces Capacitor default splash PNGs with the provided iKhwezi mark on #030014.
 * Run: node scripts/generate-native-splash.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO = join(ROOT, 'src', 'assets', 'branding', 'ikhwezi-logo.png');
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

const ANDROID_SPLASHES = {
  'drawable/splash.png': [480, 320],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
};

async function renderSplash(width, height) {
  const logoMax = Math.round(Math.min(width, height) * 0.58);
  const logo = await sharp(LOGO)
    .resize(logoMax, logoMax, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.max(0, Math.round((width - meta.width) / 2));
  const top = Math.max(0, Math.round((height - meta.height) / 2) - Math.round(height * 0.02));

  return sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

async function writePng(buffer, path) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buffer).toFile(path);
}

async function main() {
  const androidRes = join(ROOT, 'android', 'app', 'src', 'main', 'res');

  for (const [rel, [w, h]] of Object.entries(ANDROID_SPLASHES)) {
    const out = join(androidRes, rel);
    const buf = await renderSplash(w, h);
    await writePng(buf, out);
    console.log(`✓ ${rel} (${w}x${h})`);
  }

  const iosSplash = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
  const iosBuf = await renderSplash(2732, 2732);
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await writePng(iosBuf, join(iosSplash, name));
    console.log(`✓ ios/${name}`);
  }

  console.log('✅ Native splash screens updated from src/assets/branding/ikhwezi-logo.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
