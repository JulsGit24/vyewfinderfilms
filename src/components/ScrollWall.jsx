import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Expand } from 'lucide-react'
import Lightbox from './Lightbox'
import './ScrollWall.scss'

gsap.registerPlugin(ScrollTrigger)

/* ==========================================================
   ScrollWall

   Modelled on aicreatorawards.com. Measured behaviour of the
   reference, so the intent here is not guesswork:

     scrollY   col1     col2     col3     col4
       400     -180     +179     -179     +179
       900     -391     +390     -391     +390

   Four equal columns of same-size tiles. Adjacent columns translate
   in OPPOSITE directions, at the same magnitude, linear in scroll
   position. The images themselves never move — `transform: none` and
   `opacity: 1` on every one of them at every scroll position. All of
   the motion lives on the column wrapper, and each column wraps
   seamlessly (the reference jumps a tile by a full column height to
   loop).

   Reproduced here as a two-copy marquee track per column: the track
   holds the column's tiles twice and is translated within (-H, 0],
   where H is the height of one copy. At either end of that range the
   two copies line up exactly, so the loop has no seam and needs no
   per-tile bookkeeping.

   Tiles show `thumb` (800 px WebP / 720 p muted clip); the lightbox
   is the only thing that ever requests `full`.
   ========================================================== */

const DEFAULT_COLUMNS = 4
const MIN_TILES_PER_COLUMN = 4

/* Pixels of travel per pixel of scroll. The reference moves ~211px
   over 500px of scroll (0.42); rounded down slightly so the wall
   reads as drift rather than a race. */
const SPEED = 0.4

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const useColumnCount = (max) => {
  const [count, setCount] = useState(max)

  useEffect(() => {
    const read = () => {
      const w = window.innerWidth
      if (w <= 620) setCount(Math.min(2, max))
      else if (w <= 1024) setCount(Math.min(3, max))
      else setCount(max)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [max])

  return count
}

export default function ScrollWall({ items, columns = DEFAULT_COLUMNS }) {
  const rootRef = useRef(null)
  const trackRefs = useRef([])
  const [open, setOpen] = useState(null)
  const columnCount = useColumnCount(columns)

  /* Dealt round-robin so neighbouring tiles in a column are not
     neighbours in the source order — with a small media set that is
     what stops one column reading as a repeat of the one beside it. */
  const dealt = useMemo(() => {
    if (!items.length) return []
    const cols = Array.from({ length: columnCount }, () => [])
    const needed = columnCount * MIN_TILES_PER_COLUMN
    const total = Math.max(items.length, needed)
    for (let i = 0; i < total; i += 1) {
      const item = items[i % items.length]
      cols[i % columnCount].push({ ...item, sourceIndex: i % items.length })
    }
    return cols
  }, [items, columnCount])

  useLayoutEffect(() => {
    const root = rootRef.current
    const tracks = trackRefs.current.filter(Boolean)
    if (!root || !tracks.length) return undefined

    if (prefersReducedMotion()) {
      tracks.forEach((t) => gsap.set(t, { y: 0 }))
      return undefined
    }

    const setters = tracks.map((t) => gsap.quickSetter(t, 'y', 'px'))
    let heights = []

    const measure = () => {
      // One copy of the tiles: the track renders them twice.
      heights = tracks.map((t) => t.scrollHeight / 2)
    }

    const apply = (scroll) => {
      tracks.forEach((track, i) => {
        const h = heights[i]
        if (!h) return
        const dir = i % 2 === 0 ? -1 : 1
        const m = (scroll * SPEED) % h
        /* Both directions resolve into (-H, 0], the only range where
           the duplicated copies overlap the viewport continuously. */
        setters[i](dir < 0 ? -m : m - h)
      })
    }

    measure()

    const trigger = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => apply(self.scroll()),
      onRefresh: (self) => {
        measure()
        apply(self.scroll())
      }
    })

    apply(window.scrollY)

    /* Tiles are lazy-loaded, so the track grows after first paint and
       the measured copy height would otherwise be stale. */
    const observer = new ResizeObserver(() => {
      measure()
      apply(trigger.scroll())
    })
    tracks.forEach((t) => observer.observe(t))

    return () => {
      observer.disconnect()
      trigger.kill()
    }
  }, [dealt])

  /* Only the tiles actually on screen decode video.
     Every tile video used to autoplay at once — and with both marquee
     copies rendered that is two decoders per clip, running whether or
     not the wall was even in view. Video decode competes with the
     compositor for the same frame budget, which is what made the
     gallery pages stutter. src is also attached on first sight rather
     than at render, so a gallery of 24 clips does not open 24
     connections up front. */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const videos = [...root.querySelectorAll('video')]
    if (!videos.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target
          if (entry.isIntersecting) {
            if (!video.getAttribute('src') && video.dataset.src) {
              video.setAttribute('src', video.dataset.src)
            }
            const played = video.play()
            if (played?.catch) played.catch(() => {})
          } else if (!video.paused) {
            video.pause()
          }
        })
      },
      { rootMargin: '150px 0px' }
    )

    videos.forEach((v) => observer.observe(v))
    return () => observer.disconnect()
  }, [dealt])

  if (!items.length) return null

  const heightMultiplier = Math.max(2, items.length / 8)

  return (
    <>
      <div
        className="scroll-wall"
        ref={rootRef}
        style={{
          '--wall-columns': columnCount,
          '--wall-height': `calc(clamp(560px, 88vh, 940px) * ${heightMultiplier})`
        }}
      >
        {dealt.map((col, colIndex) => (
          // eslint-disable-next-line react/no-array-index-key
          <div className="scroll-wall-col" key={`col-${colIndex}`}>
            <div
              className="scroll-wall-track"
              ref={(el) => { trackRefs.current[colIndex] = el }}
            >
              {/* Rendered twice — the second copy is what the first
                  wraps into. Marked aria-hidden so the duplicate is
                  not announced. */}
              {[0, 1].map((copy) =>
                col.map((tile, tileIndex) => (
                  <button
                    type="button"
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${copy}-${colIndex}-${tileIndex}`}
                    className="wall-tile"
                    aria-hidden={copy === 1 || undefined}
                    tabIndex={copy === 1 ? -1 : undefined}
                    onClick={() => setOpen(tile.sourceIndex)}
                    aria-label={tile.label}
                  >
                    {tile.type === 'video' ? (
                      <video
                        data-src={tile.thumb}
                        poster={tile.poster}
                        width={tile.width}
                        height={tile.height}
                        muted
                        loop
                        playsInline
                        preload="none"
                      />
                    ) : (
                      <img
                        src={tile.thumb}
                        alt=""
                        width={tile.width}
                        height={tile.height}
                        loading="lazy"
                        decoding="async"
                        draggable="false"
                      />
                    )}
                    <span className="wall-tile-hover" aria-hidden="true">
                      <Expand size={22} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  )
}
