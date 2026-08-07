import React, { useState, useEffect, useRef } from 'react'
import { Facebook, Instagram } from 'lucide-react'
import { gsap } from 'gsap'
import './Footer.scss'
import { animateTextReveal } from '../utils/animations'

export default function Footer() {
  const [submitted, setSubmitted] = useState(false)
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

  const handleSubscribe = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <footer id="contact" className="footer section-padding" ref={footerRef}>
      <div className="container">
        <div className="grid grid-3 footer-grid">
          <div className="footer-col">
            <h4>Contact Us</h4>
            <p className="footer-label">Address</p>
            <p>Richmond, Virginia</p>
            <p className="footer-label">Contact</p>
            <p>804-998-0564<br />info@vyewfinderfilms.com</p>
          </div>

          <div className="footer-col footer-brand">
            <h3 className="footer-logo">VYEWFINDERFILMS</h3>
            <p className="footer-label">Opening Hours</p>
            <div className="hours-row"><span>Mon - Fri</span><span>8:00 am &ndash; 8:00 pm</span></div>
            <div className="hours-row"><span>Saturday</span><span>9:00 am &ndash; 7:00 pm</span></div>
            <div className="hours-row"><span>Sunday</span><span>9:00 am &ndash; 9:00 pm</span></div>
            <ul className="footer-links">
              <li><a href="#home">Inicio</a></li>
              <li><a href="#services">Soluciones</a></li>
              <li><a href="#clients">Visi&oacute;n</a></li>
              <li><a href="#podcast">Empezar</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Suscr&iacute;bete a nuestro bolet&iacute;n</h4>
            {submitted ? (
              <p className="footer-thanks">&iexcl;Gracias por tu mensaje!</p>
            ) : (
              <form className="newsletter-form" onSubmit={handleSubscribe}>
                <label htmlFor="footer-email">Email</label>
                <div className="newsletter-input-row">
                  <input id="footer-email" type="email" placeholder="your@email.com" required />
                  <button type="submit">Enviar</button>
                </div>
              </form>
            )}
            <p className="footer-label follow-label">S&iacute;guenos en:</p>
            <div className="social-links">
              <a href="https://www.facebook.com/vyewfinderfilmsrva/" target="_blank" rel="noreferrer noopener" aria-label="Facebook" className="social-icon"><Facebook size={18} /></a>
              <a href="https://www.instagram.com/vyewfinderfilms/" target="_blank" rel="noreferrer noopener" aria-label="Instagram" className="social-icon"><Instagram size={18} /></a>
            </div>
          </div>
        </div>

        <div className="footer-bottom text-center">
          <span>@viewfinderfilms all rights reserved</span>
          <a href="#" className="privacy-link">Pol&iacute;tica de privacidad</a>
        </div>
      </div>
    </footer>
  )
}
