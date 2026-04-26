#!/usr/bin/env node
// Generate SVG templates and rasterize via rsvg-convert
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS = resolve(__dirname, '..')
const SRC = __dirname

const dataURL = (id) => {
  const buf = readFileSync(resolve(ASSETS, `pony-${id}.png`))
  return `data:image/png;base64,${buf.toString('base64')}`
}
const PONY_DATA = Object.fromEntries(['iris','vesper','onyx','prism','sable','femme'].map(id => [id, dataURL(id)]))

// Pride gradient stops
const PRIDE_STOPS = `
  <stop offset="0%" stop-color="#ff1f6d"/>
  <stop offset="20%" stop-color="#ff8a00"/>
  <stop offset="40%" stop-color="#ffe600"/>
  <stop offset="60%" stop-color="#22e08a"/>
  <stop offset="80%" stop-color="#2bb7ff"/>
  <stop offset="100%" stop-color="#a347ff"/>`

const INK = '#0a0410'
const HOT = '#ff1493'
const PAPER = '#f4f0e8'

// Display font stack: Big Shoulders if available locally, else Impact
const DISPLAY = "'Big Shoulders Display', 'Bebas Neue', Impact, 'Helvetica Inserat', sans-serif"
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif"
const MONO = "'JetBrains Mono', 'Menlo', monospace"

function defs() {
  return `<defs>
    <linearGradient id="pride" x1="0" y1="0" x2="1" y2="0">${PRIDE_STOPS}</linearGradient>
    <linearGradient id="prideV" x1="0" y1="0" x2="0" y2="1">${PRIDE_STOPS}</linearGradient>
    <clipPath id="circle-l"><circle cx="315" cy="315" r="240"/></clipPath>
    <clipPath id="circle-square"><circle cx="600" cy="450" r="320"/></clipPath>
  </defs>`
}

// 1200×630 canonical OG card
function canonicalOG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630" width="1200" height="630">
  ${defs()}
  <rect width="1200" height="630" fill="${INK}"/>

  <!-- pony silhouette / cutout on right -->
  <g opacity="0.95">
    <clipPath id="ponyR"><circle cx="940" cy="315" r="245"/></clipPath>
    <circle cx="940" cy="315" r="245" fill="${HOT}"/>
    <image href="${PONY_DATA.iris}" x="640" y="-10" width="650" height="650" preserveAspectRatio="xMidYMid slice" clip-path="url(#ponyR)"/>
    <circle cx="940" cy="315" r="245" fill="none" stroke="${PAPER}" stroke-width="4"/>
  </g>

  <!-- Wordmark -->
  <text x="70" y="320" font-family="${DISPLAY}" font-weight="900" font-size="180" fill="${PAPER}" letter-spacing="-2">PONYFORGE</text>

  <!-- Pride bar slash -->
  <rect x="70" y="345" width="640" height="14" fill="url(#pride)"/>

  <!-- tagline -->
  <text x="70" y="410" font-family="${SANS}" font-weight="500" font-size="28" fill="${PAPER}">chaotic queer pony maker</text>

  <!-- bottom row -->
  <text x="70" y="560" font-family="${MONO}" font-weight="500" font-size="22" fill="${PAPER}" opacity="0.7">PFG-2026-FORGE</text>
  <text x="1130" y="560" font-family="${MONO}" font-weight="500" font-size="22" fill="${PAPER}" text-anchor="end">ponyforge.com</text>
</svg>`
}

// 1200×1200 square for instagram/discord
function squareOG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 1200" width="1200" height="1200">
  ${defs()}
  <rect width="1200" height="1200" fill="${PAPER}"/>

  <!-- pride bar top -->
  <rect x="0" y="0" width="1200" height="32" fill="url(#pride)"/>

  <!-- pony cutout -->
  <clipPath id="sq-pony"><circle cx="600" cy="500" r="340"/></clipPath>
  <circle cx="600" cy="500" r="340" fill="${INK}"/>
  <image href="${PONY_DATA.prism}" x="190" y="120" width="820" height="760" preserveAspectRatio="xMidYMid slice" clip-path="url(#sq-pony)"/>
  <circle cx="600" cy="500" r="340" fill="none" stroke="${INK}" stroke-width="6"/>

  <!-- Wordmark -->
  <text x="600" y="990" font-family="${DISPLAY}" font-weight="900" font-size="180" fill="${INK}" text-anchor="middle" letter-spacing="-2">PONYFORGE</text>
  <text x="600" y="1050" font-family="${SANS}" font-weight="500" font-size="28" fill="${INK}" text-anchor="middle">chaotic queer pony maker</text>

  <text x="60" y="1160" font-family="${MONO}" font-weight="500" font-size="22" fill="${INK}" opacity="0.7">PFG-2026-FORGE</text>
  <text x="1140" y="1160" font-family="${MONO}" font-weight="500" font-size="22" fill="${INK}" text-anchor="end">ponyforge.com</text>
</svg>`
}

// 1200×600 twitter
function twitterOG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 600" width="1200" height="600">
  ${defs()}
  <rect width="1200" height="600" fill="${INK}"/>

  <clipPath id="tw-pony"><circle cx="940" cy="300" r="230"/></clipPath>
  <circle cx="940" cy="300" r="230" fill="${HOT}"/>
  <image href="${PONY_DATA.vesper}" x="650" y="0" width="600" height="600" preserveAspectRatio="xMidYMid slice" clip-path="url(#tw-pony)"/>
  <circle cx="940" cy="300" r="230" fill="none" stroke="${PAPER}" stroke-width="4"/>

  <text x="70" y="300" font-family="${DISPLAY}" font-weight="900" font-size="170" fill="${PAPER}" letter-spacing="-2">PONYFORGE</text>
  <rect x="70" y="325" width="600" height="12" fill="url(#pride)"/>
  <text x="70" y="385" font-family="${SANS}" font-weight="500" font-size="26" fill="${PAPER}">chaotic queer pony maker</text>

  <text x="70" y="540" font-family="${MONO}" font-weight="500" font-size="20" fill="${PAPER}" opacity="0.7">PFG-2026-TWEET</text>
  <text x="1130" y="540" font-family="${MONO}" font-weight="500" font-size="20" fill="${PAPER}" text-anchor="end">ponyforge.com</text>
</svg>`
}

// per-pony 1200×630 cards
const PONIES = [
  { id: 'iris',   name: 'IRIS',    pronouns: 'she / they', tag: 'prism-prone &amp; overcaffeinated', serial: 'PFG-0001-IRIS', bg: PAPER, ink: INK,  accent: HOT },
  { id: 'vesper', name: 'VESPER',  pronouns: 'they / them', tag: 'midnight aesthete, soft chaos',     serial: 'PFG-0002-VSPR', bg: INK,   ink: PAPER, accent: HOT },
  { id: 'onyx',   name: 'ONYX',    pronouns: 'he / him',    tag: 'gravelvoiced glitter daddy',        serial: 'PFG-0003-ONYX', bg: INK,   ink: PAPER, accent: HOT },
  { id: 'prism',  name: 'PRISM',   pronouns: 'xe / they',   tag: 'all six colors at once',            serial: 'PFG-0004-PRSM', bg: PAPER, ink: INK,  accent: HOT },
  { id: 'sable',  name: 'SABLE',   pronouns: 'she / her',   tag: 'leather &amp; lullaby',             serial: 'PFG-0005-SABL', bg: INK,   ink: PAPER, accent: HOT },
  { id: 'femme',  name: 'FEMME',   pronouns: 'she / they',  tag: 'high femme, low patience',          serial: 'PFG-0006-FEMM', bg: PAPER, ink: INK,  accent: HOT },
]

function ponyCard(p) {
  const onPaper = p.bg === PAPER
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630" width="1200" height="630">
  ${defs()}
  <rect width="1200" height="630" fill="${p.bg}"/>

  <!-- pride bar top -->
  <rect x="0" y="0" width="1200" height="14" fill="url(#pride)"/>

  <!-- pony portrait left, square clipped -->
  <clipPath id="pp-${p.id}"><rect x="60" y="80" width="460" height="460" rx="8"/></clipPath>
  <rect x="60" y="80" width="460" height="460" rx="8" fill="${p.accent}"/>
  <image href="${PONY_DATA[p.id]}" x="40" y="60" width="500" height="500" preserveAspectRatio="xMidYMid slice" clip-path="url(#pp-${p.id})"/>
  <rect x="60" y="80" width="460" height="460" rx="8" fill="none" stroke="${p.ink}" stroke-width="4"/>

  <!-- right column -->
  <text x="570" y="160" font-family="${MONO}" font-weight="500" font-size="22" fill="${p.ink}" opacity="0.6">${p.serial}</text>

  <text x="570" y="320" font-family="${DISPLAY}" font-weight="900" font-size="200" fill="${p.ink}" letter-spacing="-3">${p.name}</text>

  <text x="570" y="370" font-family="${SANS}" font-weight="700" font-size="26" fill="${p.accent}">${p.pronouns}</text>

  <text x="570" y="430" font-family="${SANS}" font-weight="500" font-size="28" fill="${p.ink}">${p.tag}</text>

  <!-- bottom wordmark -->
  <text x="570" y="560" font-family="${DISPLAY}" font-weight="900" font-size="48" fill="${p.ink}" letter-spacing="-1">PONYFORGE</text>
  <text x="1140" y="560" font-family="${MONO}" font-weight="500" font-size="22" fill="${p.ink}" text-anchor="end" opacity="0.7">ponyforge.com</text>
</svg>`
}

// 180×180 apple-touch-icon
function appleTouchIcon() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <defs>
    <linearGradient id="pride" x1="0" y1="0" x2="0" y2="1">${PRIDE_STOPS}</linearGradient>
  </defs>
  <rect width="180" height="180" rx="36" fill="url(#pride)"/>
  <path d="M39 135 C 39 96, 62 79, 84 79 L 96 62 C 102 51, 113 48, 118 59 L 121 70 C 126 68, 132 71, 135 76 L 137 90 C 146 92, 152 99, 152 110 L 152 135 L 138 135 L 135 118 L 124 118 L 121 135 L 109 135 L 107 115 C 90 118, 73 118, 65 116 L 62 135 L 51 135 L 49 118 L 42 118 Z" fill="${INK}"/>
  <path d="M118 59 L 127 48 L 130 59 Z" fill="${INK}"/>
  <circle cx="129" cy="70" r="3" fill="#fff"/>
</svg>`
}

// Write SVGs and convert
const outputs = [
  { svg: 'og-image.svg',         png: 'og-image.png',         w: 1200, h: 630,  build: canonicalOG },
  { svg: 'og-square.svg',        png: 'og-square.png',        w: 1200, h: 1200, build: squareOG    },
  { svg: 'og-twitter.svg',       png: 'og-twitter.png',       w: 1200, h: 600,  build: twitterOG   },
  ...PONIES.map(p => ({ svg: `og-pony-${p.id}.svg`, png: `og-pony-${p.id}.png`, w: 1200, h: 630, build: () => ponyCard(p) })),
  { svg: 'apple-touch-icon.svg', png: 'apple-touch-icon.png', w: 180,  h: 180,  build: appleTouchIcon },
]

for (const o of outputs) {
  const svgPath = resolve(SRC, o.svg)
  const pngPath = resolve(ASSETS, o.png)
  writeFileSync(svgPath, o.build())
  execSync(`rsvg-convert -w ${o.w} -h ${o.h} -o "${pngPath}" "${svgPath}"`)
  const info = execSync(`file "${pngPath}"`).toString().trim()
  console.log(info)
  // intermediate SVGs are huge (embedded base64) -- discard
  unlinkSync(svgPath)
}
