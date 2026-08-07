/* ==========================================================
   Site asset optimiser — the fixed videos used by the home page.

   These were export masters, not web deliverables. The worst,
   podcast_recording.mp4, ran 15 seconds at 23,790 kb/s for 44.8 MB;
   the home page pulled roughly 117 MB of video in total. All of them
   are decorative loops that render into a card or a hero backdrop.

   Sources are read from media-src/assets/ and web copies are written
   to public/assets/, so re-running never re-encodes an encode.

   `audio: false` strips the track entirely. Applied only where the
   markup hard-codes `muted` — the Stories clips can be unmuted by the
   visitor, so those keep theirs.

   Run: npm run optimize:assets
   ========================================================== */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'media-src', 'assets')
const OUT = path.join(ROOT, 'public', 'assets')

/* [file, box, crf, keepAudio] — box is the longest edge of the frame,
   chosen from the largest slot each clip is painted into. */
const TARGETS = [
  /* The hero sits behind a darkening overlay and a headline, so it
     carries detail far better than its pixel count suggests. */
  ['viewfinder_hero.mp4', 1440, 26, false],
  ['podcast_recording.mp4', 1280, 24, false], // card
  ['loader_intro.mp4', 1280, 25, false], // card
  /* Stories play in a card no wider than ~380 CSS px; 1080-tall
     encodes were roughly double what that slot can resolve. */
  ['video1.mp4', 800, 27, true], // visitor can unmute these
  ['video2.mp4', 800, 27, true],
  ['video3.mp4', 800, 27, true],
  ['video4.mp4', 800, 27, true]
]

const mb = (n) => (n / 1048576).toFixed(2)

/* Normalise to square pixels before fitting, so an anamorphic source
   is measured by what it displays rather than how it is stored. */
const fitBox = (edge) =>
  `scale=iw*sar:ih,setsar=1,scale=w=${edge}:h=${edge}:` +
  'force_original_aspect_ratio=decrease:force_divisible_by=2'

let before = 0
let after = 0

for (const [file, box, crf, keepAudio] of TARGETS) {
  const src = path.join(SRC, file)
  const out = path.join(OUT, file)
  if (!fs.existsSync(src)) {
    console.log(`skip (no source): ${file}`)
    continue
  }

  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', src,
    '-vf', fitBox(box),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    ...(keepAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-movflags', '+faststart',
    out
  ]

  await run(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 })

  const b = fs.statSync(src).size
  const a = fs.statSync(out).size
  before += b
  after += a
  console.log(`${file}  ${mb(b)} MB -> ${mb(a)} MB`)
}

console.log(`\ntotal ${mb(before)} MB -> ${mb(after)} MB (saved ${mb(before - after)} MB)`)
