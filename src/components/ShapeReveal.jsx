import React, { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './ShapeReveal.scss'

gsap.registerPlugin(ScrollTrigger)

/* ==========================================================
   ShapeReveal — scroll-driven mask reveal (serotoninn.com style)

   A pinned, viewport-height stage. The section's video plays inside
   a shaped window (an iPhone for Digital Marketing, a microphone for
   Podcast, a camera for Photography) that starts small and grows
   under scroll control until
   its solid interior covers the whole viewport, at which point the
   closing copy (lede, capabilities, CTA) fades in over the footage.

   How the zoom works — transforms only, so it stays on the
   compositor and never repaints the video:

   - `.shape-mask` is a 100vmin square carrying the clip-path. GSAP
     scales it up from `s0` to a runtime-computed `sEnd`.
   - `.shape-video-fit` inside it is a 100vw × 100vh box holding the
     video, counter-scaled by `1/s`. Net video size is therefore
     always exactly the viewport: the footage appears fixed while
     the window over it grows — the same illusion the reference
     uses. `object-fit: cover` absorbs any source resolution, which
     is also what makes both sections render at identical sizes
     regardless of how each video was shot.

   Both silhouettes are drawn so the centered square from (0.3,0.3)
   to (0.7,0.7) of their unit box is solid. That shared "core" gives
   one end-scale formula for any viewport: the shape covers the
   screen once  0.2 · vmin · s  ≥  max(vw, vh) / 2.  Computed at
   runtime (and on refresh) instead of hardcoded, because portrait
   phones need roughly half again more zoom than a 16:9 desktop.

   The scale ramp is exponential, not linear — s(p) = s0·(sEnd/s0)^p
   — so the zoom reads at a constant rate to the eye instead of
   feeling fast at first and dead at the end.
   ========================================================== */

/* clipPath children union together, so each silhouette is plain
   primitives in objectBoundingBox (0..1) coordinates. */
const SHAPES = {
  /* iPhone, front-on: tall rounded slab plus the side buttons that
     make the silhouette read as a phone rather than a pill — mute
     switch and volume on the left, power on the right. The body slab
     spans the solid core. */
  phone: (
    <>
      <rect x="0.28" y="0.06" width="0.44" height="0.88" rx="0.10" />
      <rect x="0.255" y="0.24" width="0.028" height="0.055" rx="0.014" />
      <rect x="0.255" y="0.33" width="0.028" height="0.09" rx="0.014" />
      <rect x="0.255" y="0.44" width="0.028" height="0.09" rx="0.014" />
      <rect x="0.717" y="0.35" width="0.028" height="0.14" rx="0.014" />
    </>
  ),
  /* Camcorder side profile: body, lens barrel, flared hood, top
     handle on two posts. Body spans the solid core. */
  camera: (
    <>
      <rect x="0.12" y="0.28" width="0.60" height="0.46" rx="0.07" />
      <rect x="0.70" y="0.38" width="0.10" height="0.28" rx="0.02" />
      <path d="M0.78,0.34 L0.94,0.27 L0.94,0.77 L0.78,0.70 Z" />
      <rect x="0.20" y="0.14" width="0.34" height="0.10" rx="0.05" />
      <rect x="0.25" y="0.20" width="0.07" height="0.12" />
      <rect x="0.42" y="0.20" width="0.07" height="0.12" />
    </>
  ),
  /* Studio microphone: capsule pill (the solid core), yoke arms,
     neck and round desk base. */
  mic: (
    <>
      <rect x="0.26" y="0.04" width="0.48" height="0.72" rx="0.12" />
      <rect x="0.16" y="0.26" width="0.055" height="0.30" rx="0.027" />
      <rect x="0.785" y="0.26" width="0.055" height="0.30" rx="0.027" />
      <rect x="0.46" y="0.76" width="0.08" height="0.11" />
      <ellipse cx="0.50" cy="0.90" rx="0.16" ry="0.035" />
    </>
  )
}

/* Half-extent of the guaranteed-solid core square both shapes share. */
const CORE = 0.2

/* The mask's center sits at 58% of the stage height (see the SCSS),
   8% below the viewport center — the top edge of the screen is that
   much farther from the zoom origin, and the coverage math has to
   account for it. */
const CENTER_OFFSET = 0.08

export default function ShapeReveal({
  id,
  sectionId,
  className = '',
  shape,
  eyebrow,
  titleHtml,
  lede,
  meta = [],
  ctaTo,
  ctaLabel,
  mediaTag,
  children
}) {
  const sectionRef = useRef(null)
  const maskRef = useRef(null)
  const fitRef = useRef(null)
  const headingRef = useRef(null)
  const overlayRef = useRef(null)

  const clipId = `shape-clip-${id}`

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mask = maskRef.current
      const fit = fitRef.current

      const setScale = (s) => {
        gsap.set(mask, { scale: s })
        gsap.set(fit, { scale: 1 / s })
      }

      const mm = gsap.matchMedia()
      mm.add(
        {
          isMobile: '(max-width: 900px)',
          reduce: '(prefers-reduced-motion: reduce)',
          noReduce: '(prefers-reduced-motion: no-preference)'
        },
        (mmCtx) => {
          const { isMobile, reduce } = mmCtx.conditions

          /* Reduced motion: no pin, no zoom. The stage shows the
             shape at a fixed readable size with all copy visible —
             the section still makes sense as a static composition. */
          if (reduce) {
            setScale(isMobile ? 0.72 : 0.5)
            gsap.set(overlayRef.current, { autoAlpha: 1 })
            return
          }

          /* vmin is small on portrait phones, so the resting shape
             needs a larger share of it to read at all. */
          const s0 = isMobile ? 0.62 : 0.42

          const dims = { sEnd: 4 }
          const measure = () => {
            const vw = window.innerWidth
            const vh = window.innerHeight
            /* Farthest viewport edge from the zoom origin: half the
               width, or half the height plus the center offset
               (whichever wins) — that edge must land inside the
               shape's solid core. 1.08 is rounding margin. */
            const reach = Math.max(vw / 2, vh / 2 + CENTER_OFFSET * vh)
            dims.sEnd = (reach / (CORE * Math.min(vw, vh))) * 1.08
          }
          measure()

          const proxy = { p: 0 }
          const apply = () => setScale(s0 * Math.pow(dims.sEnd / s0, proxy.p))

          /* Before the first paint, or the un-scaled 100vmin shape
             flashes for a frame. */
          apply()
          gsap.set(overlayRef.current, { autoAlpha: 0 })

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top top',
              end: '+=230%',
              pin: true,
              scrub: true,
              invalidateOnRefresh: true,
              onRefresh: measure
            }
          })

          tl.to(proxy, { p: 1, ease: 'none', duration: 0.8, onUpdate: apply }, 0.02)
            .to(headingRef.current, { autoAlpha: 0, yPercent: -28, ease: 'none', duration: 0.28 }, 0.02)
            .fromTo(
              overlayRef.current,
              { autoAlpha: 0, y: 26 },
              { autoAlpha: 1, y: 0, ease: 'none', duration: 0.16 },
              0.82
            )
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id={sectionId} className={`shape-scene ${className}`} ref={sectionRef}>
      <div className="shape-stage">
        <div className="shape-heading" ref={headingRef}>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="shape-title" dangerouslySetInnerHTML={{ __html: titleHtml }} />
        </div>

        <div
          className="shape-mask"
          ref={maskRef}
          style={{ clipPath: `url(#${clipId})`, WebkitClipPath: `url(#${clipId})` }}
        >
          <div className="shape-video-fit" ref={fitRef}>
            {children}
          </div>
        </div>

        <div className="shape-overlay" ref={overlayRef}>
          <div className="shape-overlay-copy">
            <p className="shape-lede">{lede}</p>
            <div className="shape-overlay-foot">
              <ul className="case-meta">
                {meta.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link to={ctaTo} className="case-link">
                <span>{ctaLabel}</span>
                <ArrowUpRight size={16} className="case-link-arrow" />
              </Link>
            </div>
          </div>
          <span className="shape-tag" aria-hidden="true">{mediaTag}</span>
        </div>

        <svg className="shape-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              {SHAPES[shape]}
            </clipPath>
          </defs>
        </svg>
      </div>
    </section>
  )
}
