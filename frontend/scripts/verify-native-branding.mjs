#!/usr/bin/env node
/**
 * Fails the build if old Capacitor splash/logo assets or references remain.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const LOGO = join(SRC, 'assets', 'branding', 'ikhwezi-logo.png');
const OLD_MARK = join(SRC, 'assets', 'branding', 'ikhwezi-mark.png');

const FORBIDDEN = [
  'ikhwezi-mark.png',
  'ikhwezi-mark-',
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

function scanSourceForForbidden() {
  const hits = [];
  for (const file of walk(SRC)) {
    if (!/\.(jsx?|css|mjs|json|html)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const token of FORBIDDEN) {
      if (text.includes(token)) {
        hits.push(`${relative(ROOT, file)} → "${token}"`);
      }
    }
  }
  return hits;
}

async function assertSplashIsDarkWithLogo(relPath) {
  const full = join(ANDROID_RES, relPath);
  if (!existsSync(full)) throw new Error(`Missing splash asset: ${relPath}`);

  const { data, info } = await sharp(full)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const corner = (data[0] + data[1] + data[2]) / 3;
  if (corner > 40) {
    throw new Error(`${relPath} corner looks white/bright (${corner.toFixed(0)}) — old Capacitor splash?`);
  }

  // Logo is centered; sample a band around vertical center for gold/tan pixels.
  const y0 = Math.floor(info.height * 0.38);
  const y1 = Math.floor(info.height * 0.62);
  const x0 = Math.floor(info.width * 0.25);
  const x1 = Math.floor(info.width * 0.75);
  let brightPixels = 0;
  let samples = 0;

  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = (r + g + b) / 3;
      samples += 1;
      if (lum > 90 && r >= g && g >= b) brightPixels += 1;
    }
  }

  const goldRatio = brightPixels / samples;
  if (goldRatio < 0.02) {
    throw new Error(`${relPath} has no gold logo pixels in center band — logo missing?`);
  }
}

async function main() {
  const errors = [];

  if (!existsSync(LOGO)) errors.push('Missing src/assets/branding/ikhwezi-logo.png');
  if (existsSync(OLD_MARK)) errors.push('Old file still exists: src/assets/branding/ikhwezi-mark.png');

  const sourceHits = scanSourceForForbidden();
  if (sourceHits.length) {
    errors.push('Forbidden old-logo references in source:');
    errors.push(...sourceHits.map((h) => `  - ${h}`));
  }

  const splashChecks = [
    'drawable/splash.png',
    'drawable-port-xxhdpi/splash.png',
    'drawable-port-xxxhdpi/splash.png',
    'drawable-land-xxhdpi/splash.png',
  ];

  for (const rel of splashChecks) {
    try {
      await assertSplashIsDarkWithLogo(rel);
    } catch (err) {
      errors.push(err.message);
    }
  }

  const logoStat = existsSync(LOGO) ? statSync(LOGO) : null;
  if (logoStat && logoStat.size < 5000) {
    errors.push('ikhwezi-logo.png looks too small — may be corrupt');
  }

  if (errors.length) {
    console.error('❌ Native branding verification FAILED:\n');
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  console.log('✅ Native branding verified: only ikhwezi-logo.png, dark splashes, no old mark references');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
