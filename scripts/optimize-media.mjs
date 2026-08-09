/* ==========================================================
   Media optimiser

   The gallery originals are straight off the camera: 8192x5464 and
   9504x6336 stills (40-60 megapixels) and up to 42 MB of video, ~292 MB
   in total. The wall renders those into tiles roughly 400 px wide, so
   every one of them was being decoded at full size on the main thread —
   that decode cost, not the download, is what made scrolling stall.

   This writes two derivatives of each asset so the page can request the
   size it actually paints:

     images  -thumb.webp  800 px long edge   grid tiles
             -full.webp  2000 px long edge   lightbox
     videos  -tile.mp4    720 px tall, muted, no audio track
             -full.mp4   1080 px tall, faststart
             -poster.webp                    representative frame

   Sources live in media-src/ (outside public/) so the originals are
   never copied into dist. Output goes to public/media/<slug>/ and the
   manifest at src/data/mediaManifest.json becomes the single source of
   truth for what the site loads.

   Run: npm run optimize:media
   Idempotent — an output newer than its source is left alone.
   ========================================================== */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SRC_DIR = path.join(ROOT, 'media-src', 'services')
const OUT_DIR = path.join(ROOT, 'public', 'media')
const MANIFEST = path.join(ROOT, 'src', 'data', 'mediaManifest.json')

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const VID_EXT = new Set(['.mp4', '.webm', '.mov'])

const THUMB_EDGE = 800
const FULL_EDGE = 2000
const THUMB_Q = 78
const FULL_Q = 82

const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')

const mb = (n) => (n / 1048576).toFixed(2)
const exists = (p) => fs.existsSync(p)

/* Skip work when the derivative is already newer than its source. */
const isFresh = (src, out) => {
  if (FORCE || !exists(out)) return false
  return fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function optimizeImage(src, outBase) {
  const thumb = `${outBase}-thumb.webp`
  const full = `${outBase}-full.webp`
  const meta = await sharp(src).metadata()
  const landscape = (meta.width || 0) >= (meta.height || 0)
  const fit = (edge) => (landscape ? { width: edge } : { height: edge })

  if (!isFresh(src, thumb)) {
    await sharp(src)
      .rotate() // honour EXIF orientation before resizing
      .resize({ ...fit(THUMB_EDGE), withoutEnlargement: true })
      .webp({ quality: THUMB_Q })
      .toFile(thumb)
  }
  if (!isFresh(src, full)) {
    await sharp(src)
      .rotate()
      .resize({ ...fit(FULL_EDGE), withoutEnlargement: true })
      .webp({ quality: FULL_Q })
      .toFile(full)
  }

  const out = await sharp(full).metadata()
  return {
    type: 'image',
    thumb: thumb.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/'),
    full: full.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/'),
    width: out.width,
    height: out.height,
    bytes: fs.statSync(thumb).size + fs.statSync(full).size
  }
}

async function ffmpeg(cliArgs) {
  await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...cliArgs], {
    maxBuffer: 1024 * 1024 * 64
  })
}

/* Fit inside a square box while preserving the DISPLAY aspect ratio.

   These sources are anamorphic: the social clips store 1920x1080 with
   SAR 81:256, so they display as 608x1080 vertical. `scale` works on
   storage dimensions, so scaling on `ih` alone produced a 1280x720
   landscape encode — about 40% more pixels than the video ever shows.
   Normalising to square pixels first (iw*sar, then setsar=1) makes the
   box below mean what it says. */
const fitBox = (edge) =>
  `scale=iw*sar:ih,setsar=1,scale=w=${edge}:h=${edge}:` +
  'force_original_aspect_ratio=decrease:force_divisible_by=2'

async function optimizeVideo(src, outBase) {
  const tile = `${outBase}-tile.mp4`
  const full = `${outBase}-full.mp4`
  const poster = `${outBase}-poster.webp`
  const posterTmp = `${outBase}-poster.jpg`

  /* Tile copy: no audio track at all — the wall autoplays these muted,
     so an audio stream would be pure waste. 640 box because a wall tile
     is never painted wider than about 400 CSS px. */
  if (!isFresh(src, tile)) {
    await ffmpeg([
      '-i', src,
      '-an',
      '-vf', fitBox(640),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '32',
      '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      tile
    ])
  }

  if (!isFresh(src, full)) {
    await ffmpeg([
      '-i', src,
      '-vf', fitBox(1080),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '25',
      '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      full
    ])
  }

  if (!isFresh(src, poster)) {
    /* `thumbnail` scores a window of frames and returns the most
       representative one, rather than whatever happens to be first.
       Clips that fade in from black were producing solid black
       posters — video2.mp4 shipped one — which read as blank plates
       wherever a poster stands in for the video. It degrades safely:
       a clip shorter than the window is scored on the frames it has. */
    await ffmpeg(['-i', src, '-vf', `thumbnail=100,${fitBox(640)}`, '-frames:v', '1', posterTmp])
    await sharp(posterTmp).webp({ quality: THUMB_Q }).toFile(poster)
    fs.unlinkSync(posterTmp)
  }

  const meta = await sharp(poster).metadata()
  const rel = (p) => p.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/')
  return {
    type: 'video',
    thumb: rel(tile),
    full: rel(full),
    poster: rel(poster),
    width: meta.width,
    height: meta.height,
    bytes: fs.statSync(tile).size + fs.statSync(full).size + fs.statSync(poster).size
  }
}

async function main() {
  if (!exists(SRC_DIR)) {
    console.error(`No source directory at ${SRC_DIR}`)
    process.exit(1)
  }

  const manifest = {}
  let srcTotal = 0
  let outTotal = 0

  for (const slug of fs.readdirSync(SRC_DIR)) {
    const slugSrc = path.join(SRC_DIR, slug)
    if (!fs.statSync(slugSrc).isDirectory()) continue

    const slugOut = path.join(OUT_DIR, slug)
    fs.mkdirSync(slugOut, { recursive: true })

    const files = fs.readdirSync(slugSrc).filter((f) => {
      const ext = path.extname(f).toLowerCase()
      return IMG_EXT.has(ext) || VID_EXT.has(ext)
    })

    /* A video and its poster may share a basename; the video wins so the
       still is not also emitted as a standalone tile. */
    const videoStems = new Set(
      files.filter((f) => VID_EXT.has(path.extname(f).toLowerCase())).map((f) => path.parse(f).name)
    )

    const entries = []
    for (const file of files.sort()) {
      const ext = path.extname(file).toLowerCase()
      const stem = path.parse(file).name
      const isVideo = VID_EXT.has(ext)
      if (!isVideo && videoStems.has(stem)) continue

      const src = path.join(slugSrc, file)
      const outBase = path.join(slugOut, slugify(file))
      srcTotal += fs.statSync(src).size

      try {
        const entry = isVideo
          ? await optimizeVideo(src, outBase)
          : await optimizeImage(src, outBase)
        outTotal += entry.bytes
        const { bytes, ...rest } = entry
        entries.push(rest)
        process.stdout.write(`  ${slug}/${file} → ${mb(bytes)} MB\n`)
      } catch (err) {
        console.error(`  FAILED ${slug}/${file}: ${err.message.slice(0, 200)}`)
      }
    }

    /* Videos first so each gallery opens on motion. */
    entries.sort((a, b) => (a.type === b.type ? 0 : a.type === 'video' ? -1 : 1))
    manifest[slug] = entries
    console.log(`${slug}: ${entries.length} items`)
  }

  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\nsource ${mb(srcTotal)} MB → output ${mb(outTotal)} MB`)
  console.log(`saved ${mb(srcTotal - outTotal)} MB (${((1 - outTotal / srcTotal) * 100).toFixed(1)}%)`)
  console.log(`manifest → ${path.relative(ROOT, MANIFEST)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
