import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { Star } from 'lucide-react'
import './Testimonials.scss'
import { animateTextReveal } from '../utils/animations'

/* ==========================================================
   Testimonials — single centered slide, dot pagination

   One review on screen at a time in a centered card: avatar
   monogram, star rating, quote, then attribution, with a row of
   dots below to jump between reviews. No reviewer photos exist for
   these real people, so the avatar is a monogram rather than an
   invented face — it stands in for the client-logo slot a review
   carousel would normally use. Stars only render when the entry
   carries a real rating.

   Every slide stays mounted, stacked in one grid cell, so the card
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
     quote first, longest last — the card's height already tracks the
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

  /* Jumping to a specific slide (dot click) pins the carousel — someone
     driving it themselves should not have it move under them. */
  const goTo = (i) => {
    setPinned(true)
    setActive(i)
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

  /* Only the header gets the site's text reveal. The card is
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
        <div className="section-header text-center">
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
        </div>

        <div className="testimonial-dots" role="tablist" aria-label={t('testimonials.title')}>
          {items.map((item, i) => (
            <button
              key={`dot-${item.author}-${item.quote.slice(0, 24)}`}
              type="button"
              role="tab"
              className={`testimonial-dot ${i === active ? 'is-active' : ''}`}
              aria-selected={i === active}
              aria-label={t('testimonials.goTo', { position: i + 1 })}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
