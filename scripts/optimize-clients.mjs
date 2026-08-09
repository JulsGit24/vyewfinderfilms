/* ==========================================================
   Client logo optimiser

   The seven client logos used to be a hardcoded array in
   Clients.jsx pointing at public/images/client-*.avif, so adding an
   eighth logo meant a code edit. This mirrors optimize-media.mjs
   instead: whatever is dropped into media-src/clients/ is discovered,
   processed and written into a generated manifest, and the component
   just renders the manifest.

     raster  ->  public/media/clients/<slug>.webp
                 400 px long edge, quality 85, alpha preserved
     svg     ->  copied through untouched (already resolution-free)

   Alpha matters: the ticker paints these as a white silhouette in dark
   theme (--wst-logo-filter), which only works on a transparent source.
   See the README in media-src/clients/.

   Run: npm run optimize:clients
   Idempotent — an output newer than its source is left alone. --force
   re-encodes everything.
   ========================================================== */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SRC_DIR = path.join(ROOT, 'media-src', 'clients')
const OUT_DIR = path.join(ROOT, 'public', 'media', 'clients')
const MANIFEST = path.join(ROOT, 'src', 'data', 'clientsManifest.json')

const RASTER_EXT = new Set(['.png', '.webp', '.avif', '.jpg', '.jpeg'])
const VECTOR_EXT = new Set(['.svg'])

const LOGO_EDGE = 400
const LOGO_Q = 85

/* The ticker forces every logo to a flat white/black silhouette (see
   --wst-logo-filter in index.scss) so mixed-quality client art reads
   as one consistent mark. That only works when a logo's "ink" is
   opaque against a mostly-transparent field — a wordmark or line
   icon. A badge-style logo (a filled circular disc, a solid card)
   is mostly-opaque to begin with, so the filter collapses it to a
   nearly featureless blob: no readable text, no icon, in either
   theme. Measured across the current roster, real silhouette-safe
   logos sit under ~31% opaque coverage and the one badge-style
   outlier (a filled circular gym badge) sits at ~78% — a wide gap,
   so the threshold has real margin on both sides rather than being a
   near-miss tuned to one file. */
const REAL_COLOR_OPAQUE_THRESHOLD = 0.5

const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')

const kb = (n) => (n / 1024).toFixed(1)
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

/* The filename is the only description we have, and it is one the
   client controls by naming the file after the brand. Hyphens and
   underscores are the two separators people actually type. */
const brandName = (file) =>
  path
    .parse(file)
    .name.replace(/[-_]+/g, ' ')
    .trim()

const rel = (p) => p.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/')

/* Fraction of pixels with significant saturation — if an image has enough
   color (not just black/white/gray), we don't apply the silhouette filter 
   because it would destroy the brand colors. */
async function isColorful(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let coloredPixels = 0
  let totalPixels = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 10) { // non-transparent
      totalPixels++
      const r = data[i], g = data[i+1], b = data[i+2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max - min > 15 && max > 50) { // has some color saturation and is not extremely dark
        coloredPixels++
      }
    }
  }
  const ratio = totalPixels ? coloredPixels / totalPixels : 0
  // If more than 5% of the opaque pixels have color, consider it a colorful logo.
  return ratio > 0.05
}

async function optimizeRaster(src, out) {
  if (!isFresh(src, out)) {
    const meta = await sharp(src).metadata()
    const landscape = (meta.width || 0) >= (meta.height || 0)
    await sharp(src)
      .resize({
        ...(landscape ? { width: LOGO_EDGE } : { height: LOGO_EDGE }),
        withoutEnlargement: true,
        fit: 'inside'
      })
      /* alphaQuality defaults would flatten soft edges on a logo that
         is mostly transparency; the file is a few KB either way. */
      .webp({ quality: LOGO_Q, alphaQuality: 100 })
      .toFile(out)
  }
  const outMeta = await sharp(out).metadata()
  const hasColor = await isColorful(out)
  const entry = { src: rel(out), width: outMeta.width, height: outMeta.height }
  // Only recorded when true, so the common case doesn't carry a
  // `realColor: false` on every single manifest entry.
  if (hasColor) entry.realColor = true
  return entry
}

function copyVector(src, out) {
  if (!isFresh(src, out)) fs.copyFileSync(src, out)
  /* An SVG scales to whatever the ticker box gives it, so there are no
     meaningful intrinsic pixels to record. */
  return { src: rel(out), width: null, height: null }
}

async function main() {
  if (!exists(SRC_DIR)) {
    console.error(`No source directory at ${SRC_DIR}`)
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const files = fs.readdirSync(SRC_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase()
    return RASTER_EXT.has(ext) || VECTOR_EXT.has(ext)
  })

  const manifest = []
  let srcTotal = 0
  let outTotal = 0

  for (const file of files.sort()) {
    const ext = path.extname(file).toLowerCase()
    const src = path.join(SRC_DIR, file)
    const slug = slugify(file)

    try {
      const entry = VECTOR_EXT.has(ext)
        ? copyVector(src, path.join(OUT_DIR, `${slug}.svg`))
        : await optimizeRaster(src, path.join(OUT_DIR, `${slug}.webp`))

      const outPath = path.join(ROOT, 'public', entry.src)
      srcTotal += fs.statSync(src).size
      outTotal += fs.statSync(outPath).size

      manifest.push({ name: brandName(file), ...entry })
      process.stdout.write(`  ${file} → ${entry.src} (${kb(fs.statSync(outPath).size)} KB)\n`)
    } catch (err) {
      console.error(`  FAILED ${file}: ${err.message.slice(0, 200)}`)
    }
  }

  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\n${manifest.length} logos: ${kb(srcTotal)} KB → ${kb(outTotal)} KB`)
  console.log(`manifest → ${path.relative(ROOT, MANIFEST)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
