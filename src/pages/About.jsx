import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'
import './About.scss'

gsap.registerPlugin(ScrollTrigger)

export default function About() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pageRef = useRef(null)
  const siteReady = useSiteReady()

  const values = [
    { key: 'craft', num: '01' },
    { key: 'clarity', num: '02' },
    { key: 'partnership', num: '03' }
  ]

  const stats = [
    { key: 'founded', value: '2017' },
    { key: 'projects', value: '120+' },
    { key: 'clients', value: '40+' }
  ]

  useEffect(() => {
    let revertHeader
    let revertBody

    const ctx = gsap.context(() => {
      revertHeader = animateTextReveal('.about-header > *')
      revertBody = animateTextReveal(
        '.about-lede, .about-value h3, .about-value p, .about-stat-label, .about-cta .heading-2'
      )

      gsap.from('.about-media', {
        scrollTrigger: { trigger: '.about-intro', start: 'top 80%' },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      })

      gsap.from('.about-stat-value', {
        scrollTrigger: { trigger: '.about-stats', start: 'top 85%' },
        y: 24,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out'
      })
    }, pageRef)

    return () => {
      if (revertHeader) revertHeader()
      if (revertBody) revertBody()
      ctx.revert()
    }
  }, [])

  return (
    <div className="about-page" ref={pageRef}>
      <div className="container">
        <header className="about-header text-center">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h1 className="heading-1">{t('about.title')}</h1>
        </header>
      </div>

      <section className="about-intro section-padding">
        <div className="container">
          <div className="about-grid">
            <div className="about-copy">
              <p className="about-lede">{t('about.lede')}</p>
              <p className="about-lede about-lede--muted">{t('about.body')}</p>
            </div>

            <figure className="about-media">
              <video
                className="about-video"
                autoPlay
                loop
                muted
                playsInline
                preload={siteReady ? 'metadata' : 'none'}
                poster="/images/hero-bg.jpg"
              >
                {siteReady && <source src="/assets/viewfinder_hero.mp4" type="video/mp4" />}
              </video>
              <figcaption className="about-media-tag">{t('about.mediaCaption')}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="about-values section-padding">
        <div className="container">
          <div className="about-values-grid">
            {values.map((value) => (
              <article className="about-value" key={value.key}>
                <span className="about-value-num">{value.num}</span>
                <h3>{t(`about.values.${value.key}.title`)}</h3>
                <p>{t(`about.values.${value.key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-stats section-padding">
        <div className="container">
          <dl className="about-stats-grid">
            {stats.map((stat) => (
              <div className="about-stat" key={stat.key}>
                <dt className="about-stat-value">{stat.value}</dt>
                <dd className="about-stat-label">{t(`about.stats.${stat.key}`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="about-cta section-padding">
        <div className="container text-center">
          <h2 className="heading-2">{t('about.ctaTitle')}</h2>
          <button type="button" className="btn-primary" onClick={() => navigate('/contact')}>
            {t('nav.contactUsBtn')}
          </button>
        </div>
      </section>
    </div>
  )
}
