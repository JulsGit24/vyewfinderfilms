import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Facebook, Instagram, Youtube } from 'lucide-react'
import { gsap } from 'gsap'
import './Footer.scss'
import { animateTextReveal } from '../utils/animations'
import { BUSINESS_PHONE_DISPLAY, BUSINESS_EMAIL } from '../utils/leads'

/* This component used to hardcode every string, mixing English labels
   ("Contact Us", "Address") with Spanish copy ("Suscríbete a nuestro
   boletín", "Síguenos en:") regardless of the selected language — it
   was the only major component in the tree that never called t(). The
   footer.* keys already existed; they just were not wired up. */
export default function Footer() {
  const { t } = useTranslation()
  const footerRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal(
        '.footer h3, .footer h4, .footer p, .footer .hours-row span, .footer .footer-links a, .footer .footer-bottom span, .footer .privacy-link'
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
            </div>
          </div>
        </div>

        <div className="footer-bottom text-center">
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
          <a href="#" className="privacy-link">{t('footer.privacy')}</a>
        </div>
      </div>
    </footer>
  )
}
