import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ArrowUpRight, Plus, Minus } from 'lucide-react'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'
import './PodcastPage.scss'

/* ==========================================================
   Podcast page

   Layout follows hubermanlab.com — a full-bleed dark hero card with
   an oversized, tightly-tracked headline over a pill CTA, then
   rounded media cards, chip-labelled formats and generous whitespace.
   The typography, colour tokens and section rhythm stay Vyewfinder's.

   COPY SOURCE: chatbot/vyewfinder_films_chatbot_knowledge_base.md.
   Formats and the FAQ come from §7.4 and §18.4, the workflow from
   §18.9, and the audiences from §10.

   Deliberately absent, because §24 forbids stating them without owner
   approval and none is on file: prices, packages, turnaround times,
   revision counts, equipment or crew lists, and any claim to a
   podcast studio (§18.4 is explicit that a studio is not confirmed).
   Recording location is described as something scoped with the
   client instead.
   ========================================================== */

const FORMAT_KEYS = ['video', 'audio', 'live', 'editing', 'clips', 'launch']
const STEP_KEYS = ['discovery', 'scope', 'production', 'post', 'delivery']
const AUDIENCE_KEYS = ['business', 'personal', 'church', 'creative']
const FAQ_KEYS = ['produce', 'studio', 'clips', 'existing', 'cost', 'platforms']

export default function PodcastPage() {
  const { t } = useTranslation()
  const pageRef = useRef(null)
  const videoRef = useRef(null)
  const siteReady = useSiteReady()
  const [openFaq, setOpenFaq] = useState(null)

  /* The <source> is withheld until the loader releases, and a source
     added after the element has already tried to load needs an
     explicit load() — see utils/siteReady. */
  useEffect(() => {
    const video = videoRef.current
    if (!siteReady || !video) return
    video.load()
  }, [siteReady])

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.podcast-page h1, .podcast-page h2, .podcast-page .eyebrow, .podcast-page .podcast-lede'
      )
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <div className="podcast-page" ref={pageRef}>
      {/* ---- hero ---- */}
      <section className="podcast-hero" data-nav-tone="dark">
        <div className="container">
          <div className="podcast-hero-card">
            <video
              ref={videoRef}
              className="podcast-hero-video"
              autoPlay
              muted
              loop
              playsInline
              poster="/images/portfolio-podcast.webp"
              preload={siteReady ? 'auto' : 'none'}
            >
              {siteReady && <source src="/assets/podcast_recording.mp4" type="video/mp4" />}
            </video>
            <div className="podcast-hero-scrim" aria-hidden="true" />

            <div className="podcast-hero-body">
              <p className="eyebrow">{t('podcastPage.eyebrow')}</p>
              <h1 className="podcast-hero-title">{t('podcastPage.title')}</h1>
              <p className="podcast-hero-lede">{t('podcastPage.lede')}</p>
              <div className="podcast-hero-actions">
                <Link to="/contact" className="podcast-pill">
                  {t('podcastPage.cta')}
                </Link>
                <a href="#formats" className="podcast-pill podcast-pill--ghost">
                  {t('podcastPage.ctaSecondary')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- formats ---- */}
      <section className="podcast-block" id="formats">
        <div className="container">
          <header className="podcast-block-head">
            <p className="eyebrow">{t('podcastPage.formats.eyebrow')}</p>
            <h2 className="heading-2">{t('podcastPage.formats.title')}</h2>
            <p className="podcast-lede">{t('podcastPage.formats.lede')}</p>
          </header>

          <ul className="podcast-format-grid">
            {FORMAT_KEYS.map((key) => (
              <li className="podcast-format" key={key}>
                <span className="podcast-chip">{t(`podcastPage.formats.items.${key}.chip`)}</span>
                <h3 className="podcast-format-title">{t(`podcastPage.formats.items.${key}.title`)}</h3>
                <p className="podcast-format-desc">{t(`podcastPage.formats.items.${key}.desc`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- process ---- */}
      <section className="podcast-block podcast-block--alt">
        <div className="container">
          <header className="podcast-block-head">
            <p className="eyebrow">{t('podcastPage.process.eyebrow')}</p>
            <h2 className="heading-2">{t('podcastPage.process.title')}</h2>
            <p className="podcast-lede">{t('podcastPage.process.lede')}</p>
          </header>

          <ol className="podcast-steps">
            {STEP_KEYS.map((key, i) => (
              <li className="podcast-step" key={key}>
                <span className="podcast-step-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="podcast-step-title">{t(`podcastPage.process.steps.${key}.title`)}</h3>
                <p className="podcast-step-desc">{t(`podcastPage.process.steps.${key}.desc`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- who it's for ---- */}
      <section className="podcast-block">
        <div className="container">
          <div className="podcast-split">
            <div className="podcast-split-body">
              <p className="eyebrow">{t('podcastPage.audience.eyebrow')}</p>
              <h2 className="heading-2">{t('podcastPage.audience.title')}</h2>
              <p className="podcast-lede">{t('podcastPage.audience.lede')}</p>
              <ul className="podcast-audience">
                {AUDIENCE_KEYS.map((key) => (
                  <li key={key}>{t(`podcastPage.audience.items.${key}`)}</li>
                ))}
              </ul>
            </div>
            <div className="podcast-split-media">
              <img
                src="/images/portfolio-podcast.webp"
                alt=""
                loading="lazy"
                decoding="async"
                width="720"
                height="1280"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="podcast-block podcast-block--alt">
        <div className="container">
          <header className="podcast-block-head">
            <p className="eyebrow">{t('podcastPage.faq.eyebrow')}</p>
            <h2 className="heading-2">{t('podcastPage.faq.title')}</h2>
          </header>

          <div className="podcast-faq">
            {FAQ_KEYS.map((key) => {
              const isOpen = openFaq === key
              return (
                <div className={`podcast-faq-item ${isOpen ? 'is-open' : ''}`} key={key}>
                  <h3>
                    <button
                      type="button"
                      className="podcast-faq-q"
                      aria-expanded={isOpen}
                      aria-controls={`faq-${key}`}
                      onClick={() => setOpenFaq(isOpen ? null : key)}
                    >
                      <span>{t(`podcastPage.faq.items.${key}.q`)}</span>
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </button>
                  </h3>
                  <div className="podcast-faq-a" id={`faq-${key}`} hidden={!isOpen}>
                    <p>{t(`podcastPage.faq.items.${key}.a`)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- closing CTA ---- */}
      <section className="podcast-cta">
        <div className="container">
          <h2 className="heading-2">{t('podcastPage.closing.title')}</h2>
          <p className="podcast-lede">{t('podcastPage.closing.lede')}</p>
          <Link to="/contact" className="podcast-pill">
            <span>{t('podcastPage.closing.cta')}</span>
            <ArrowUpRight size={16} />
          </Link>
          <p className="podcast-cta-note">{t('podcastPage.closing.note')}</p>
        </div>
      </section>
    </div>
  )
}
