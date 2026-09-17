'use strict';

/**
 * seed-demo.js — "Netball Central" demo dataset for iKHWEZI (local Docker only).
 *
 * Run INSIDE the backend container:
 *
 *   docker compose exec backend node seed-demo.js            # first seed / no-op if present
 *   docker compose exec backend node seed-demo.js --refresh  # delete + regenerate demo rows/files
 *
 * What it does
 * ------------
 *  1. Connects with the backend's own connection factory (./config/database)
 *     so it uses the exact DATABASE_URL the running backend uses (Postgres
 *     locally). No credentials hardcoded, no sqlite fallback path used when
 *     DATABASE_URL is present — identical behaviour to backend/index.js.
 *  2. Generates ALL media locally with ffmpeg (spawnSync) into
 *     storage/uploads/<uuid>.<ext> — the same directory the backend serves
 *     at /storage/uploads/<file>. Nothing is downloaded; everything is
 *     original, generated art in a black-South-African-youth netball theme
 *     (green court / gold / orange palette, court rings, goal-circle motifs).
 *  3. Seeds idempotently:
 *     - 4 demo accounts (bcrypt-hashed passwords, Points + Wallet rows like
 *       the real register route creates),
 *     - 8 short portrait videos (720x1280, H.264 yuv420p + faststart, silent
 *       AAC track) owned across the accounts, with probed durations,
 *       realistic view counts, one isTrending, all isSponsored=false,
 *     - a matching 720x1280 thumbnail per video,
 *     - 5 avatars (4 users + 1 group),
 *     - 3 story images (1080x1920) for the Stories feature,
 *     - comments, likes and follows between the demo users,
 *     - a "Netball Central — SA Youth" group with all demo users as members
 *       and a handful of themed chat messages.
 *
 * Idempotency / refresh safety
 * ----------------------------
 *  - If the demo users exist AND own videos, the script prints "already
 *    seeded" and exits 0 without touching anything.
 *  - --refresh deletes ONLY demo-owned rows: videos whose description carries
 *    the demo marker ("Netball Central demo"), stories with the marker, the
 *    demo group, comments/likes attached to demo videos, and the exact media
 *    files referenced by those rows (plus the demo users' avatars). Real user
 *    uploads are never scanned for deletion — filenames are taken from the
 *    deleted rows only.
 *
 * Fonts
 * -----
 *  The container image has no fonts. The operator copies a Windows font into
 *  the (volume-persisted) storage/fonts directory, e.g. from the host:
 *
 *    docker cp C:\Windows\Fonts\impact.ttf  ikhwezi-backend:/app/storage/fonts/impact.ttf
 *    docker cp C:\Windows\Fonts\arialbd.ttf ikhwezi-backend:/app/storage/fonts/arialbd.ttf
 *
 *  The script probes drawtext with a tiny render at startup; if fonts are
 *  missing/unusable it falls back to abstract geometric posters (gradients,
 *  court rings, drawbox panels) with no text — still on-theme, never crashes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const bcrypt = require('bcryptjs');
const { DataTypes, Op } = require('sequelize');

const { createSequelize } = require('./config/database');
const { defineCoreModels } = require('./models');
const { buildGroupModels } = require('./groups/models');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_MARKER = 'Netball Central demo';
const DEMO_PASSWORD = 'Demo1234!';

const FONT_HEAVY = path.join(__dirname, 'storage', 'fonts', 'impact.ttf');
const FONT_BODY = path.join(__dirname, 'storage', 'fonts', 'arialbd.ttf');

const UPLOADS_DIR = path.join(__dirname, 'storage', 'uploads');

// SA netball palette — court green, gold, orange (Proteas colours).
const GOLD = '0xF5C542';
const ORANGE = '0xF07818';
const GREEN_DARK = '0x06301e';
const GREEN_MID = '0x0b4f30';
const GREEN_DEEP = '0x062c40';
const MINT = '0xd9ffe9';

const DEMO_USERS = [
  {
    username: 'netball.demo',
    email: 'demo@ikhwezi.site',
    displayName: 'Netball Central SA',
    bio: 'Home of black South African youth netball. Soweto • Cape Town • Gauteng leagues, drills and matchday streams. Netball Central demo account.',
    initials: 'NC',
    palette: ['gold', 'green'],
  },
  {
    username: 'coach.dlamini',
    email: 'coach.dlamini@demo.ikhwezi.site',
    displayName: 'Coach Sipho Dlamini',
    bio: 'Head coach — Soweto youth league. Circle-edge feeds, centre-pass set plays, footwork drills. Practices at Owen Park courts.',
    initials: 'CD',
    palette: ['green', 'gold'],
  },
  {
    username: 'shooter.thandi',
    email: 'shooter.thandi@demo.ikhwezi.site',
    displayName: 'Thandi M.',
    bio: 'GS for Soweto United U21. Ring work is my love language. Cape Town mixed league finalist.',
    initials: 'TM',
    palette: ['orange', 'green'],
  },
  {
    username: 'centre.pass',
    email: 'centre.pass@demo.ikhwezi.site',
    displayName: 'Lerato K. • C',
    bio: 'Centre court playmaker, Gauteng U19 trials hopeful. Feed the circle, trust the shot.',
    initials: 'LK',
    palette: ['green', 'orange'],
  },
];

// Feed videos: 720x1280 portrait shorts. durationSec is kept in the 8–12s
// band so files stay small (CRF 28). "trending" flags exactly one video.
const DEMO_VIDEOS = [
  {
    title: 'U19 Trials — Gauteng',
    theme: 'U19 TRIALS GAUTENG',
    score: 'GP 24 - 19 KZN',
    quarter: 'Q2',
    durationSec: 11,
    views: 412,
    owner: 'coach.dlamini',
    description: 'Selection court at U19 trials — Gauteng vs KZN scratch match, second quarter burn. Bibs up, speed on.',
    trending: false,
  },
  {
    title: 'Shooting drill: circle-edge feeds',
    theme: 'CIRCLE EDGE FEEDS',
    score: 'GK 0 - GS 12',
    quarter: 'DRILL',
    durationSec: 9,
    views: 87,
    owner: 'coach.dlamini',
    description: 'Saturday shooting block: circle-edge feeds on the move, 40 makes before water. Bring your A-game.',
    trending: false,
  },
  {
    title: 'Soweto youth league highlights',
    theme: 'SOWETO LEAGUE',
    score: 'SOW 31 - 28 SOSH',
    quarter: 'FT',
    durationSec: 12,
    views: 876,
    owner: 'netball.demo',
    description: 'Round 9 wrap from the Wemmer Pan show court — Soweto vs Soshanguve, decided in the last sixty seconds.',
    trending: true,
  },
  {
    title: 'Defence footwork 101',
    theme: 'DEFENCE FOOTWORK',
    score: 'DEF 8 - ATT 3',
    quarter: 'DRILL',
    durationSec: 10,
    views: 233,
    owner: 'centre.pass',
    description: 'Shadow defending and the two-step landing, taught slow then full speed. No contact, all timing.',
    trending: false,
  },
  {
    title: 'Proteas watch party',
    theme: 'PROTEAS WATCH PARTY',
    score: 'RSA 45 - AUS 41',
    quarter: 'Q4',
    durationSec: 11,
    views: 641,
    owner: 'shooter.thandi',
    description: 'Floor was SHAKING when the final whistle went. Watch parties every international fixture — join the group.',
    trending: false,
  },
  {
    title: "Coach's clipboard: centre pass set plays",
    theme: 'CENTRE PASS SETS',
    score: 'C 1 - WA 2 - GA 3',
    quarter: 'SET',
    durationSec: 10,
    views: 154,
    owner: 'coach.dlamini',
    description: 'Whiteboard to court: three centre-pass rotations that beat a diving GK. Numbers, then names, then pace.',
    trending: false,
  },
  {
    title: 'Cape Town mixed league finals',
    theme: 'CT MIXED FINALS',
    score: 'CPT 27 - 25 STEL',
    quarter: 'Q4',
    durationSec: 12,
    views: 508,
    owner: 'centre.pass',
    description: 'Mixed league final at Athlone — one-goal game with ninety seconds on the clock. Ice in the veins stuff.',
    trending: false,
  },
  {
    title: 'Fitness Friday: netball HIIT',
    theme: 'NETBALL HIIT',
    score: 'ROUNDS 6 x 40s',
    quarter: 'HIIT',
    durationSec: 8,
    views: 96,
    owner: 'shooter.thandi',
    description: 'Six rounds, forty seconds: lateral shuffles, split jumps, sprints. Court fitness without the gym.',
    trending: false,
  },
];

// Story images (1080x1920) for the Stories feature — type 'image'.
const DEMO_STORIES = [
  {
    owner: 'netball.demo',
    line1: 'COURT NOTICE',
    line2: 'U19 TRIALS',
    line3: 'SUN 09:00',
    caption: `U19 Gauteng trials — Sunday 09:00, Wemmer Pan courts. Bibs and water provided. ${DEMO_MARKER} story.`,
  },
  {
    owner: 'shooter.thandi',
    line1: 'MATCH DAY',
    line2: 'CT FINALS',
    line3: 'LIVE 15:00',
    caption: `Cape Town mixed league finals — streaming live 15:00 from Athlone. ${DEMO_MARKER} story.`,
  },
  {
    owner: 'coach.dlamini',
    line1: 'TRAINING',
    line2: 'SHOOTING CLINIC',
    line3: 'SAT 08:00',
    caption: `Shooting circle clinic — Saturday 08:00, Owen Park courts. Bring your bibs. ${DEMO_MARKER} story.`,
  },
];

const GROUP_NAME = 'Netball Central — SA Youth';
const GROUP_MESSAGES = [
  { sender: 'coach.dlamini', content: 'Practice Saturday 08:00, Owen Park courts — bring bibs and water bottles, we run centre-pass sets first.' },
  { sender: 'shooter.thandi', content: "Who's streaming the finals? I'll set the watch party in the group if we get 10 people." },
  { sender: 'centre.pass', content: 'U19 trials squad list is up on the notice board — Lerato, Thandi and 9 more from our league made the cut.' },
  { sender: 'netball.demo', content: 'Highlights from the Soweto league semi are in the feed — that last-minute intercept deserves a slow-mo replay.' },
  { sender: 'coach.dlamini', content: 'Fitness Friday: HIIT circuit in the feed. Six rounds, no excuses, see you on the court.' },
];

const DEMO_COMMENTS = [
  { video: 'Soweto youth league highlights', by: 'shooter.thandi', content: 'That mid-court intercept was pure class — whole bench was on its feet!' },
  { video: 'Soweto youth league highlights', by: 'centre.pass', content: 'One-goal game until the last minute. This is why we play centre court.' },
  { video: 'Shooting drill: circle-edge feeds', by: 'centre.pass', content: 'Trying this at Thursday practice — thanks coach!' },
  { video: "Coach's clipboard: centre pass set plays", by: 'netball.demo', content: 'Rotation 2 broke our defence twice last season. Clipboard noted.' },
  { video: 'Fitness Friday: netball HIIT', by: 'coach.dlamini', content: 'Add this to your Monday warm-up, girls. Six rounds, water break after round 4.' },
  { video: 'Cape Town mixed league finals', by: 'netball.demo', content: 'What a final! Soweto league semi is next Saturday — see you courtside.' },
];

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function log(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }

function uuid() { return crypto.randomUUID(); }

/** drawtext-safe single-quoted value (ffmpeg-level escaping, no shell here).
 * Colons and commas inside option values must be backslash-escaped or they
 * terminate the drawtext option list / filtergraph segment early (this bit
 * the story posters' "SUN 09:00" text on the first run). */
function dtText(text) {
  return `'${String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/%/g, '\\%')}'`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Run ffmpeg; throw with stderr tail on failure. Set SEED_DEMO_VERBOSE=1 to
 * print every invocation (handy for debugging filtergraphs). */
function runFfmpeg(args, { optional = false } = {}) {
  if (process.env.SEED_DEMO_VERBOSE) {
    log(`ffmpeg ${args.length} args: ${args.map((a) => (/[\s'"]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
  }
  const res = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
  });
  if (res.error) {
    if (optional) return false;
    throw new Error(`ffmpeg spawn failed: ${res.error.message}`);
  }
  if (res.status !== 0) {
    const tail = (res.stderr || '').split('\n').slice(-4).join(' | ');
    if (optional) { warn(`ffmpeg (optional step) failed: ${tail}`); return false; }
    throw new Error(`ffmpeg failed (${res.status}): ${tail}`);
  }
  return true;
}

/** ffprobe duration (seconds, float) of a media file. */
function probeDuration(file) {
  const res = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8', timeout: 60 * 1000 });
  const v = parseFloat((res.stdout || '').trim());
  return Number.isFinite(v) ? v : 0;
}

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

// ---------------------------------------------------------------------------
// Media generation
// ---------------------------------------------------------------------------

let FONTS_OK = false;

/** Probe drawtext with a tiny render using the copied-in fonts. */
function probeFonts() {
  const probeOut = path.join(UPLOADS_DIR, `.fontprobe-${process.pid}.png`);
  try {
    const ok = runFfmpeg([
      '-f', 'lavfi', '-i', 'color=c=black:size=64x64',
      '-vf', `drawtext=fontfile=${FONT_HEAVY}:text=${dtText('Ag')}:fontsize=32:fontcolor=white:x=4:y=4`,
      '-frames:v', '1', '-update', '1', probeOut,
    ], { optional: true });
    if (ok && fs.existsSync(probeOut)) { FONTS_OK = true; }
  } finally {
    try { fs.unlinkSync(probeOut); } catch { /* ignore */ }
  }
  return FONTS_OK;
}

/**
 * drawtext fragment (font + colour + centred box helpers).
 * Returns null-safe string only when FONTS_OK.
 */
function dt({ font = 'heavy', size, color = 'white', x, y, text, border = 4, shadow = 0, borderColor = 'black@0.75' }) {
  const file = font === 'body' ? FONT_BODY : FONT_HEAVY;
  const parts = [
    `fontfile=${file}`,
    `text=${dtText(text)}`,
    `fontsize=${size}`,
    `fontcolor=${color}`,
    `x=${x}`,
    `y=${y}`,
  ];
  if (border > 0) parts.push(`borderw=${border}`, `bordercolor=${borderColor}`);
  if (shadow > 0) parts.push(`shadowx=2`, `shadowy=2`, `shadowcolor=black@0.55`);
  return `drawtext=${parts.join(':')}`;
}

function centerX() { return '(w-text_w)/2'; }

/** Court rings PNG (RGBA) — goal-circle motif, drawn with geq. */
function renderRingsPNG(outFile, size = 1000) {
  const c = size / 2;
  const r1o = size * 0.31, r1i = size * 0.298;   // outer goal circle
  const r2o = size * 0.215, r2i = size * 0.207;  // inner semicircle hint
  const r3o = size * 0.47, r3i = size * 0.464;   // centre-circle edge
  runFfmpeg([
    '-f', 'lavfi', '-i', `color=c=black:size=${size}x${size}`,
    '-vf',
    `format=rgba,geq=r='217':g='255':b='233':a='if(between(hypot(X-${c},Y-${c}),${r1i},${r1o}),120,if(between(hypot(X-${c},Y-${c}),${r2i},${r2o}),95,if(between(hypot(X-${c},Y-${c}),${r3i},${r3o}),60,0)))'`,
    '-frames:v', '1', '-update', '1', outFile,
  ]);
}

/** Netball PNG (RGBA) — white ball with a gold seam ring, drawn with geq. */
function renderBallPNG(outFile, size = 220) {
  const c = size / 2;
  const rb = Math.round(size * 0.30);   // ball radius
  const rs = Math.round(size * 0.355);  // seam ring radius
  const dist = `hypot(X-${c},Y-${c})`;
  runFfmpeg([
    '-f', 'lavfi', '-i', `color=c=black:size=${size}x${size}`,
    '-vf',
    `format=rgba,geq=r='if(lte(${dist},${rs}),247,245)':g='if(lte(${dist},${rb}),247,if(lte(${dist},${rs}),197,120))':b='if(lte(${dist},${rb}),242,if(lte(${dist},${rs}),66,26))':a='if(lte(${dist},${rs}),255,0)'`,
    '-frames:v', '1', '-update', '1', outFile,
  ]);
}

const PALETTES = {
  gold: [GOLD, ORANGE, '0x8a5a10'],
  green: [GREEN_MID, GREEN_DARK, GREEN_DEEP],
  orange: [ORANGE, '0xc4581a', '0x5a2a08'],
};

function gradientsInput(size, palette, { duration = null, rate = null } = {}) {
  const [c0, c1, c2] = PALETTES[palette] || PALETTES.green;
  let s = `gradients=size=${size.w}x${size.h}:c0=${c0}:c1=${c1}:nb_colors=3:c2=${c2}:speed=0.0009`;
  if (rate) s += `:rate=${rate}`;
  if (duration) s += `:duration=${duration}`;
  return ['-f', 'lavfi', '-i', s];
}

/** Drawbox chain painting baseline/centre-line/court edge marks. */
function courtMarks(w, h, color = 'white@0.22', thick = 5) {
  return [
    `drawbox=x=${Math.round(w * 0.07)}:y=0:w=${thick}:h=${h}:color=${color}:t=fill`,
    `drawbox=x=${Math.round(w * 0.93) - thick}:y=0:w=${thick}:h=${h}:color=${color}:t=fill`,
    `drawbox=x=${Math.round(w * 0.07)}:y=${Math.round(h * 0.5)}:w=${Math.round(w * 0.86)}:h=${thick}:color=${color}:t=fill`,
  ].join(',');
}

/** One 512x512 avatar poster. */
function renderAvatar(outFile, { initials, palette }) {
  const palKey = palette.includes('gold') ? 'gold' : (palette[0] === 'orange' ? 'orange' : 'green');
  const graph = [
    '[0:v]format=yuv420p,drawbox=x=16:y=16:w=480:h=480:color=' + GOLD + '@0.55:t=10,drawbox=x=40:y=40:w=432:h=432:color=black@0.28:t=fill[bg]',
    '[1:v]scale=430:430[rings]',
    '[bg][rings]overlay=(W-w)/2:(H-h)/2[comp]',
  ];
  let last = 'comp';
  if (FONTS_OK) {
    // NOTE: the output label MUST be attached inline at the end of the text
    // chain ("[comp]drawbox...,drawtext...[out]") — writing it as a separate
    // ";[out]format=..." chain leaves the text chain's output unlabeled and
    // [out] undefined, which ffmpeg silently binds to a raw input stream,
    // producing a textless image (this exact bug was caught by verification).
    graph.push(`[${last}]` + [
      dt({ size: 190, color: GOLD, x: `(w-text_w)/2+7`, y: `(h-text_h)/2+7`, text: initials, border: 0 }),
      dt({ size: 190, color: 'white', x: centerX(), y: `(h-text_h)/2`, text: initials, border: 6 }),
      dt({ font: 'body', size: 27, color: GOLD, x: centerX(), y: `h-118`, text: 'NETBALL CENTRAL', border: 3 }),
      dt({ font: 'body', size: 21, color: 'white@0.85', x: centerX(), y: `h-80`, text: 'SA YOUTH NETBALL', border: 3 }),
    ].join(',') + '[out]');
    last = 'out';
  }
  graph.push(`[${last}]format=rgba[o]`);
  runFfmpeg([
    ...gradientsInput({ w: 512, h: 512 }, palKey),
    '-i', path.join(UPLOADS_DIR, '_rings.png'),
    '-filter_complex', graph.join(';'),
    '-map', '[o]', '-frames:v', '1', '-update', '1', outFile,
  ]);
}

/** Split a string into <=n-char chunks on word boundaries. */
function wrap(text, n) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

/**
 * Title/scoreboard/footer text layers shared by thumbnails and videos.
 * thumbMode=true renders the full static poster (also used as video base).
 */
function posterTextLayers({ theme, score, quarter, footer = 'IKHWEZI - NETBALL CENTRAL SA' }) {
  if (!FONTS_OK) return '';
  const lines = wrap(theme, 13);
  const parts = [];
  // scoreboard chip
  parts.push(`drawbox=x=60:y=140:w=600:h=96:color=black@0.55:t=fill`);
  parts.push(`drawbox=x=60:y=140:w=600:h=96:color=${GOLD}@0.85:t=6`);
  parts.push(dt({ font: 'body', size: 38, color: GOLD, x: centerX(), y: 158, text: quarter, border: 0 }));
  parts.push(dt({ font: 'body', size: 40, color: 'white', x: centerX(), y: 196, text: score, border: 0 }));
  // title block
  let y = 330;
  for (const line of lines) {
    parts.push(dt({ size: 86, color: 'white', x: centerX(), y: `${y}`, text: line, border: 7, shadow: 1 }));
    y += 104;
  }
  // footer
  parts.push(`drawbox=x=80:y=1140:w=560:h=70:color=black@0.5:t=fill`);
  parts.push(dt({ font: 'body', size: 30, color: `0xF5C542`, x: centerX(), y: 1156, text: footer, border: 3 }));
  return parts.join(',');
}

/** One 720x1280 static thumbnail poster (also the video's base frame). */
function renderThumbnail(outFile, video) {
  const graph = [
    '[0:v]' + ['format=yuv420p', courtMarks(720, 1280), 'drawbox=x=0:y=0:w=720:h=1280:color=black@0.18:t=fill'].join(',') + '[bg]',
    '[1:v]scale=790:790[rings]',
    '[bg][rings]overlay=(W-w)/2:(H-h)/2[comp]',
  ];
  let last = 'comp';
  const text = posterTextLayers(video);
  if (text) { graph.push(`[${last}]${text}[txt]`); last = 'txt'; }
  graph.push(`[${last}]format=rgba[o]`);
  runFfmpeg([
    ...gradientsInput({ w: 720, h: 1280 }, 'green', { duration: 1 }),
    '-i', path.join(UPLOADS_DIR, '_rings.png'),
    '-filter_complex', graph.join(';'),
    '-map', '[o]', '-frames:v', '1', '-update', '1', outFile,
  ]);
}

/** One 720x1280 short video: animated gradient court + drifting ball. */
function renderVideo(outFile, video, ballFile) {
  const dur = video.durationSec;
  const ph1 = (video.views % 7) + 1;      // deterministic per-video phase
  const ph2 = (video.views % 5) + 2;
  const graph = [
    '[1:v]scale=790:790[rings]',
    '[0:v][rings]overlay=(W-w)/2:(H-h)/2[b0]',
    `[b0]${courtMarks(720, 1280)}[b1]`,
    `[b1][2:v]overlay=x='(W-w)/2+168*sin(t*1.05+${ph1})':y='(H-h)/2+250*cos(t*0.8+${ph2})'` +
      ":eval=frame[b2]",
  ];
  let last = 'b2';
  const text = posterTextLayers(video);
  if (text) { graph.push(`[${last}]${text}[txt]`); last = 'txt'; }
  graph.push(`[${last}]format=yuv420p[v]`);
  runFfmpeg([
    ...gradientsInput({ w: 720, h: 1280 }, 'green', { duration: dur + 1, rate: 24 }),
    '-i', path.join(UPLOADS_DIR, '_rings.png'),
    '-i', ballFile,
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', graph.join(';'),
    '-map', '[v]', '-map', '3:a',
    '-t', String(dur), '-r', '24',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '64k', '-shortest',
    '-movflags', '+faststart',
    outFile,
  ]);
}

/** One 1080x1920 story poster. */
function renderStory(outFile, story) {
  const graph = [
    '[0:v]format=yuv420p,' + courtMarks(1080, 1920, 'white@0.18', 7) + '[bg]',
    '[1:v]scale=1180:1180[rings]',
    '[bg][rings]overlay=(W-w)/2:(H-h)/2[comp]',
  ];
  let last = 'comp';
  if (FONTS_OK) {
    const layers = [
      `drawbox=x=90:y=560:w=900:h=104:color=${GOLD}@0.9:t=fill`,
      dt({ size: 150, color: 'white', x: centerX(), y: 740, text: story.line1, border: 8, shadow: 1 }),
      dt({ size: 150, color: `0xF5C542`, x: centerX(), y: 920, text: story.line2, border: 8, shadow: 1 }),
      dt({ size: 110, color: 'white', x: centerX(), y: 1100, text: story.line3, border: 6 }),
      `drawbox=x=240:y=1560:w=600:h=84:color=black@0.55:t=fill`,
      `drawbox=x=240:y=1560:w=600:h=84:color=${GOLD}@0.7:t=5`,
      dt({ font: 'body', size: 42, color: `0xF5C542`, x: centerX(), y: 1580, text: 'SWIPE UP - NETBALL CENTRAL', border: 3 }),
    ];
    graph.push(`[${last}]${layers.join(',')}[txt]`);
    last = 'txt';
  }
  graph.push(`[${last}]format=rgba[o]`);
  runFfmpeg([
    ...gradientsInput({ w: 1080, h: 1920 }, 'orange', { duration: 1 }),
    '-i', path.join(UPLOADS_DIR, '_rings.png'),
    '-filter_complex', graph.join(';'),
    '-map', '[o]', '-frames:v', '1', '-update', '1', outFile,
  ]);
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function main() {
  const refresh = process.argv.includes('--refresh');

  log('== iKHWEZI "Netball Central" demo seeder ==');
  log(`media dir : ${UPLOADS_DIR}`);
  ensureDir(UPLOADS_DIR);

  // 1) Connect exactly like backend/index.js does.
  const sequelize = createSequelize({ sqlitePath: path.join(__dirname, 'storage', 'ikhwezi.db') });
  const core = defineCoreModels(sequelize, DataTypes);
  const groups = buildGroupModels({ sequelize, DataTypes, User: core.User });
  const models = { ...core, ...groups };
  const { User, Video, Like, Comment, Follow, Story, Points, Wallet, Group, GroupMember, GroupMessage } = models;

  await sequelize.authenticate();
  const dialect = sequelize.getDialect();
  log(`database  : ${dialect} (${process.env.DATABASE_URL ? 'DATABASE_URL' : 'sqlite fallback'})`);
  if (dialect !== 'postgres') {
    warn('WARNING: expected PostgreSQL (DATABASE_URL). Continuing, but the local stack uses Postgres.');
  }

  // 2) Idempotency check (before any media generation).
  const usernames = DEMO_USERS.map((u) => u.username);
  const existingUsers = await User.findAll({ where: { username: { [Op.in]: usernames } } });
  const demoUserIds = existingUsers.map((u) => u.id);

  let existingDemoVideos = [];
  if (demoUserIds.length) {
    existingDemoVideos = await Video.findAll({
      where: {
        userId: { [Op.in]: demoUserIds },
        description: { [Op.like]: `%${DEMO_MARKER}%` },
      },
    });
  }

  if (existingDemoVideos.length && !refresh) {
    log('already seeded');
    log(`(demo users: ${usernames.join(', ')}; videos: ${existingDemoVideos.length}. Re-run with --refresh to regenerate demo content.)`);
    await sequelize.close();
    return;
  }

  if (refresh && (existingDemoVideos.length || demoUserIds.length)) {
    log('--refresh: removing previous demo rows and their media files...');
    const ids = existingDemoVideos.map((v) => v.id);

    // Delete interactions attached to demo videos (any author).
    if (ids.length) {
      await Like.destroy({ where: { videoId: { [Op.in]: ids } } });
      await Comment.destroy({ where: { videoId: { [Op.in]: ids } } });
      await models.VideoSave.destroy({ where: { videoId: { [Op.in]: ids } } });
      await models.VideoRepost.destroy({ where: { videoId: { [Op.in]: ids } } });
      await models.Star.destroy({ where: { videoId: { [Op.in]: ids } } });
      await Video.destroy({ where: { id: { [Op.in]: ids } } });
    }
    // Demo stories (marker-guarded) + their views/comments.
    const demoStories = demoUserIds.length
      ? await Story.findAll({ where: { userId: { [Op.in]: demoUserIds }, caption: { [Op.like]: `%${DEMO_MARKER}%` } } })
      : [];
    if (demoStories.length) {
      const sids = demoStories.map((s) => s.id);
      await models.StoryView.destroy({ where: { storyId: { [Op.in]: sids } } });
      await models.StoryComment.destroy({ where: { storyId: { [Op.in]: sids } } });
    }
    // Demo group(s) owned by demo users with the demo name.
    const demoGroups = demoUserIds.length
      ? await Group.findAll({ where: { ownerId: { [Op.in]: demoUserIds }, name: GROUP_NAME } })
      : [];
    for (const g of demoGroups) {
      await GroupMessage.destroy({ where: { groupId: g.id } });
      await GroupMember.destroy({ where: { groupId: g.id } });
      await g.destroy();
    }
    // Collect files to unlink BEFORE overwriting user.avatar.
    const doomed = new Set();
    for (const v of existingDemoVideos) {
      if (v.filename) doomed.add(v.filename);
      if (v.thumbnail) doomed.add(v.thumbnail);
    }
    for (const s of demoStories) {
      const f = path.basename(String(s.url || ''));
      if (f) doomed.add(f);
    }
    for (const u of existingUsers) {
      const f = path.basename(String(u.avatar || ''));
      if (f && f.endsWith('.png')) doomed.add(f);
    }
    for (const g of demoGroups) {
      const f = path.basename(String(g.avatar || ''));
      if (f && f.endsWith('.png')) doomed.add(f);
    }
    for (const f of doomed) {
      const p = path.join(UPLOADS_DIR, path.basename(f));
      try { fs.unlinkSync(p); log(`  removed old file ${f}`); } catch { /* already gone */ }
    }
    await Story.destroy({ where: { id: { [Op.in]: demoStories.map((s) => s.id) } } });
    log('--refresh: previous demo content removed.');
  }

  // 3b) Probe fonts + render shared assets (only reached when actually seeding).
  ensureDir(path.join(__dirname, 'storage', 'fonts'));
  FONTS_OK = probeFonts();
  log(`fonts     : ${FONTS_OK ? 'drawtext OK (impact/arialbd in storage/fonts)' : 'NOT available — abstract poster fallback (no text layers)'}`);

  const ringsFile = path.join(UPLOADS_DIR, '_rings.png');
  const ballFile = path.join(UPLOADS_DIR, '_ball.png');
  renderRingsPNG(ringsFile);
  renderBallPNG(ballFile);

  // 4) Demo accounts (upsert-style so --refresh keeps the same ids).
  log('seeding accounts...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const spec of DEMO_USERS) {
    const avatarName = `${uuid()}.png`;
    renderAvatar(path.join(UPLOADS_DIR, avatarName), spec);
    const [user, created] = await User.findOrCreate({
      where: { username: spec.username },
      defaults: {
        email: spec.email,
        phone: null,
        password: passwordHash,
        displayName: spec.displayName,
        avatar: `/storage/uploads/${avatarName}`,
        bio: spec.bio,
        isCreator: true,
      },
    });
    if (!created) {
      // Refresh the profile fields but keep a single avatar file (delete old).
      const oldAvatar = path.basename(String(user.avatar || ''));
      await user.update({
        email: user.email || spec.email,
        password: passwordHash,
        displayName: spec.displayName,
        bio: spec.bio,
        isCreator: true,
        avatar: `/storage/uploads/${avatarName}`,
      });
      if (oldAvatar && oldAvatar.endsWith('.png')) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, oldAvatar)); } catch { /* ignore */ }
      }
    }
    // Mirror the real register route: Points + Wallet always exist.
    await Points.findOrCreate({ where: { creatorId: user.id }, defaults: { creatorId: user.id, totalPoints: 0, lifetimePoints: 0 } });
    await Wallet.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, coins: 500 } });
    users[spec.username] = user;
    log(`  @${spec.username} ${created ? 'created' : 'updated'}  <${spec.email}>`);
  }

  // 5) Feed videos + thumbnails.
  log('rendering feed videos + thumbnails (ffmpeg, CRF 28, silent AAC)...');
  const createdVideos = [];
  for (const spec of DEMO_VIDEOS) {
    const owner = users[spec.owner];
    const videoName = `${uuid()}.mp4`;
    const thumbName = `${uuid()}.png`;
    const videoPath = path.join(UPLOADS_DIR, videoName);
    const thumbPath = path.join(UPLOADS_DIR, thumbName);

    renderThumbnail(thumbPath, spec);
    renderVideo(videoPath, spec, ballFile);
    const duration = probeDuration(videoPath) || spec.durationSec;
    const bytes = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;

    const video = await Video.create({
      userId: owner.id,
      title: spec.title,
      description: `${spec.description} (${DEMO_MARKER})`,
      filename: videoName,
      thumbnail: thumbName,
      duration: Math.round(duration * 10) / 10,
      views: spec.views,
      isPublished: true,
      isSponsored: false,
      isTrending: !!spec.trending,
    });
    createdVideos.push({ spec, video, bytes });
    log(`  "${spec.title}" — ${duration.toFixed(1)}s, ${fmtBytes(bytes)}, views ${spec.views}${spec.trending ? ' [TRENDING]' : ''}`);
  }

  // 6) Comments / likes / follows between demo users.
  log('seeding comments, likes, follows...');
  const byTitle = Object.fromEntries(createdVideos.map((c) => [c.spec.title, c.video]));
  let commentCount = 0;
  let likeCount = 0;
  for (const c of DEMO_COMMENTS) {
    const video = byTitle[c.video];
    if (!video) continue;
    await Comment.create({
      userId: users[c.by].id,
      videoId: video.id,
      parentId: null,
      content: c.content,
    });
    commentCount += 1;
  }
  const allVideos = createdVideos.map((c) => c.video);
  const likers = Object.values(users);
  for (const video of allVideos) {
    // Each video gets 2-3 cross-likes; owners never like their own clip.
    for (const liker of likers) {
      if (liker.id === video.userId) continue;
      if ((hashSeed(liker.id + video.id) % 3) !== 0) continue; // deterministic ~1/3
      await Like.findOrCreate({ where: { userId: liker.id, videoId: video.id } });
      likeCount += 1;
    }
  }
  for (const follower of Object.values(users)) {
    for (const followee of Object.values(users)) {
      if (follower.id === followee.id) continue;
      await Follow.findOrCreate({
        where: { followerId: follower.id, followingId: followee.id },
        defaults: { followerId: follower.id, followingId: followee.id },
      });
    }
  }
  log(`  ${commentCount} comments, ${likeCount} likes, all-pairs follows`);

  // 7) Group chat: "Netball Central — SA Youth".
  log('seeding group chat...');
  try {
    const groupAvatarName = `${uuid()}.png`;
    renderAvatar(path.join(UPLOADS_DIR, groupAvatarName), { initials: 'NC', palette: 'gold' });
    const group = await Group.create({
      name: GROUP_NAME,
      description: 'Soweto, Cape Town and Gauteng youth netball — matchdays, drills, trials and watch parties. Stream night every Friday.',
      avatar: `/storage/uploads/${groupAvatarName}`,
      ownerId: users['netball.demo'].id,
      isPrivate: false,
    });
    await GroupMember.create({ groupId: group.id, userId: users['netball.demo'].id, role: 'owner' });
    for (const uname of ['coach.dlamini', 'shooter.thandi', 'centre.pass']) {
      await GroupMember.create({ groupId: group.id, userId: users[uname].id, role: 'member' });
    }
    let t = Date.now() - GROUP_MESSAGES.length * 7 * 60 * 1000;
    for (const m of GROUP_MESSAGES) {
      t += 7 * 60 * 1000;
      await GroupMessage.create({
        groupId: group.id,
        senderId: users[m.sender].id,
        content: m.content,
        messageType: 'text',
        mediaUrl: null,
        createdAt: new Date(t),
      });
    }
    log(`  group "${GROUP_NAME}" with 4 members and ${GROUP_MESSAGES.length} messages`);
  } catch (err) {
    warn(`  group seeding skipped: ${err.message}`);
  }

  // 8) Stories (expire in ~20h like real stories would).
  log('seeding stories...');
  let storyCount = 0;
  try {
    for (const s of DEMO_STORIES) {
      const storyName = `${uuid()}.png`;
      renderStory(path.join(UPLOADS_DIR, storyName), s);
      await Story.create({
        userId: users[s.owner].id,
        type: 'image',
        url: `/storage/uploads/${storyName}`,
        caption: s.caption,
        expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
      });
      storyCount += 1;
    }
    log(`  ${storyCount} story posters (expire in 20h)`);
  } catch (err) {
    warn(`  story seeding skipped: ${err.message}`);
  }

  // Clean shared render assets (they are seeds-internal, not DB-referenced).
  for (const f of [ringsFile, ballFile]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }

  // 9) Summary.
  const mediaFiles = [
    ...createdVideos.map((c) => c.video.filename),
    ...createdVideos.map((c) => c.video.thumbnail),
  ];
  const avatarCount = DEMO_USERS.length + 1;
  const totalBytes = createdVideos.reduce((a, c) => a + c.bytes, 0);

  log('');
  log('==================== NETBALL CENTRAL DEMO SEEDED ====================');
  log('Demo accounts (all share the same password):');
  for (const spec of DEMO_USERS) {
    log(`  ${spec.email.padEnd(38)} / ${DEMO_PASSWORD}   (@${spec.username} — ${spec.displayName})`);
  }
  log('');
  log(`Media generated: ${mediaFiles.length} feed files (${createdVideos.length} mp4 + ${createdVideos.length} thumbnails, ${fmtBytes(totalBytes)} video),`);
  log(`                 ${avatarCount} avatars, ${storyCount} story posters — all local ffmpeg renders.`);
  log('');
  log('Where the content appears (same API the frontend uses):');
  log('  GET  /api/videos/feed              — 8 demo videos (1 trending), with comments + likes');
  log('  GET  /api/videos/:id/comments      — demo comments');
  log('  GET  /api/stories                  — 3 story posters (next 20h)');
  log('  GET  /api/groups                   — "Netball Central — SA Youth" group + messages');
  log('  POST /api/auth/login               — log in with any demo account above');
  log('  GET  /storage/uploads/<file>       — media files (static local serving)');
  log('');
  log('Frontend (web): http://localhost:8080  •  Backend API from host: http://localhost:3002');
  log('=====================================================================');

  await sequelize.close();
}

/** Tiny deterministic 0..2^31 hash for stable pseudo-random decisions. */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

main().catch((err) => {
  console.error('seed-demo failed:', err?.stack || err?.message || err);
  process.exit(1);
});
