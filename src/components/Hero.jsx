import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Hero.scss'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'

gsap.registerPlugin(ScrollTrigger)

export default function Hero() {
  const { t } = useTranslation()
  const heroRef = useRef(null)
  const videoRef = useRef(null)
  const siteReady = useSiteReady()

  /* Held back until the loader is gone — see utils/siteReady. Adding a
     <source> after mount does not trigger a fetch on its own, so the
     element has to be told to re-evaluate its sources. */
  useEffect(() => {
    const video = videoRef.current
    if (!siteReady || !video) return
    video.load()
    video.play().catch(() => {})
  }, [siteReady])

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      /* Forced entrance: the hero is above the fold, so there is no
         scroll range to scrub a reveal against. */
      revertText = animateTextReveal('.hero-content > *', { mode: 'entrance', delay: 0.3 })

      // Parallax: video moves slower on scroll
      gsap.to('.hero-bg-video', {
        yPercent: 25,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      })

      // Fade out hero content on scroll
      gsap.to('.hero-content', {
        opacity: 0,
        y: -50,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: '60% top',
          end: 'bottom top',
          scrub: true
        }
      })
    }, heroRef)

    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section id="home" className="hero-section" data-nav-tone="dark" ref={heroRef}>
      <div className="hero-bg">
        <video
          ref={videoRef}
          className="hero-bg-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/images/hero-bg.jpg"
          preload={siteReady ? 'auto' : 'none'}
        >
          {siteReady && <source src="/assets/viewfinder_hero.mp4" type="video/mp4" />}
        </video>
        <div className="hero-overlay"></div>
      </div>
      <div className="container">
        <div className="hero-content text-center">
          <p className="hero-meta">{t('hero.location')}</p>
          <h1 className="heading-1">VIEWFINDERFILMS</h1>
          <p className="hero-tagline">{t('hero.tagline')}</p>
          <p className="subheading">{t('hero.subheading')}</p>
          {/* Points at #stories — the old #work target was the Featured
              Work section, which has been removed. */}
          <a href="#stories" className="btn-primary">{t('hero.btn')}</a>
        </div>
      </div>
    </section>
  )
}
