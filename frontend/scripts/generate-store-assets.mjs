#!/usr/bin/env node
/**
 * Generates store icons and screenshot templates from the create-button constellation design.
 * Run: node scripts/generate-store-assets.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'store-listing');

function starPath(cx, cy, outerR, innerRatio = 0.36, points = 4, rotDeg = 0) {
  const innerR = outerR * innerRatio;
  const step = Math.PI / points;
  const rot = (rotDeg * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * step + rot;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/** Static create-button icon — glossy brown-gold + three-star constellation. */
function buildAppIconSvg(size = 1024) {
  const pad = size * 0.1;
  const btn = size - pad * 2;
  const x = pad;
  const y = pad;
  const rx = btn * (20 / 52);
  const cx = size / 2;
  const s = (btn * 0.72) / 56;

  const dawn = starPath(28, 17, 10.2, 0.3, 8, 0);
  const west = starPath(12, 36, 7.4, 0.38, 5, -32);
  const east = starPath(44.5, 33.5, 7.4, 0.38, 5, 32);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="btn" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b8892a"/>
      <stop offset="24%" stop-color="#7a5520"/>
      <stop offset="58%" stop-color="#4a3216"/>
      <stop offset="100%" stop-color="#2a1f0f"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="star" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#f5c542"/>
      <stop offset="100%" stop-color="#8b6914"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f5c542" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f5c542" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="thread" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5c542" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#fff8dc" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#ff8fab" stop-opacity="0.35"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" fill="#030014"/>
  <circle cx="${cx}" cy="${cx}" r="${btn * 0.55}" fill="url(#glow)" opacity="0.6"/>

  <rect x="${x}" y="${y}" width="${btn}" height="${btn}" rx="${rx}" fill="url(#btn)"/>
  <rect x="${x}" y="${y}" width="${btn}" height="${btn}" rx="${rx}" fill="none" stroke="#d4af37" stroke-opacity="0.55" stroke-width="${size * 0.004}"/>
  <rect x="${x + btn * 0.08}" y="${y + btn * 0.05}" width="${btn * 0.84}" height="${btn * 0.38}" rx="${rx * 0.7}" fill="url(#gloss)"/>
  <ellipse cx="${cx}" cy="${y + btn * 0.88}" rx="${btn * 0.32}" ry="${btn * 0.06}" fill="#f5c542" fill-opacity="0.28"/>

  <g transform="translate(${cx} ${cx}) scale(${s}) translate(-28 -28)">
    <path d="M 12 36 Q 28 44 44.5 33.5" stroke="url(#thread)" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M 12 36 Q 18 44 28 17 Q 39 42 44.5 33.5" stroke="url(#thread)" stroke-width="0.75" fill="none" stroke-linecap="round" opacity="0.65"/>
    <path d="${west}" fill="url(#star)" filter="url(#soft)"/>
    <path d="${east}" fill="url(#star)" filter="url(#soft)"/>
    <g transform="scale(1 1.18) translate(0 -2.8)">
      <path d="${dawn}" fill="url(#star)" filter="url(#soft)"/>
      <circle cx="28" cy="17" r="2" fill="#ffffff" opacity="0.95"/>
    </g>
    <circle cx="12" cy="36" r="1.1" fill="#ffffff" opacity="0.9"/>
    <circle cx="44.5" cy="33.5" r="1.1" fill="#ffffff" opacity="0.9"/>
  </g>
</svg>`;
}

function buildFeatureGraphicSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030014"/>
      <stop offset="50%" stop-color="#1a1208"/>
      <stop offset="100%" stop-color="#030014"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <text x="512" y="200" text-anchor="middle" font-family="Syne, Arial Black, sans-serif" font-size="72" font-weight="800" fill="#f5c542" letter-spacing="6">iKHWEZI</text>
  <text x="512" y="260" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.65)">Stream the night · Shine the signal</text>
  <text x="512" y="420" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="rgba(245,197,66,0.5)">Ultima Supreme Edition</text>
</svg>`;
}

function buildScreenshotSvg(title, subtitle, index) {
  const accents = ['#f5c542', '#e1306c', '#f5c542'];
  const accent = accents[index % accents.length];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#030014"/>
      <stop offset="100%" stop-color="#0d0818"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a1f0f"/>
      <stop offset="100%" stop-color="#4a3216"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="60" y="120" width="960" height="200" rx="40" fill="rgba(255,255,255,0.04)" stroke="rgba(245,197,66,0.2)" stroke-width="2"/>
  <text x="100" y="210" font-family="Syne, Arial Black, sans-serif" font-size="48" font-weight="800" fill="#ffffff">iKHWEZI</text>
  <text x="100" y="265" font-family="Inter, Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.45)">Shine the signal</text>
  <rect x="60" y="380" width="960" height="1100" rx="48" fill="url(#card)" stroke="rgba(212,175,55,0.35)" stroke-width="3"/>
  <rect x="100" y="420" width="880" height="520" rx="36" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.08)"/>
  <text x="540" y="720" text-anchor="middle" font-family="Syne, Arial, sans-serif" font-size="42" font-weight="700" fill="${accent}">${title}</text>
  <text x="540" y="780" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.55)">${subtitle}</text>
  <rect x="100" y="980" width="280" height="420" rx="28" fill="rgba(0,0,0,0.25)" stroke="rgba(245,197,66,0.25)"/>
  <rect x="400" y="980" width="280" height="420" rx="28" fill="rgba(0,0,0,0.25)" stroke="rgba(245,197,66,0.25)"/>
  <rect x="700" y="980" width="280" height="420" rx="28" fill="rgba(0,0,0,0.25)" stroke="rgba(245,197,66,0.25)"/>
  <text x="240" y="1200" text-anchor="middle" font-size="80" fill="#f5c542">✦</text>
  <text x="540" y="1200" text-anchor="middle" font-size="80" fill="#f5c542">✦</text>
  <text x="840" y="1200" text-anchor="middle" font-size="80" fill="#f5c542">✦</text>
  <rect x="60" y="1680" width="960" height="120" rx="60" fill="rgba(245,197,66,0.12)" stroke="rgba(245,197,66,0.35)"/>
  <text x="540" y="1755" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="#f5c542">Premium black and gold experience</text>
</svg>`;
}

async function rasterize(svg, width, height, flatten = false) {
  let pipeline = sharp(Buffer.from(svg)).resize(width, height);
  if (flatten) {
    pipeline = pipeline.flatten({ background: '#030014' });
  }
  return pipeline.png().toBuffer();
}

async function writePng(buffer, path) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buffer).toFile(path);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'play-phone-screenshots'), { recursive: true });
  mkdirSync(join(OUT, 'ios-screenshots'), { recursive: true });

  const iconSvg = buildAppIconSvg(1024);
  writeFileSync(join(OUT, 'app-icon-master.svg'), iconSvg);

  let icon1024;
  try {
    icon1024 = await rasterize(iconSvg, 1024, 1024, true);
  } catch (err) {
    writeFileSync(join(OUT, 'debug-icon.svg'), iconSvg);
    throw err;
  }
  const icon512 = await sharp(icon1024).resize(512, 512).png().toBuffer();

  await writePng(icon512, join(OUT, 'play-icon-512.png'));
  await writePng(icon1024, join(OUT, 'ios-app-icon-1024.png'));

  const featureSvg = buildFeatureGraphicSvg();
  await writePng(await rasterize(featureSvg, 1024, 500), join(OUT, 'play-feature-graphic.png'));

  const screenshots = [
    ['Live Community Feed', 'Discover trending videos and stories'],
    ['Go Live', 'Watch streams in real time'],
    ['Create and Share', 'Stories, reels, and constellation'],
  ];

  for (let i = 0; i < screenshots.length; i += 1) {
    const [title, sub] = screenshots[i];
    const svg = buildScreenshotSvg(title, sub, i);
    const png = await rasterize(svg, 1080, 1920);
    const name = `screenshot-${i + 1}.png`;
    await writePng(png, join(OUT, 'play-phone-screenshots', name));
    await writePng(png, join(OUT, 'ios-screenshots', name));
  }

  const androidSizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };

  const androidRes = join(ROOT, 'android', 'app', 'src', 'main', 'res');
  for (const [folder, px] of Object.entries(androidSizes)) {
    const buf = await sharp(icon1024).resize(px, px, { fit: 'cover' }).png().toBuffer();
    await writePng(buf, join(androidRes, folder, 'ic_launcher.png'));
    await writePng(buf, join(androidRes, folder, 'ic_launcher_round.png'));
  }

  const fg432 = await sharp(icon1024).resize(432, 432, { fit: 'cover' }).png().toBuffer();
  for (const folder of Object.keys(androidSizes)) {
    await writePng(fg432, join(androidRes, folder, 'ic_launcher_foreground.png'));
  }

  writeFileSync(
    join(androidRes, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#030014</color>\n</resources>\n`
  );

  const iosIconDir = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  await writePng(icon1024, join(iosIconDir, 'AppIcon-512@2x.png'));

  console.log('✅ Store assets generated in frontend/store-listing/');
  console.log('   play-icon-512.png, ios-app-icon-1024.png, play-feature-graphic.png');
  console.log('   play-phone-screenshots/ + ios-screenshots/ (3 each)');
  console.log('   Android + iOS launcher icons updated');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
