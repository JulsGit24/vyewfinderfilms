import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ShapeReveal from './ShapeReveal'
import './DigitalMarketing.scss'
import { useSiteReady } from '../utils/siteReady'

export default function DigitalMarketing() {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const siteReady = useSiteReady()

  /* Browsers won't reliably autoplay from a media-fragment range, and
     `loop` restarts the whole file rather than the fragment. So the
     segment is driven explicitly: seek to the start, and rewind once
     it passes the end. */
  useEffect(() => {
    const video = videoRef.current
    // Gated on the loader so 15 MB of footage does not compete with it.
    if (!siteReady || !video) return undefined
    const START = 1.5
    const END = 5.5

    const onReady = () => {
      video.currentTime = START
      video.play().catch(() => {})
    }
    video.load()
    const onTime = () => {
      if (video.currentTime >= END || video.currentTime < START - 0.1) {
        video.currentTime = START
      }
    }

    if (video.readyState >= 1) onReady()
    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('timeupdate', onTime)
    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('timeupdate', onTime)
    }
  }, [siteReady])

  return (
    <ShapeReveal
      id="dm"
      className="dm-section"
      shape="phone"
      eyebrow={t('digitalMarketing.eyebrow')}
      titleHtml={t('digitalMarketing.title')}
      lede={t('digitalMarketing.lede')}
      meta={[
        t('digitalMarketing.capabilities.strategy'),
        t('digitalMarketing.capabilities.campaigns'),
        t('digitalMarketing.capabilities.management')
      ]}
      ctaTo="/services/digital-marketing"
      ctaLabel={t('digitalMarketing.getStarted')}
      mediaTag={t('digitalMarketing.mediaTag')}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload={siteReady ? 'auto' : 'none'}
        poster="/images/digital-marketing-side.webp"
      >
        {/* Drop-in slot: the source file lives at
            media-src/assets/dm-section/loop.mp4 (see the README
            there). Replacing that file and re-running
            `npm run optimize:assets` swaps this clip with no
            code change. */}
        {siteReady && <source src="/assets/dm-section/loop.mp4" type="video/mp4" />}
      </video>
    </ShapeReveal>
  )
}
