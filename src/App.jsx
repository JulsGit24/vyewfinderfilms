import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Lenis, { useLenis } from '@studio-freight/react-lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import Loader from './components/Loader'
import { GridRule } from './components/GridOverlay'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import Stories from './components/Stories'
import Services from './components/Services'
import DigitalMarketing from './components/DigitalMarketing'
import Podcast from './components/Podcast'
import Testimonials from './components/Testimonials'
import Clients from './components/Clients'
import Instagram from './components/Instagram'
import Footer from './components/Footer'
import ServicesPage from './pages/ServicesPage'
import ServiceGallery from './pages/ServiceGallery'
import About from './pages/About'
import Contact from './pages/Contact'

gsap.registerPlugin(ScrollTrigger)

/* Keeps ScrollTrigger in step with Lenis.

   This has to live *inside* the <Lenis> provider so useLenis() can
   reach the instance through context. Lenis drives its own rAF
   (autoRaf defaults to true) — an earlier version handed that job to
   gsap.ticker, but when the wiring failed Lenis' loop never ran at
   all, which silently broke every lenis.scrollTo() (the nav links).
   Letting Lenis self-drive means scrolling always works even if this
   sync were ever to fail. */
function ScrollSync() {
  useLenis(() => ScrollTrigger.update())

  useEffect(() => {
    gsap.ticker.lagSmoothing(0)
    ScrollTrigger.refresh()
  }, [])

  return null
}

/* Scroll to top on every route change and refresh ScrollTrigger so
   pinned elements re-measure against the new page height. */
function ScrollToTop() {
  const { pathname } = useLocation()
  const lenis = useLenis()

  useEffect(() => {
    // Reset scroll — use Lenis if available so it stays in sync
    if (lenis) {
      lenis.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo(0, 0)
    }
    // Give the DOM a tick to mount, then refresh trigger positions
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname, lenis])

  return null
}

function HomePage() {
  return (
    <>
      <Hero />
      <Stories />
      <GridRule />
      <Services />
      <GridRule />
      <DigitalMarketing />
      <Podcast />
      <GridRule />
      <Testimonials />
      <Clients />
      <GridRule />
      <Instagram />
    </>
  )
}

function App() {
  return (
    <>
      <Loader />
      <Lenis root options={{ lerp: 0.1, duration: 1.1, smoothWheel: true }}>
        <ScrollSync />
        <ScrollToTop />
        <div className="app-container">
          <Navigation />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:slug" element={<ServiceGallery />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Lenis>
    </>
  )
}

export default App
