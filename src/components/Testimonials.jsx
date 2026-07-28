import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Testimonials.scss'
import { animateTextReveal } from '../utils/animations'

gsap.registerPlugin(ScrollTrigger)

export default function Testimonials() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.testimonials-section .section-header > *, .testimonials-section blockquote, .testimonials-section .testimonial-name'
      )

      gsap.from('.testimonial-card', {
        scrollTrigger: {
          trigger: '.testimonial-card',
          start: 'top 85%',
          end: 'top 40%',
          scrub: 0.5
        },
        y: 60,
        scale: 0.92,
        opacity: 0,
        ease: 'power3.out'
      })
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section className="testimonials-section section-padding" ref={sectionRef}>
      <div className="container">
        <div className="section-header text-center">
          <h2 className="heading-2">{t('testimonials.title')}</h2>
        </div>

        <div className="testimonial-card">
          <img src="/images/testimonial-avatar.jpg" alt="Alexa Young" className="testimonial-avatar" />
          <blockquote>
            {t('testimonials.quote')}
          </blockquote>
          <span className="testimonial-name">{t('testimonials.author')}</span>
        </div>
      </div>
    </section>
  )
}
