import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Facebook, Instagram, Youtube } from 'lucide-react'
import { gsap } from 'gsap'
import './Footer.scss'
import { animateTextReveal } from '../utils/animations'
import { useCookieConsent } from '../context/CookieConsentContext'
import { BUSINESS_PHONE_DISPLAY, BUSINESS_EMAIL } from '../utils/leads'

/* lucide-react carries no brand/logo icons (verified against the
   installed 0.395 build), so the TikTok mark is inline rather than
   imported — a whole icon dependency for one glyph is not worth it.
   Path data from simple-icons (CC0).

   Two deliberate differences from its Lucide siblings, both so it sits
   right next to them: it is filled rather than stroked (the mark only
   exists as a solid glyph), and it renders at 16 rather than 18,
   because a filled glyph reads heavier than a 2px-stroke outline in the
   same box. fill is currentColor, never a hex — that is what lets it
   follow --wst-color-text-primary in both themes. */
const TikTokIcon = ({ size = 16 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
)

/* This component used to hardcode every string, mixing English labels
   ("Contact Us", "Address") with Spanish copy ("Suscríbete a nuestro
   boletín", "Síguenos en:") regardless of the selected language — it
   was the only major component in the tree that never called t(). The
   footer.* keys already existed; they just were not wired up. */
export default function Footer() {
  const { t } = useTranslation()
  const footerRef = useRef(null)
  const { openSettings } = useCookieConsent()

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.footer h3, .footer h4, .footer p, .footer .hours-row span, .footer .footer-links a, .footer .footer-bottom span, .footer .privacy-link, .footer .footer-legal a'
      )
    }, footerRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <footer id="contact" className="footer section-padding" ref={footerRef}>
      <div className="container">
        <div className="grid grid-3 footer-grid">
          <div className="footer-col">
            <h4>{t('footer.contact')}</h4>
            <p className="footer-label">{t('footer.addressLbl')}</p>
            {/* Value is identical in both locales — it is a place name —
                but it still goes through t() so nothing in this file is
                hardcoded copy, and so it is editable in one place if a
                full mailing address is ever supplied. */}
            <p>{t('footer.address')}</p>
            <p className="footer-label">{t('footer.contactLbl')}</p>
            <p>{BUSINESS_PHONE_DISPLAY}<br />{BUSINESS_EMAIL}</p>
          </div>

          <div className="footer-col footer-brand">
            <h3 className="footer-logo">VYEWFINDERFILMS</h3>
            <p className="footer-label">{t('footer.hoursLbl')}</p>
            <div className="hours-row">
              <span>{t('footer.hours.weekdaysLbl')}</span>
              <span>{t('footer.hours.weekdays')}</span>
            </div>
            <div className="hours-row">
              <span>{t('footer.hours.saturdayLbl')}</span>
              <span>{t('footer.hours.saturday')}</span>
            </div>
            {/* Sunday's value is a word, not a range. It stays in the
                secondary text colour like the other two — flagging it
                would read as a promotion, not as opening hours. */}
            <div className="hours-row">
              <span>{t('footer.hours.sundayLbl')}</span>
              <span>{t('footer.hours.sunday')}</span>
            </div>
            {/* Repointed from #home/#services/#clients/#podcast, which
                only resolved on the home page while this footer is
                global. Reuses the nav.* keys rather than inventing four
                more for strings that are already translated. */}
            <ul className="footer-links">
              <li><Link to="/">{t('nav.home')}</Link></li>
              <li><Link to="/services">{t('nav.services')}</Link></li>
              <li><Link to="/about">{t('nav.about')}</Link></li>
              <li><Link to="/contact">{t('nav.contact')}</Link></li>
            </ul>
          </div>

          {/* The newsletter form is gone entirely (client request). The
              column stays and becomes the Follow Us column — collapsing
              to two columns would pull .footer-brand, which is centred
              and carries the wordmark, off the footer's optical centre. */}
          <div className="footer-col">
            <h4>{t('footer.followLbl')}</h4>
            <div className="social-links">
              <a href="https://www.facebook.com/vyewfinderfilmsrva/" target="_blank" rel="noreferrer noopener" aria-label="Facebook" className="social-icon"><Facebook size={18} /></a>
              <a href="https://www.instagram.com/vyewfinderfilms/" target="_blank" rel="noreferrer noopener" aria-label="Instagram" className="social-icon"><Instagram size={18} /></a>
              <a href="https://www.youtube.com/@vyewfinderfilmsrva" target="_blank" rel="noreferrer noopener" aria-label="YouTube" className="social-icon"><Youtube size={18} /></a>
              <a href="https://www.tiktok.com/@vyewfinderfilms" target="_blank" rel="noreferrer noopener" aria-label="TikTok" className="social-icon"><TikTokIcon size={16} /></a>
            </div>
          </div>
        </div>

        <div className="footer-bottom text-center">
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
          <a href="#" className="privacy-link">{t('footer.privacy')}</a>
          {/* Same visual treatment as the link above (shared class),
              but real destinations: a full policy page, and a way to
              revisit the cookie choice without waiting for the banner
              to reappear. */}
          <span className="footer-legal">
            <Link to="/cookie-policy" className="privacy-link">{t('footer.cookiePolicy')}</Link>
            <button type="button" className="privacy-link" onClick={openSettings}>
              {t('footer.cookieSettings')}
            </button>
          </span>
        </div>
      </div>
    </footer>
  )
}
