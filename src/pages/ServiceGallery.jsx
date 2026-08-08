import React, { useEffect, useRef } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import ScrollWall from '../components/ScrollWall'
import { getService } from '../data/services'
import './ServiceGallery.scss'

/* Full photo + video set for a single service, reached from the
   view-more tile that closes each row on /services. */
export default function ServiceGallery() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const pageRef = useRef(null)
  const service = getService(slug)

  /* returnObjects hands back the array; i18next returns the key string
     when the array is missing, hence the shape guard — same defensive
     shape Testimonials.jsx uses. */
  const rawKeywords = service?.keywordsKey ? t(service.keywordsKey, { returnObjects: true }) : null
  const keywords = Array.isArray(rawKeywords) ? rawKeywords.filter(Boolean) : []

  useEffect(() => {
    if (!service) return undefined
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.gallery-page h1, .gallery-page .subheading, .gallery-page .eyebrow, .gallery-page .service-highlight'
      )

      /* Chips are staggered rather than split: SplitType on a pill
         flickers, and these are short enough that a word ramp would
         read as broken text rather than as motion. */
      gsap.from('.service-keywords li', {
        opacity: 0,
        y: 10,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power3.out',
        delay: 0.25
      })
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [service])

  if (!service) return <Navigate to="/services" replace />

  return (
    <div className="gallery-page" ref={pageRef}>
      <div className="container">
        <Link to="/services" className="gallery-back">
          <ArrowLeft size={16} />
          <span>{t('gallery.back')}</span>
        </Link>

        <header className="gallery-header">
          <p className="eyebrow">{t('gallery.eyebrow')}</p>
          <h1 className="heading-1">{t(service.titleKey)}</h1>
          <p className="subheading">{t(service.descKey)}</p>

          {/* Chips render on the gallery pages only, not on the
              /services overview — that page is a scan-and-click index
              where each block is immediately followed by a media row,
              and six chips per block would bury the imagery. */}
          {keywords.length > 0 && (
            <ul className="service-keywords">
              {keywords.map((keyword) => (
                <li className="service-keyword" key={keyword}>{keyword}</li>
              ))}
            </ul>
          )}

          {service.highlightKey && (
            <p className="service-highlight">{t(service.highlightKey)}</p>
          )}
        </header>
      </div>

      {/* Photos and videos share one wall: the reference presents a
          single continuous surface, not sectioned rows. Video tiles
          show their poster and still expand on click. */}
      <section className="gallery-block" aria-label={t('gallery.work')}>
        <div className="container">
          <h2 className="gallery-block-title">{t('gallery.work')}</h2>
        </div>
        <ScrollWall items={service.media} />
      </section>

      <div className="container gallery-cta">
        <h2 className="heading-2">{t('gallery.ctaTitle')}</h2>
        <Link to="/contact" className="btn-primary">{t('nav.contactUsBtn')}</Link>
      </div>
    </div>
  )
}
