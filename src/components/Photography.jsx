import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ShapeReveal from './ShapeReveal'
import './Photography.scss'
import { useSiteReady } from '../utils/siteReady'

/* ==========================================================
   Photography scene

   The third ShapeReveal scene, reusing the same `camera` silhouette
   Digital Marketing uses. It sits after Podcast rather than next to
   Digital Marketing so the mic breaks up the two identical camera
   shapes — camera → mic → camera.

   Whole-file autoplay (the Podcast.jsx pattern), not
   DigitalMarketing.jsx's explicit in/out seek: the clip is a
   placeholder, so there are no known-good trim points to hardcode,
   and the drop-in README asks for a clip that loops on its own.
   ========================================================== */
export default function Photography() {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const siteReady = useSiteReady()
  const [inView, setInView] = useState(false)

  /* Third full-viewport video on the home page. siteReady alone is not
     enough of a gate at that point, so this one also waits until the
     scene is near the viewport — same IntersectionObserver approach
     Stories.jsx uses for its slides. */
  useEffect(() => {
    const scene = videoRef.current?.closest('.shape-scene')
    if (!scene || inView) return undefined

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    io.observe(scene)
    return () => io.disconnect()
  }, [inView])

  /* The <source> is withheld until both gates open, and a source added
     after the element has already tried to load needs an explicit
     load() — see utils/siteReady. */
  useEffect(() => {
    const video = videoRef.current
    if (!siteReady || !inView || !video) return
    video.load()
    video.play().catch(() => {})
  }, [siteReady, inView])

  return (
    <ShapeReveal
      id="photography"
      sectionId="photography"
      className="photography-section"
      shape="camera"
      eyebrow={t('photography.eyebrow')}
      titleHtml={t('photography.title')}
      lede={t('photography.lede')}
      meta={[
        t('photography.capabilities.product'),
        t('photography.capabilities.portraits'),
        t('photography.capabilities.property')
      ]}
      ctaTo="/services/photography"
      ctaLabel={t('photography.getStarted')}
      mediaTag={t('photography.mediaTag')}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload={siteReady && inView ? 'auto' : 'none'}
        poster="/images/portfolio-photography.webp"
      >
        {/* Drop-in slot: the source file lives at
            media-src/assets/photography-section/loop.mp4 (see the
            README there). Replacing that file and re-running
            `npm run optimize:assets` swaps this clip with no code
            change. The current file is a placeholder — real
            photography footage is still owed by the client. */}
        {siteReady && inView && <source src="/assets/photography-section/loop.mp4" type="video/mp4" />}
      </video>
    </ShapeReveal>
  )
}
