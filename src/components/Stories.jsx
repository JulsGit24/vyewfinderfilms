import React, { useRef, useEffect, useState } from 'react'
import { Splide, SplideSlide } from '@splidejs/react-splide'
import '@splidejs/splide/dist/css/splide.min.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { animateTextReveal } from '../utils/animations'
import { useSiteReady } from '../utils/siteReady'
import { VolumeX, Volume2, Maximize2, X, Play, Pause } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './Stories.scss'

gsap.registerPlugin(ScrollTrigger)

export default function Stories() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)
  const splideRef = useRef(null)
  const siteReady = useSiteReady()
  
  // State for tracking mute and play status of each video
  const [mutedStates, setMutedStates] = useState({ 1: true, 2: true, 3: true })
  const [playStates, setPlayStates] = useState({ 1: true, 2: true, 3: true })
  const videosRef = useRef({})
  
  // State for expanded modal
  const [expandedVideo, setExpandedVideo] = useState(null)

  const storiesData = [
    { id: 1, title: t('stories.items.1.title'), videoSrc: '/assets/video1.mp4', poster: '/images/portfolio-corporate.jpg', category: t('stories.items.1.category') },
    { id: 2, title: t('stories.items.2.title'), videoSrc: '/assets/video2.mp4', poster: '/images/portfolio-social-1.jpg', category: t('stories.items.2.category') },
    { id: 3, title: t('stories.items.3.title'), videoSrc: '/assets/video3.mp4', poster: '/images/portfolio-social-2.jpg', category: t('stories.items.3.category') }
  ]

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.stories-header .heading-2')
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])
  
  const toggleMute = (id, e) => {
    e.stopPropagation()
    setMutedStates(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const togglePlay = (id, e) => {
    e.stopPropagation()
    setPlayStates(prev => {
      const isPlaying = !prev[id]
      const video = videosRef.current[id]
      if (video) {
        if (isPlaying) video.play().catch(() => {})
        else video.pause()
      }
      return { ...prev, [id]: isPlaying }
    })
  }

  // Use a callback ref to ensure the muted property is actually set on the DOM element.
  // React's muted prop is sometimes ignored depending on autoplay timing.
  const videoRefCallback = (el, id) => {
    if (el) {
      el.muted = mutedStates[id]
      videosRef.current[id] = el
    }
  }

  /* Splide's `type: 'loop'` clones slides with cloneNode, and React
     never sees those clones — no refs run on them and re-renders do
     not reach them. Two things therefore have to be enforced on the
     raw DOM for every video in the section, clones included:

     1. `muted`, which is a property rather than a reflected attribute,
        so cloned videos came up unmuted and started blaring the moment
        a re-render swapped a clone into view.
     2. `src`, which is withheld until the loader releases (see
        utils/siteReady). The clones are made while it is still absent,
        so without this they would sit on their posters forever. */
  useEffect(() => {
    const root = sectionRef.current
    if (!root) return undefined

    const applyVideoState = () => {
      root.querySelectorAll('video[data-story-id]').forEach((video) => {
        const id = Number(video.dataset.storyId)

        const shouldMute = mutedStates[id] !== false
        if (video.muted !== shouldMute) video.muted = shouldMute

        if (!siteReady) return
        const wanted = storiesData.find((s) => s.id === id)?.videoSrc
        if (wanted && !video.getAttribute('src')) {
          video.setAttribute('src', wanted)
          video.muted = shouldMute
          video.play().catch(() => {})
        }
      })
    }

    applyVideoState()
    const observer = new MutationObserver(applyVideoState)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [mutedStates, siteReady])
  
  const openExpanded = (story) => {
    setExpandedVideo(story)
    // Optionally pause slider when modal is open
    if (splideRef.current && splideRef.current.splide) {
      splideRef.current.splide.Components.Autoplay.pause()
    }
  }
  
  const closeExpanded = () => {
    setExpandedVideo(null)
    if (splideRef.current && splideRef.current.splide) {
      splideRef.current.splide.Components.Autoplay.play()
    }
  }

  return (
    <section id="stories" className="stories-section" ref={sectionRef}>
      <div className="stories-header">
        <h2 className="heading-2">{t('stories.title')}</h2>
        <span className="divider" />
      </div>

      <div className="stories-slider-wrap">
        <Splide
          ref={splideRef}
          options={{
            type: 'loop',
            perPage: 3,
            perMove: 1,
            focus: 'center',
            gap: '2rem',
            autoplay: true,
            interval: 5000,
            pauseOnHover: true,
            pagination: false,
            drag: true,
            speed: 800,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            breakpoints: {
              991: { perPage: 1 }
            }
          }}
          aria-label="Stories carousel"
        >
          {storiesData.map((story) => (
            <SplideSlide key={story.id}>
              <div className="story-slide">
                <div className="story-slide__video-wrap" onClick={() => openExpanded(story)}>
                  {/* src withheld until the loader releases — see
                      utils/siteReady. Splide clones the slide markup,
                      so the attribute (not a ref) has to carry it. */}
                  <video
                    ref={(el) => videoRefCallback(el, story.id)}
                    data-story-id={story.id}
                    src={siteReady ? story.videoSrc : undefined}
                    poster={story.poster}
                    preload={siteReady ? 'auto' : 'none'}
                    loop
                    muted
                    playsInline
                    autoPlay
                    className="story-slide__video"
                  />
                  <div className="story-slide__overlay">
                    <button 
                      className="story-control-btn" 
                      onClick={(e) => togglePlay(story.id, e)}
                      aria-label="Toggle play"
                    >
                      {playStates[story.id] ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button 
                      className="story-control-btn" 
                      onClick={(e) => toggleMute(story.id, e)}
                      aria-label="Toggle mute"
                    >
                      {mutedStates[story.id] ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <button 
                      className="story-control-btn" 
                      onClick={(e) => { e.stopPropagation(); openExpanded(story); }}
                      aria-label="Expand video"
                    >
                      <Maximize2 size={20} />
                    </button>
                  </div>
                </div>
                <div className="story-slide__info">
                  <span className="story-slide__category">{story.category}</span>
                  <h3 className="story-slide__title">{story.title}</h3>
                </div>
              </div>
            </SplideSlide>
          ))}
        </Splide>

        <div className="stories-controls">
          <button
            className="stories-arrow stories-arrow--prev"
            aria-label="Previous"
            onClick={() => splideRef.current?.splide?.go('<')}
          >
            <svg viewBox="0 0 24 18" width="24" height="18">
              <path fill="currentColor" d="M23.999,8H5.481c5.009-2.91,6.349-7.311,6.416-7.548L9.976-0.102C9.9,0.156,8.03,6.213-0.073,8.024L0.146,9l-0.218,0.976C8.03,11.787,9.9,17.844,9.976,18.101l1.922-0.554C11.83,17.31,10.49,12.91,5.481,10h18.518V8z"/>
            </svg>
          </button>
          <button
            className="stories-arrow stories-arrow--next"
            aria-label="Next"
            onClick={() => splideRef.current?.splide?.go('>')}
          >
            <svg viewBox="0 0 24 18" width="24" height="18" style={{ transform: 'scaleX(-1)' }}>
              <path fill="currentColor" d="M23.999,8H5.481c5.009-2.91,6.349-7.311,6.416-7.548L9.976-0.102C9.9,0.156,8.03,6.213-0.073,8.024L0.146,9l-0.218,0.976C8.03,11.787,9.9,17.844,9.976,18.101l1.922-0.554C11.83,17.31,10.49,12.91,5.481,10h18.518V8z"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Fullscreen Video Modal */}
      {expandedVideo && (
        <div className="story-modal" onClick={closeExpanded}>
          <button className="story-modal-close" onClick={closeExpanded} aria-label="Close modal">
            <X size={32} />
          </button>
          <div className="story-modal-content" onClick={e => e.stopPropagation()}>
            <video
              src={expandedVideo.videoSrc}
              controls
              autoPlay
              className="story-modal-video"
            />
            <div className="story-modal-info">
              <h3>{expandedVideo.title}</h3>
              <p>{expandedVideo.category}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
