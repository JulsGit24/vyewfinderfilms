import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ShapeReveal from './ShapeReveal'
import './Podcast.scss'
import { useSiteReady } from '../utils/siteReady'

export default function Podcast() {
  const { t } = useTranslation()
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

  return (
    <ShapeReveal
      id="podcast"
      sectionId="podcast"
      className="podcast-section"
      shape="mic"
      eyebrow={t('podcast.eyebrow')}
      titleHtml={t('podcast.title')}
      lede={t('podcast.lede')}
      meta={[
        t('podcast.packages.audio'),
        t('podcast.packages.audioVideo'),
        t('podcast.packages.distribution')
      ]}
      ctaTo="/podcast"
      ctaLabel={t('podcast.getStarted')}
      mediaTag={t('podcast.mediaTag')}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload={siteReady ? 'auto' : 'none'}
        poster="/images/hero-bg.webp"
      >
        {siteReady && <source src="/assets/podcast_recording.mp4" type="video/mp4" />}
      </video>
    </ShapeReveal>
  )
}
