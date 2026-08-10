import { gsap } from 'gsap'
import { Instagram as InstagramIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { animateTextReveal } from '../utils/animations'
import './Instagram.scss'

const images = [
  '/images/portfolio-corporate.webp',
  '/images/portfolio-social-1.webp',
  '/images/portfolio-social-2.webp',
  '/images/digital-marketing-side.webp',
  '/images/hero-bg.webp',
  '/images/testimonial-avatar.webp'
]

export default function Instagram() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)

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

  return (
    <section className="instagram-section" ref={sectionRef}>
      <div className="container text-center">
        <h2 className="heading-2">{t('instagram.title')}</h2>
      </div>
      <div className="instagram-grid">
        {images.map((src, index) => (
          <a
            key={index}
            className="instagram-item"
            href="https://www.instagram.com/vyewfinderfilms/"
            target="_blank"
            rel="noreferrer noopener"
          >
            <img src={src} alt="Instagram post" loading="lazy" />
            <div className="instagram-hover">
              <InstagramIcon size={22} />
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
