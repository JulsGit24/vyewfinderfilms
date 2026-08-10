import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight, Star } from 'lucide-react'
import './Testimonials.scss'
import { animateTextReveal } from '../utils/animations'

/* ==========================================================
   Testimonials — protocol3.framer.ai's carousel

   One review on screen at a time in a large panel, with a nav rail
   down the right: position counter at the top, then a stacked
   Next / Previous pair. The reference mirrors the two buttons
   (label-then-arrow on Next, arrow-then-label on Previous); that is
   kept, as is the soft glow behind the quote.

   What is NOT copied is the reference's palette and type — the
   panel, rules, glow and buttons all read from this site's
   --wst-color-* tokens and its own display face, so it inverts with
   the theme and sits with the rest of the page.

   No reviewer photos exist for these real people, so the avatar is
   a monogram rather than an invented face. Stars only render when
   the entry carries a real rating.

   Every slide stays mounted, stacked in one grid cell, so the panel
   is always as tall as the longest quote and stepping through never
   makes the page jump.
   ========================================================== */

const ROTATE_MS = 7000

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export default function Testimonials() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  /* returnObjects hands back the array; i18next returns the key string
     when the array is missing, hence the shape guard. Sorted shortest
     quote first, longest last — the panel's height already tracks the
     longest slide (see the file header), so opening on short reviews
     keeps the section compact before it grows into the longer ones. */
  const raw = t('testimonials.items', { returnObjects: true })
  const items = Array.isArray(raw)
    ? raw.filter((i) => i && i.quote).sort((a, b) => a.quote.length - b.quote.length)
    : []
  const count = items.length

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  /* Wraps in both directions so neither button is ever a dead end.
     Any use pins the carousel — someone driving it themselves should
     not have it move under them. */
  const go = (dir) => {
    setPinned(true)
    setActive((i) => (i + dir + count) % count)
  }

  useEffect(() => {
    if (count < 2 || pinned || reducedMotion) return undefined
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActive((i) => (i + 1) % count)
      }
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [count, pinned, reducedMotion])

  /* Only the header gets the site's text reveal. The panel is
     deliberately left to CSS: this subtree re-renders on every
     rotation, and GSAP from-tweens were observed leaving inline
     opacity stranded at 0 when a re-render landed mid-tween. */
  useEffect(() => {
    if (!count) return undefined
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.testimonials-section .section-header > *')
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [count])

  if (!count) return null

  return (
    <section className="testimonials-section section-padding" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <p className="eyebrow">{t('testimonials.eyebrow')}</p>
          <h2 className="testimonials-heading">{t('testimonials.title')}</h2>
        </div>

        <div className="testimonial-stage">
          <div className="testimonial-viewport" aria-live="polite">
            <span className="testimonial-glow" aria-hidden="true" />

            {items.map((item, i) => (
              <figure
                className={`testimonial-slide ${i === active ? 'is-active' : ''}`}
                key={`${item.author}-${item.quote.slice(0, 24)}`}
                aria-hidden={i !== active}
              >
                <span className="testimonial-avatar" aria-hidden="true">
                  {initialsOf(item.author)}
                </span>

                {typeof item.rating === 'number' && (
                  <div
                    className="testimonial-stars"
                    aria-label={t('testimonials.ratingLabel', { rating: item.rating })}
                  >
                    {Array.from({ length: item.rating }).map((_, s) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <Star key={s} size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    ))}
                  </div>
                )}

                <blockquote className="testimonial-quote">{item.quote}</blockquote>

                <figcaption className="testimonial-attribution">
                  <span className="testimonial-name">{item.author}</span>
                  {item.role && <span className="testimonial-role">{item.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="testimonial-rail">
            <p className="testimonial-counter">
              {t('testimonials.counter', { current: active + 1, total: count })}
            </p>

            {/* Mirrored like the reference: Next reads label-then-arrow,
                Previous reads arrow-then-label, so each button points
                the way it travels. */}
            <button
              type="button"
              className="testimonial-nav testimonial-nav--next"
              onClick={() => go(1)}
              aria-label={t('testimonials.next')}
            >
              <span>{t('testimonials.next')}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="testimonial-nav testimonial-nav--prev"
              onClick={() => go(-1)}
              aria-label={t('testimonials.prev')}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{t('testimonials.prev')}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
