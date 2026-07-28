import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import MediaGrid from '../components/MediaGrid'
import { services, PREVIEW_COUNT } from '../data/services'
import './ServicesPage.scss'

export default function ServicesPage() {
  const { t } = useTranslation()
  const pageRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.services-page h1, .services-page h2, .services-page .subheading'
      )
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <div className="services-page" ref={pageRef}>
      <div className="container text-center services-page-header">
        <p className="eyebrow">{t('servicesPage.eyebrow')}</p>
        <h1 className="heading-1">{t('nav.services')}</h1>
        <p className="subheading">{t('servicesPage.lede')}</p>
      </div>

      {services.map((service) => (
        <section id={service.anchor} className="service-block" key={service.slug}>
          <div className="container service-block-head">
            <h2 className="heading-2">{t(service.titleKey)}</h2>
            <p className="subheading">{t(service.descKey)}</p>
          </div>

          {/* Tiles expand in place; the row is closed on the right by
              the link through to this service's full gallery. */}
          <MediaGrid
            items={service.media.slice(0, PREVIEW_COUNT)}
            moreHref={`/services/${service.slug}`}
            moreLabel={t('servicesPage.viewMore')}
          />
        </section>
      ))}
    </div>
  )
}
