import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLenis } from '@studio-freight/react-lenis'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Sun, Moon, Languages } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import './Navigation.scss'

const PROBE_Y = 28
const ACTIVE_PROBE_Y = 140



export default function Navigation() {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [tone, setTone] = useState('dark')
  const lenis = useLenis()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')
  }

  const links = [
    { name: t('nav.home'), href: '/' },
    {
      name: t('nav.services'),
      href: '/services',
      subLinks: [
        { name: t('nav.digitalMarketing'), href: '/services#digital-marketing' },
        { name: t('nav.corporateVideo'), href: '/services#corporate-video' },
        { name: t('nav.photography'), href: '/services#photography' },
        { name: t('nav.socialMedia'), href: '/services#social-media' }
      ]
    },
    { name: t('nav.podcast'), href: '/podcast' },
    { name: t('nav.gallery'), href: '/services' },
    { name: t('nav.about'), href: '/about' },
    { name: t('nav.contact'), href: '/contact' }
  ]

  const measureRef = useRef(() => {})

  useEffect(() => {
    let frame = 0

    const measure = () => {
      frame = 0
      setScrolled(window.scrollY > 40)

      const blocks = document.querySelectorAll('section, footer, [data-nav-tone]')
      let current = null
      for (const block of blocks) {
        const rect = block.getBoundingClientRect()
        if (rect.top <= PROBE_Y && rect.bottom > PROBE_Y) current = block
      }

      /* Falling back to <body> matters: a route whose markup has no
         <section> under the bar (the contact page was a bare <div>)
         left `current` null, so the tone was never recomputed and the
         bar kept whatever it had until a scroll happened to bring the
         footer into the probe. */
      const probed = current || document.body
      const override = probed.dataset.navTone
      if (override === 'dark' || override === 'light') {
        setTone(override)
      } else {
        /* Standard sections track the global theme. 
           Probing the DOM color during a theme switch reads the 
           mid-transition color and causes a lag in the navbar update. */
        setTone(theme)
      }

      let active = ''
      const targets = links
        .filter(l => l.href.startsWith('/#'))
        .map(link => ({ href: link.href, el: document.querySelector(link.href.replace('/', '')) }))
        .filter(t => t.el)
        
      for (const t of targets) {
        if (t.el.getBoundingClientRect().top <= ACTIVE_PROBE_Y) active = t.href
      }

      if (location.pathname !== '/') {
        active = location.pathname
      } else {
        const atBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2
        if (atBottom && targets.length) active = targets[targets.length - 1].href
        else if (!active) active = '/'
      }
      
      setActiveSection(active)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measureRef.current = measure
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    /* `theme` is a dependency even though it is never read here: the
       probe samples computed background colours, and those change the
       instant the theme flips. Without it the bar kept the old tone
       until something else triggered a scroll. */
  }, [location.pathname, links, theme])

  /* Sections carry `transition: background-color 0.35s`, so a probe
     fired the moment the theme flips still reads the *outgoing*
     colour — getComputedStyle returns the mid-transition value, not
     the target. Re-probe once the transition has settled so the pill
     lands on the right tone instead of waiting for the next scroll. */
  useEffect(() => {
    const id = setTimeout(() => measureRef.current(), 420)
    return () => clearTimeout(id)
  }, [theme])

  const handleNavClick = useCallback((e, href) => {
    e.preventDefault()
    setIsOpen(false)
    
    if (href === '/') {
      // Go home
      if (location.pathname === '/') {
        if (lenis) lenis.scrollTo(0, { duration: 1.2 })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate('/')
      }
    } else if (href.startsWith('/#')) {
      // Hash on the home page
      if (location.pathname !== '/') {
        navigate('/')
        // After navigating home, scroll to the anchor on next tick
        setTimeout(() => {
          const target = document.querySelector(href.replace('/', ''))
          if (target) {
            if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 })
            else target.scrollIntoView({ behavior: 'smooth' })
          }
        }, 300)
      } else {
        const target = document.querySelector(href.replace('/', ''))
        if (!target) return
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 })
        else target.scrollIntoView({ behavior: 'smooth' })
      }
    } else if (href.includes('#')) {
      // Route + hash (e.g. /services#photography)
      const [path, hash] = href.split('#')
      if (location.pathname === path) {
        // Already on the right page, just scroll to the anchor
        const target = document.getElementById(hash)
        if (target) {
          if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 })
          else target.scrollIntoView({ behavior: 'smooth' })
        }
      } else {
        navigate(path)
        setTimeout(() => {
          const target = document.getElementById(hash)
          if (target) {
            if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 })
            else target.scrollIntoView({ behavior: 'smooth' })
          }
        }, 400)
      }
    } else {
      // Pure route (e.g. /services, /contact)
      navigate(href)
    }
  }, [lenis, location, navigate])

  return (
    <header className={`navbar tone-${tone} ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        <a href="/" onClick={(e) => handleNavClick(e, '/')} className="logo" aria-label="Vyewfinder Films — home">
          <span className="logo-isotype" aria-hidden="true" />
        </a>

        <nav className="desktop-nav">
          <ul style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {links.map(link => (
              <li key={link.name} className={link.subLinks ? 'has-dropdown' : ''}>
                <a
                  href={link.href}
                  className={activeSection === link.href ? 'active' : ''}
                  onClick={(e) => handleNavClick(e, link.href)}
                >
                  {link.name}
                </a>
                {link.subLinks && (
                  <div className="dropdown-menu">
                    {link.subLinks.map(sub => (
                      <a key={sub.name} href={sub.href} onClick={(e) => handleNavClick(e, sub.href)}>
                        {sub.name}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
            
            <li>
              <button className="lang-toggle" onClick={toggleLang}>
                {i18n.language.toUpperCase()}
              </button>
            </li>

            <li>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={t('theme.toggle')}
                title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
                aria-pressed={theme === 'light'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </li>

            <li>
              <a href="tel:123-456-7890" className="btn-contact-us">
                <Phone size={16} />
                <span>{t('nav.contactUsBtn')}</span>
              </a>
            </li>
          </ul>
        </nav>

        <button className="hamburger" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
          <div className={`line ${isOpen ? 'open' : ''}`} />
          <div className={`line ${isOpen ? 'open' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mobile-nav"
          >
            <ul>
              {links.map(link => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className={activeSection === link.href ? 'active' : ''}
                    onClick={(e) => handleNavClick(e, link.href)}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
              <li className="mobile-nav-divider">
                <a href="tel:123-456-7890" className="mobile-nav-call">{t('nav.contactUsBtn')}</a>
              </li>
              {/* The desktop pill's controls had no mobile equivalent,
                  so phone visitors could not switch theme at all. */}
              <li className="mobile-nav-controls">
                <button type="button" className="mobile-nav-control" onClick={toggleTheme} aria-pressed={theme === 'light'}>
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
                </button>
                <button type="button" className="mobile-nav-control" onClick={toggleLang}>
                  <Languages size={16} />
                  <span>{i18n.language.toUpperCase()}</span>
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
