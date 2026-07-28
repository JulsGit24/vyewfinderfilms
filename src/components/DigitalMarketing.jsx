import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './DigitalMarketing.scss'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'

gsap.registerPlugin(ScrollTrigger)

const capabilities = ['Content Strategy', 'Paid Campaigns', 'Channel Management']

export default function DigitalMarketing() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)
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

  useEffect(() => {
    /* Matching the reference case studies: the frame itself carries no
       scroll transform, tilt or parallax — measured on the reference,
       its cards report `transform: none` at every scroll position and
       on hover. All of the life comes from the looping media instead.
       Only the copy gets a gentle entrance. */
    let revertText
    const ctx = gsap.context(() => {
      /* Named children rather than `.case-body > *`: the foot is a flex
         row wrapping a list and a link, and splitting a layout element
         rewrites its children out from under it. */
      revertText = animateTextReveal(
        '.dm-section .eyebrow, .dm-section .case-title, .dm-section .case-lede, .dm-section .case-meta li'
      )
    }, sectionRef)

    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section className="dm-section section-padding" ref={sectionRef}>
      <div className="container">
        <article className="case-frame">
          <div className="case-body">
            <p className="eyebrow">{t('digitalMarketing.eyebrow')}</p>
            <h2 className="case-title" dangerouslySetInnerHTML={{ __html: t('digitalMarketing.title') }} />
            <p className="case-lede">
              {t('digitalMarketing.lede')}
            </p>

            <div className="case-foot">
              <ul className="case-meta">
                <li>{t('digitalMarketing.capabilities.strategy')}</li>
                <li>{t('digitalMarketing.capabilities.campaigns')}</li>
                <li>{t('digitalMarketing.capabilities.management')}</li>
              </ul>
              <a href="#contact" className="case-link">
                <span>{t('digitalMarketing.getStarted')}</span>
                <ArrowUpRight size={16} className="case-link-arrow" />
              </a>
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
              poster="/images/digital-marketing-side.jpg"
            >
              {siteReady && <source src="/assets/loader_intro.mp4" type="video/mp4" />}
            </video>
            <span className="case-media-tag" aria-hidden="true">{t('digitalMarketing.mediaTag')}</span>
          </div>
        </article>
      </div>
    </section>
  )
}
