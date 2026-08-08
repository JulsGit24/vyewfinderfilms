import { Splide, SplideSlide } from '@splidejs/react-splide'
import '@splidejs/splide/dist/css/splide.min.css'
import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { animateTextReveal } from '../utils/animations'
import './Instagram.scss'

/* ==========================================================
   Instagram Reels

   Replaces the shuffled Digital Marketing stills that used to fill
   this grid: those were only ever a stopgap for having no real
   Instagram content, and putting them next to genuine posts under a
   "Follow Us On Instagram" heading would read as if they were posts.
   The same image pool still renders on /services/digital-marketing —
   only this component stopped calling it.

   This is the codebase's first third-party embed script. Instagram's
   public oEmbed widget needs no Meta app, no Graph API token and no
   credentials — it is the markup any post's own "Embed" share option
   hands out. It is NOT the authenticated feed that was ruled out in
   an earlier round.
   ========================================================== */

/* Client-supplied public reels (all @vyewfinderfilms, all verified
   public 2026-08-08). Newest first. Adding or removing one is an edit
   to this array only. Shortcodes, not full URLs — the permalink is
   built below. */
const REELS = ['DXsPvORBaAi', 'DWFP5pKlFJZ', 'DVzOTKtlIyv', 'C3Ts7t5sZLR', 'C2dbMlIO4hJ']

const EMBED_SRC = 'https://www.instagram.com/embed.js'
const PROFILE_URL = 'https://www.instagram.com/vyewfinderfilms/'

/* Instagram's own recommended inline style. It carries a hard
   `min-width: 326px` that the widget re-applies to the iframe it
   swaps in, which is what dictates the carousel's breakpoints — see
   Instagram.scss. */
const BLOCKQUOTE_STYLE = {
  background: '#FFF',
  border: 0,
  borderRadius: '3px',
  boxShadow: '0 0 1px 0 rgba(0,0,0,0.5), 0 1px 10px 0 rgba(0,0,0,0.15)',
  margin: '1px',
  maxWidth: '540px',
  minWidth: '326px',
  padding: 0,
  width: '99.375%'
}

/* Read once per mount rather than held in state: state that changes
   would re-render the blockquotes, and the widget owns that subtree
   the moment it has processed them. */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ArrowIcon = ({ flip }) => (
  <svg viewBox="0 0 24 18" width="24" height="18" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
    <path fill="currentColor" d="M23.999,8H5.481c5.009-2.91,6.349-7.311,6.416-7.548L9.976-0.102C9.9,0.156,8.03,6.213-0.073,8.024L0.146,9l-0.218,0.976C8.03,11.787,9.9,17.844,9.976,18.101l1.922-0.554C11.83,17.31,10.49,12.91,5.481,10h18.518V8z"/>
  </svg>
)

export default function Instagram() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)
  const splideRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.instagram-section .heading-2')
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  /* embed.js is global and loads once, but this is a client-side-routed
     SPA: a full page load happens on first arrival only, while this
     component remounts on every navigation back to `/`. The script
     therefore has to be left in place on unmount and `process()`
     re-invoked against the fresh blockquotes instead. */
  useEffect(() => {
    const process = () => window.instgrm?.Embeds?.process()

    if (window.instgrm?.Embeds?.process) {
      process()
      return undefined
    }

    /* Already requested by an earlier mount that has since unmounted —
       wait for the same tag rather than adding a second one. */
    const pending = document.querySelector(`script[src*="instagram.com/embed.js"]`)
    if (pending) {
      pending.addEventListener('load', process, { once: true })
      return () => pending.removeEventListener('load', process)
    }

    const script = document.createElement('script')
    script.src = EMBED_SRC
    script.async = true
    script.addEventListener('load', process, { once: true })
    document.body.appendChild(script)
    /* Deliberately never removed: it is a global script, and tearing it
       down on every route change would thrash. Only the listener is
       cleaned up. */
    return () => script.removeEventListener('load', process)
  }, [])

  return (
    <section className="instagram-section" ref={sectionRef}>
      <div className="container text-center">
        <h2 className="heading-2">{t('instagram.title')}</h2>
        <p className="subheading">{t('instagram.lede')}</p>
      </div>

      <div className="instagram-reels">
        <Splide
          ref={splideRef}
          options={{
            /* NOT 'loop'. Splide's loop mode clones slides with
               cloneNode and React never sees the clones — a cloned
               instagram-media blockquote would either be processed a
               second time by the widget or sit as dead un-hydrated
               markup. No clones, no problem. Same reason `focus:
               'center'` is not used. */
            type: 'slide',
            perPage: 3,
            perMove: 1,
            gap: '24px',
            pagination: true,
            arrows: false,
            autoplay: false,
            drag: true,
            speed: prefersReducedMotion() ? 0 : 600,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            breakpoints: {
              1100: { perPage: 2 },
              760: { perPage: 1 }
            }
          }}
          aria-label={t('instagram.title')}
        >
          {REELS.map((code) => (
            /* key is the shortcode, never the array index, so React can
               never re-use a node the widget has already rewritten. */
            <SplideSlide key={code}>
              <div className="instagram-reel-slide">
                {/* data-instgrm-captioned is deliberately omitted:
                    captions vary wildly in length and would make the
                    already-uneven card heights much worse. */}
                <blockquote
                  className="instagram-media"
                  data-instgrm-permalink={`https://www.instagram.com/reel/${code}/`}
                  data-instgrm-version="14"
                  style={BLOCKQUOTE_STYLE}
                >
                  <a
                    href={`https://www.instagram.com/reel/${code}/`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('instagram.visit')}
                  </a>
                </blockquote>
              </div>
            </SplideSlide>
          ))}
        </Splide>

        <div className="instagram-controls">
          <button
            type="button"
            className="instagram-arrow"
            aria-label="Previous"
            onClick={() => splideRef.current?.splide?.go('<')}
          >
            <ArrowIcon />
          </button>
          <button
            type="button"
            className="instagram-arrow"
            aria-label="Next"
            onClick={() => splideRef.current?.splide?.go('>')}
          >
            <ArrowIcon flip />
          </button>
        </div>
      </div>

      <div className="container text-center">
        <a
          className="btn-outline"
          href={PROFILE_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('instagram.visit')}
        >
          {t('instagram.follow')}
        </a>
      </div>
    </section>
  )
}
