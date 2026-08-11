import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { ArrowUpRight, Play, Plus, Minus, Youtube } from 'lucide-react'
import { animateTextReveal } from '../utils/animations'
import { useCookieConsent } from '../context/CookieConsentContext'
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

/* 'live' (Live streaming) was removed at the client's request. Its
   podcastPage.formats.items.live.* strings are left in both locale
   files unreferenced — same call as the other round-2 orphans — since
   the copy is already translated and the format is a plausible
   reinstatement. */
const FORMAT_KEYS = ['video', 'audio', 'editing', 'clips', 'launch']

/* Footer.jsx line 87 already links this exact handle; do not invent
   another one. */
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@vyewfinderfilmsrva'
const STEP_KEYS = ['discovery', 'scope', 'production', 'post', 'delivery']
const AUDIENCE_KEYS = ['business', 'personal', 'church', 'creative']
const FAQ_KEYS = ['produce', 'studio', 'clips', 'existing', 'cost', 'platforms']

export default function PodcastPage() {
  const { t } = useTranslation()
  const pageRef = useRef(null)
  const videoRef = useRef(null)
  const siteReady = useSiteReady()
  const [openFaq, setOpenFaq] = useState(null)
  const { consent, savePreferences, openSettings } = useCookieConsent()

  /* Content-driven: an empty array keeps today's single "visit the
     channel" facade (see the block below) exactly as it shipped last
     round. A real embedsocial-style spotlight-plus-list grid (autoplay
     muted spotlight, up to 4 more as click-through thumbnails) only
     replaces it once real video IDs exist here — a translation-file
     edit, same contract as testimonials.items. Populate each entry as
     { id: '<YouTube video ID>', title: '<short title>' }. */
  const rawVideos = t('podcastPage.youtube.videos', { returnObjects: true })
  const videos = Array.isArray(rawVideos) ? rawVideos.filter((v) => v && v.id) : []
  const [spotlight, ...rest] = videos

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

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

      {/* ---- YouTube channel ---- */}
      {/* Deliberately near-identical in title to the formats section
          above ("What we produce" / "This is what we produce") — both
          are the client's own wording for two distinct sections. The
          --alt surface at this boundary is what stops them reading as
          one duplicated block. */}
      <section className="podcast-block podcast-block--alt" id="youtube">
        <div className="container">
          {spotlight ? (
            /* Populated state: one autoplaying-muted vertical spotlight
               (embedsocial.com/templates/youtube-shorts-section/ is the
               reference — a large "now playing" Short plus a scrollable
               list of the rest) plus up to 4 more videos as
               click-through thumbnails. Thumbnails stay static images
               rather than more embeds — five simultaneous YouTube
               players would be a real performance cost for a section
               that isn't the page's main content. */
            <>
              <header className="podcast-block-head">
                <p className="eyebrow">{t('podcastPage.youtube.eyebrow')}</p>
                <h2 className="heading-2">{t('podcastPage.youtube.title')}</h2>
                <p className="podcast-lede">{t('podcastPage.youtube.lede')}</p>
                <a
                  className="podcast-pill podcast-youtube-cta"
                  href={YOUTUBE_CHANNEL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span>{t('podcastPage.youtube.cta')}</span>
                  <ArrowUpRight size={16} />
                </a>
              </header>

              <div className="podcast-youtube-grid">
                <div className="podcast-youtube-spotlight">
                  {!reducedMotion && !consent.functional ? (
                    /* This iframe is the one place on the site that would
                       load a live third-party embed setting its own
                       cookies (YouTube/Google) — see the Cookie Policy's
                       Functional category. It only renders once that
                       category is granted; until then, a poster stands in
                       with an explicit action to opt in and load it,
                       rather than the embed loading silently by default. */
                    <div className="podcast-youtube-spotlight-gate">
                      <img src={`https://i.ytimg.com/vi/${spotlight.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" decoding="async" />
                      <div className="podcast-youtube-spotlight-gate-overlay">
                        <p>{t('podcastPage.youtube.consentGate.text')}</p>
                        <div className="podcast-youtube-spotlight-gate-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => savePreferences({ ...consent, functional: true })}
                          >
                            {t('podcastPage.youtube.consentGate.allow')}
                          </button>
                          <button type="button" className="btn-outline" onClick={openSettings}>
                            {t('cookies.actions.settings')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : reducedMotion ? (
                    // Respects prefers-reduced-motion: a poster + explicit
                    // play control rather than forcing autoplay on someone
                    // who asked the OS not to animate things for them.
                    // Links straight to YouTube rather than embedding, so
                    // it also never needs the consent gate above.
                    <a
                      className="podcast-youtube-spotlight-poster"
                      href={`https://www.youtube.com/watch?v=${spotlight.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t('podcastPage.youtube.itemLabel', { title: spotlight.title || t('podcastPage.youtube.title') })}
                    >
                      {/* i.ytimg.com's hqdefault.jpg is always exactly 480x360 —
                          a fixed size YouTube itself guarantees, not derived
                          from anything on this end. */}
                      <img src={`https://i.ytimg.com/vi/${spotlight.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" decoding="async" />
                      <span className="podcast-youtube-badge" aria-hidden="true">
                        <Play size={26} fill="currentColor" />
                      </span>
                    </a>
                  ) : (
                    <iframe
                      className="podcast-youtube-spotlight-frame"
                      src={`https://www.youtube.com/embed/${spotlight.id}?autoplay=1&mute=1&loop=1&playlist=${spotlight.id}&controls=1&modestbranding=1&playsinline=1&rel=0`}
                      title={spotlight.title || t('podcastPage.youtube.title')}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {spotlight.title && <p className="podcast-youtube-spotlight-title">{spotlight.title}</p>}
                </div>

                {rest.length > 0 && (
                  <ul className="podcast-youtube-list">
                    {rest.slice(0, 4).map((video) => (
                      <li key={video.id}>
                        <a
                          className="podcast-youtube-list-item"
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={t('podcastPage.youtube.itemLabel', { title: video.title || t('podcastPage.youtube.title') })}
                        >
                          <span className="podcast-youtube-list-thumb">
                            <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" decoding="async" />
                            <span className="podcast-youtube-list-play" aria-hidden="true">
                              <Play size={16} fill="currentColor" />
                            </span>
                          </span>
                          {video.title && <span className="podcast-youtube-list-title">{video.title}</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            /* Empty state — byte-for-byte the same layout that shipped
               last round (.podcast-split: copy left, card right). A
               facade, not a player: no video IDs exist yet. Honest about
               being a link out (chip, arrow, new-tab aria-label) rather
               than pretending to play inline. Populating
               podcastPage.youtube.videos in both locale files (shape:
               [{ id, title }]) swaps this whole block for the grid
               above with no further code change. */
            <div className="podcast-split">
              <div className="podcast-split-body">
                <p className="eyebrow">{t('podcastPage.youtube.eyebrow')}</p>
                <h2 className="heading-2">{t('podcastPage.youtube.title')}</h2>
                <p className="podcast-lede">{t('podcastPage.youtube.lede')}</p>
                <a
                  className="podcast-pill podcast-youtube-cta"
                  href={YOUTUBE_CHANNEL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span>{t('podcastPage.youtube.cta')}</span>
                  <ArrowUpRight size={16} />
                </a>
              </div>

              <a
                className="podcast-youtube-card"
                href={YOUTUBE_CHANNEL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t('podcastPage.youtube.cardLabel')}
              >
                <img
                  src="/images/portfolio-corporate-v.webp"
                  alt=""
                  width="1100"
                  height="825"
                  loading="lazy"
                  decoding="async"
                />
                <span className="podcast-youtube-scrim" aria-hidden="true" />
                <span className="podcast-chip podcast-youtube-chip">
                  {t('podcastPage.youtube.chip')}
                </span>
                <span className="podcast-youtube-badge" aria-hidden="true">
                  <Youtube size={28} />
                </span>
              </a>
            </div>
          )}
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
