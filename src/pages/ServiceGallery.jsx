import React, { useEffect, useRef } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import MediaGrid from '../components/MediaGrid'
import { getService } from '../data/services'
import './ServiceGallery.scss'

/* Full photo + video set for a single service, reached from the
   view-more tile that closes each row on /services. */
export default function ServiceGallery() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const pageRef = useRef(null)
  const service = getService(slug)

  useEffect(() => {
    if (!service) return undefined
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.gallery-page h1, .gallery-page .subheading, .gallery-page .eyebrow')
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [service])

  if (!service) return <Navigate to="/services" replace />

  const photos = service.media.filter((m) => m.type !== 'video')
  const videos = service.media.filter((m) => m.type === 'video')

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
        </header>
      </div>

      <section className="gallery-block" aria-label={t('gallery.photos')}>
        <div className="container">
          <h2 className="gallery-block-title">{t('gallery.photos')}</h2>
        </div>
        <MediaGrid items={photos} columns={4} />
      </section>

      {videos.length > 0 && (
        <section className="gallery-block" aria-label={t('gallery.videos')}>
          <div className="container">
            <h2 className="gallery-block-title">{t('gallery.videos')}</h2>
          </div>
          <MediaGrid items={videos} columns={4} />
        </section>
      )}

      <div className="container gallery-cta">
        <h2 className="heading-2">{t('gallery.ctaTitle')}</h2>
        <Link to="/contact" className="btn-primary">{t('nav.contactUsBtn')}</Link>
      </div>
    </div>
  )
}
