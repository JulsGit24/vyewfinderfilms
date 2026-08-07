import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Star } from 'lucide-react'
import './Testimonials.scss'
import { animateTextReveal } from '../utils/animations'

gsap.registerPlugin(ScrollTrigger)

/* ==========================================================
   Testimonials

   Renders however many entries exist in `testimonials.items`, so
   adding or replacing a review is a translation-file edit and needs
   no change here. Each entry is { quote, author, role?, rating? }.

   The section removes itself when the list is empty rather than
   rendering a heading with nothing under it.
   ========================================================== */
export default function Testimonials() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)

  /* returnObjects hands back the array; i18next returns the key string
     when the array is missing, hence the shape guard. */
  const raw = t('testimonials.items', { returnObjects: true })
  const items = Array.isArray(raw) ? raw.filter((i) => i && i.quote) : []
  const count = items.length

  useEffect(() => {
    if (!count) return undefined
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.testimonials-section .section-header > *, .testimonials-section blockquote, .testimonials-section .testimonial-name'
      )

      gsap.from('.testimonial-card', {
        scrollTrigger: {
          trigger: '.testimonial-grid',
          start: 'top 85%',
          end: 'top 40%',
          scrub: 0.5
        },
        y: 60,
        scale: 0.92,
        opacity: 0,
        stagger: 0.08,
        ease: 'power3.out'
      })
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
          <h2 className="heading-2">{t('testimonials.title')}</h2>
        </div>

        <div className={`testimonial-grid testimonial-grid--${Math.min(count, 3)}`}>
          {items.map((item) => (
            <figure className="testimonial-card" key={`${item.author}-${item.quote.slice(0, 24)}`}>
              <div className="testimonial-stars" aria-label={`${item.rating || 5} out of 5`}>
                {Array.from({ length: item.rating || 5 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Star key={i} size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                ))}
              </div>
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                <span className="testimonial-name">{item.author}</span>
                {item.role && <span className="testimonial-role">{item.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
