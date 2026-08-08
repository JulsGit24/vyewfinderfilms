import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { animateTextReveal } from '../utils/animations'
import './Services.scss'

gsap.registerPlugin(ScrollTrigger)

// Removed static services array, moved inside component to use translations

/* Shortest signed distance from the active index, so the wheel always
   rotates the short way round instead of unwinding through the middle. */
const wrappedOffset = (index, active, count) => {
  let offset = index - active
  if (offset > count / 2) offset -= count
  if (offset < -count / 2) offset += count
  return offset
}

export default function Services() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const sectionRef = useRef(null)
  const stageRef = useRef(null)

  const localizedServices = [
    {
      title: t('services.items.corporate.title', 'Corporate Videos'),
      description: t('services.items.corporate.desc', 'Professional video production that communicates your brand story with clarity and impact.'),
      image: '/images/portfolio-corporate-v.webp',
      link: '/services#corporate-video'
    },
    {
      title: t('services.items.photography.title', 'Photography'),
      description: t('services.items.photography.desc', 'High-end photography that captures the details worth remembering.'),
      image: '/images/portfolio-photography.webp',
      link: '/services#photography'
    },
    {
      /* Was "Social Media". That service is now merged into Digital
         Marketing, and leaving the old label on the home page is
         exactly the two-offerings confusion the merge removes. The
         teaser copy is unchanged, it just moved to its own key; the
         link had to move too — /services#social-media no longer
         renders a block to anchor to. */
      title: t('nav.digitalMarketing', 'Digital Marketing'),
      description: t('services.items.digitalMarketing.teaser', 'Scroll-stopping content built for the platforms your audience actually watches.'),
      image: '/images/portfolio-social.webp',
      link: '/services#digital-marketing'
    },
    {
      title: t('services.items.podcast.title', 'Podcast'),
      description: t('services.items.podcast.desc', 'Full-service podcast production, from studio setup to the episode your audience hears.'),
      image: '/images/portfolio-podcast.webp',
      link: '/podcast'
    }
  ]

  const COUNT = localizedServices.length

  const go = useCallback((dir) => {
    setActive((prev) => (prev + dir + COUNT) % COUNT)
  }, [COUNT])

  /* Keyboard + drag/swipe on the stage */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    }

    let startX = null
    const onPointerDown = (e) => { startX = e.clientX }
    const onPointerUp = (e) => {
      if (startX === null) return
      const dx = e.clientX - startX
      startX = null
      if (Math.abs(dx) > 60) go(dx > 0 ? -1 : 1)
    }

    stage.addEventListener('keydown', onKey)
    stage.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      stage.removeEventListener('keydown', onKey)
      stage.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [go])

  /* The wheel copy is keyed on `active`, so it remounts on every slide
     change. Re-splitting it there gives the new title and description
     the same reveal as the rest of the page instead of a hard swap. */
  useEffect(() => {
    const revert = animateTextReveal('.wheel-copy .wheel-title, .wheel-copy .wheel-desc', {
      mode: 'entrance'
    })
    return revert
  }, [active])

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.services-section .section-header > *')

      gsap.from('.wheel-stage', {
        scrollTrigger: { trigger: '.services-wheel', start: 'top 80%' },
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      })
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section id="services" className="services-section section-padding" ref={sectionRef}>
      <div className="container">
        <div className="section-header text-center">
          <h2 className="heading-2">{t('services.title')}</h2>
          <p className="subheading">{t('services.subheading')}</p>
        </div>
      </div>

      <div className="services-wheel">
        <div
          className="wheel-stage"
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label="Services"
        >
          {localizedServices.map((service, index) => {
            const offset = wrappedOffset(index, active, COUNT)
            const isActive = offset === 0
            /* With COUNT = 4 the offsets present are {-1, 0, 1, 2}. The
               |2| slide is already at 0.2 opacity and translated far
               enough sideways to be clipped by the section's
               overflow:hidden below ~1600px — but not above it, where
               its rotated bottom corner reaches into the copy. Hiding
               it outright removes that tail case; the existing 0.75s
               opacity transition fades it back in as it becomes the
               left neighbour. */
            const isFar = Math.abs(offset) > 1
            return (
              <button
                type="button"
                key={service.title}
                className={`wheel-slide ${isActive ? 'is-active' : ''} ${isFar ? 'wheel-slide--far' : ''}`}
                style={{
                  '--offset': offset,
                  '--abs': Math.abs(offset),
                  zIndex: COUNT - Math.abs(offset)
                }}
                onClick={() => (isActive ? null : setActive(index))}
                aria-current={isActive}
                aria-label={service.title}
                tabIndex={isActive ? 0 : -1}
              >
                <span className="wheel-slide-media">
                  <img src={service.image} alt="" draggable="false" loading="lazy" decoding="async" />
                </span>
                <span className="wheel-slide-index">{String(index + 1).padStart(2, '0')}</span>
                {/* "Text at the edge of every image" — a label on each
                    slide, not just the active one. Deliberately not run
                    through animateTextReveal: it re-renders on every
                    slide change and splitting it would flicker. */}
                <span className="wheel-slide-label">{service.title}</span>
              </button>
            )
          })}
        </div>

        <div className="container wheel-ui">
          <div className="wheel-copy" key={active}>
            <h3 className="wheel-title">{localizedServices[active].title}</h3>
            <p className="wheel-desc">{localizedServices[active].description}</p>
            <button className="btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate(localizedServices[active].link)}>
              {t('services.seeMore')}
            </button>
          </div>

          <div className="wheel-controls">
            <button type="button" className="wheel-arrow" onClick={() => go(-1)} aria-label="Previous service">
              <ArrowLeft size={20} />
            </button>
            <span className="wheel-count" aria-hidden="true">
              {String(active + 1).padStart(2, '0')} <i>/</i> {String(COUNT).padStart(2, '0')}
            </span>
            <button type="button" className="wheel-arrow" onClick={() => go(1)} aria-label="Next service">
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
