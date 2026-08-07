/* Optimises the fixed site images referenced directly by components.
   Same reasoning as optimize-media.mjs: several of these are camera
   originals (portfolio-social.jpg is 6336x9504) painted into slots no
   wider than ~360 CSS px.

   Reads from media-src/images/ and writes .webp into public/images/,
   so the originals are never served and a re-run never re-encodes an
   encode.

   Run: npm run optimize:images */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'media-src/images'
const OUT = 'public/images'

// [file, max long edge] — sized for the largest slot each one paints into
const TARGETS = [
  ['portfolio-corporate-v.jpg', 1100],
  ['portfolio-photography.jpg', 1100],
  ['portfolio-social.jpg', 1100],
  ['portfolio-podcast.JPG', 1100],
  ['portfolio-corporate.jpg', 1100],
  ['portfolio-social-1.jpg', 1100],
  ['portfolio-social-2.jpg', 1100],
  ['digital-marketing-side.jpg', 1100],
  ['testimonial-avatar.jpg', 400],
  ['hero-bg.jpg', 1920]
]

let before = 0
let after = 0
for (const [file, edge] of TARGETS) {
  const src = path.join(SRC, file)
  if (!fs.existsSync(src)) { console.log('skip (missing):', src); continue }
  const out = path.join(OUT, file.replace(/\.[^.]+$/, '.webp'))
  const meta = await sharp(src).metadata()
  const landscape = (meta.width || 0) >= (meta.height || 0)
  await sharp(src)
    .rotate()
    .resize({ ...(landscape ? { width: edge } : { height: edge }), withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out)
  const b = fs.statSync(src).size
  const a = fs.statSync(out).size
  before += b; after += a
  console.log(`${src} ${meta.width}x${meta.height} ${(b/1048576).toFixed(2)}MB -> ${(a/1048576).toFixed(2)}MB`)
}
console.log(`\ntotal ${(before/1048576).toFixed(2)}MB -> ${(after/1048576).toFixed(2)}MB`)
