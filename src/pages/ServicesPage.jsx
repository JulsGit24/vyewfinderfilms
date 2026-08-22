import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import MediaGrid from '../components/MediaGrid'
import Seo from '../components/Seo'
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

  const randomPreviews = React.useMemo(() => {
    return services.map(service => {
      // Filter out videos if we specifically want "5 random images" as requested, 
      // or just shuffle all media. The prompt said "5 random images", so let's filter for images.
      const imagesOnly = service.media.filter(m => m.type === 'image')
      const shuffled = [...imagesOnly].sort(() => 0.5 - Math.random())
      return {
        ...service,
        previewMedia: shuffled.slice(0, PREVIEW_COUNT)
      }
    })
  }, [])

  return (
    <div className="services-page" ref={pageRef}>
      <Seo titleKey="seo.services.title" descriptionKey="seo.services.description" />
      {/* servicesPage.lede was already written and translated but never
          rendered, leaving the H1 alone above ~200px of padding. The
          existing animateTextReveal selector above already covers
          .services-page .subheading, so it picks up the word ramp. */}
      <div className="container text-center services-page-header">
        <h1 className="heading-1">{t('servicesPage.eyebrow')}</h1>
        <p className="subheading">{t('servicesPage.lede')}</p>
      </div>

      {randomPreviews.map((service) => (
        <section id={service.anchor} className="service-block" key={service.slug}>
          <div className="container service-block-head">
            <h2 className="heading-2">{t(service.titleKey)}</h2>
            <p className="subheading">{t(service.descKey)}</p>
          </div>

          {/* Tiles expand in place; the row is closed on the right by
              the link through to this service's full gallery. */}
          <MediaGrid
            items={service.previewMedia}
            moreHref={`/services/${service.slug}`}
            moreLabel={t('servicesPage.viewMore')}
          />
        </section>
      ))}
    </div>
  )
}
