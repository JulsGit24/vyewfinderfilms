import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import './Clients.scss'
import { animateTextReveal } from '../utils/animations'

const clients = [
  { name: 'Kairos', logo: '/images/client-kairos.avif' },
  { name: 'The Sasso Realty Group', logo: '/images/client-thesasso.avif' },
  { name: 'Lemur Remodeling', logo: '/images/client-lemur.avif' },
  { name: 'Raldas Details', logo: '/images/client-raldas.avif' },
  { name: 'Alondra', logo: '/images/client-alondra.avif' },
  { name: 'Botanya', logo: '/images/client-botanya.avif' },
  { name: 'Little Mexico', logo: '/images/client-littlemexico.avif' }
]

/* The track is rendered twice back-to-back and translated by exactly
   -50%, so the second copy lands where the first began — the loop has
   no visible seam and needs no JS. */
function Track({ ariaHidden }) {
  return (
    <ul className="ticker-track" aria-hidden={ariaHidden || undefined}>
      {clients.map((client) => (
        <li key={client.name} className="ticker-item">
          <img src={client.logo} alt={ariaHidden ? '' : client.name} loading="lazy" draggable="false" />
        </li>
      ))}
    </ul>
  )
}

export default function Clients() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.clients-section .section-header > *')
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section id="clients" className="clients-section section-padding" ref={sectionRef}>
      <div className="container">
        <div className="section-header text-center">
          <h2 className="heading-2">{t('clients.title')}</h2>
        </div>
      </div>

      <div className="ticker" role="region" aria-label="Our clients">
        <div className="ticker-viewport">
          <div className="ticker-rail">
            <Track />
            <Track ariaHidden />
          </div>
        </div>
      </div>
    </section>
  )
}
