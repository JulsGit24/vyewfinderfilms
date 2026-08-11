import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import { useCookieConsent } from '../context/CookieConsentContext'
import './CookiePolicy.scss'

/* ==========================================================
   Cookie Policy

   Content lives entirely in translation.json (cookiePolicy.*), the
   same "returnObjects" pattern already used for testimonials.items
   and podcastPage.youtube.videos — this component is a renderer, not
   where the legal copy lives, so EN/ES stay in exact lockstep and a
   copy change never touches JSX.

   Each section can carry, in addition to a heading and paragraphs:
     - table: { headers, rows } — the cookies-we-use table
     - bodyAfter: paragraphs that render after the table
     - definitionList: [{ term, def }] — the categories glossary
   ========================================================== */
export default function CookiePolicy() {
  const { t } = useTranslation()
  const pageRef = useRef(null)
  const { openSettings } = useCookieConsent()

  const sections = t('cookiePolicy.sections', { returnObjects: true })
  const list = Array.isArray(sections) ? sections : []

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.cookie-policy-header > *, .cookie-policy-intro')
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <div className="cookie-policy-page" ref={pageRef}>
      <div className="container">
        <header className="cookie-policy-header">
          <p className="eyebrow">{t('cookiePolicy.eyebrow')}</p>
          <h1 className="heading-1">{t('cookiePolicy.title')}</h1>
          <p className="cookie-policy-updated">{t('cookiePolicy.lastUpdated')}</p>
        </header>

        <p className="cookie-policy-intro">{t('cookiePolicy.intro')}</p>

        {/* A direct way to act on this document, not just read it —
            most visitors arriving here came from "Learn more" on the
            banner, or "Read our full Cookie Policy" in Settings; a
            few will land here first via search or the footer link. */}
        <button type="button" className="cookie-policy-settings-btn btn-outline" onClick={openSettings}>
          {t('cookies.actions.settings')}
        </button>

        <div className="cookie-policy-body">
          {list.map((section) => (
            <section className="cookie-policy-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {/* Index keys are fine here: this is static legal copy
                  with a fixed order, never reordered or filtered at
                  runtime — the usual objection to index keys doesn't
                  apply. */}
              {section.body?.map((para, i) => <p key={i}>{para}</p>)}

              {section.table && (
                <div className="cookie-policy-table-wrap">
                  <table className="cookie-policy-table">
                    <thead>
                      <tr>
                        {section.table.headers.map((h) => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, i) => <td key={i}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.bodyAfter?.map((para, i) => <p key={i}>{para}</p>)}

              {section.definitionList && (
                <dl className="cookie-policy-deflist">
                  {section.definitionList.map((item) => (
                    <div className="cookie-policy-deflist-row" key={item.term}>
                      <dt>{item.term}</dt>
                      <dd>{item.def}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
