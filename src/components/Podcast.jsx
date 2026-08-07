import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Podcast.scss'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'

gsap.registerPlugin(ScrollTrigger)

export default function Podcast() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const siteReady = useSiteReady()

  /* 42 MB of footage — by far the heaviest asset on the page, so it
     stays gated behind the loader. See utils/siteReady. */
  useEffect(() => {
    const video = videoRef.current
    if (!siteReady || !video) return
    video.load()
    video.play().catch(() => {})
  }, [siteReady])

  useEffect(() => {
    /* Same treatment as the Digital Marketing card — static frame,
       looping media, copy entrance only. See DigitalMarketing.jsx. */
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.podcast-section .eyebrow, .podcast-section .case-title, .podcast-section .case-lede, .podcast-section .case-meta li'
      )
    }, sectionRef)

    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section id="podcast" className="podcast-section section-padding" ref={sectionRef}>
      <div className="container">
        <article className="case-frame case-frame--reverse">
          <div className="case-body">
            <p className="eyebrow">{t('podcast.eyebrow')}</p>
            <h2 className="case-title" dangerouslySetInnerHTML={{ __html: t('podcast.title') }} />
            <p className="case-lede">
              {t('podcast.lede')}
            </p>

            <div className="case-foot">
              <ul className="case-meta">
                <li>{t('podcast.packages.audio')}</li>
                <li>{t('podcast.packages.audioVideo')}</li>
                <li>{t('podcast.packages.distribution')}</li>
              </ul>
              <Link to="/podcast" className="case-link">
                <span>{t('podcast.getStarted')}</span>
                <ArrowUpRight size={16} className="case-link-arrow" />
              </Link>
            </div>
          </div>

          <div className="case-media">
            <video
              ref={videoRef}
              className="case-video"
              autoPlay
              loop
              muted
              playsInline
              preload={siteReady ? 'auto' : 'none'}
              poster="/images/hero-bg.webp"
            >
              {siteReady && <source src="/assets/podcast_recording.mp4" type="video/mp4" />}
            </video>
            <span className="case-media-tag" aria-hidden="true">{t('podcast.mediaTag')}</span>
          </div>
        </article>
      </div>
    </section>
  )
}
