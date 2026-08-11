import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useCookieConsent } from '../context/CookieConsentContext'
import './CookieConsent.scss'

/* ==========================================================
   Cookie consent — banner + settings panel

   Two pieces sharing one context (CookieConsentContext):

   1. The banner: bottom bar, shown whenever `!decided`. Accept All /
      Reject Non-Essential act immediately. Cookie Settings opens the
      panel instead of deciding on the spot.
   2. The settings panel: same portal/overlay convention as Lightbox
      (createPortal to document.body, Escape closes, body scroll
      locked, focus moved to the panel) — the codebase's one existing
      modal pattern, reused rather than inventing a second one.

   Both are mounted globally in App.jsx, once, outside any route — the
   choice has to be askable and revisitable on every page, not just
   the home page.
   ========================================================== */

const CATEGORIES = ['functional', 'analytics', 'marketing']

function SettingsPanel({ onClose }) {
  const { t } = useTranslation()
  const { consent, savePreferences } = useCookieConsent()
  const [draft, setDraft] = useState(consent)
  const closeRef = useRef(null)

  useEffect(() => {
    setDraft(consent)
  }, [consent])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const toggle = (key) => setDraft((prev) => ({ ...prev, [key]: !prev[key] }))

  return createPortal(
    <div className="cookie-settings" role="dialog" aria-modal="true" aria-label={t('cookies.settings.title')}>
      <button
        type="button"
        className="cookie-settings-backdrop"
        aria-label={t('cookies.close')}
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="cookie-settings-panel">
        <button ref={closeRef} type="button" className="cookie-settings-close" onClick={onClose} aria-label={t('cookies.close')}>
          <X size={22} />
        </button>

        <h2 className="cookie-settings-title">{t('cookies.settings.title')}</h2>
        <p className="cookie-settings-intro">{t('cookies.settings.intro')}</p>

        <ul className="cookie-settings-list">
          <li className="cookie-settings-row">
            <div className="cookie-settings-row-head">
              <span className="cookie-settings-row-name">{t('cookies.categories.necessary.name')}</span>
              {/* Always on, not a real toggle — there is nothing to
                  decline here (see Cookie Policy: the only strictly
                  necessary cookie is the theme preference). A disabled
                  switch still shown "on" is clearer than hiding the row,
                  which would read as if this category didn't exist. */}
              <span className="cookie-settings-row-state cookie-settings-row-state--locked">
                {t('cookies.settings.alwaysOn')}
              </span>
            </div>
            <p className="cookie-settings-row-desc">{t('cookies.categories.necessary.desc')}</p>
          </li>

          {CATEGORIES.map((key) => (
            <li className="cookie-settings-row" key={key}>
              <div className="cookie-settings-row-head">
                <span className="cookie-settings-row-name">{t(`cookies.categories.${key}.name`)}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft[key]}
                  aria-label={t(`cookies.categories.${key}.name`)}
                  className={`cookie-switch ${draft[key] ? 'is-on' : ''}`}
                  onClick={() => toggle(key)}
                >
                  <span className="cookie-switch-knob" />
                </button>
              </div>
              <p className="cookie-settings-row-desc">{t(`cookies.categories.${key}.desc`)}</p>
            </li>
          ))}
        </ul>

        <p className="cookie-settings-policy-link">
          <Link to="/cookie-policy" onClick={onClose}>{t('cookies.settings.readPolicy')}</Link>
        </p>

        <div className="cookie-settings-actions">
          <button type="button" className="btn-outline" onClick={onClose}>
            {t('cookies.actions.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={() => savePreferences(draft)}>
            {t('cookies.actions.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function CookieConsent() {
  const { t } = useTranslation()
  const { decided, settingsOpen, acceptAll, rejectNonEssential, openSettings, closeSettings } = useCookieConsent()
  const bannerRef = useRef(null)

  const showBanner = !decided && !settingsOpen

  const handleBannerSettings = useCallback(() => {
    openSettings()
  }, [openSettings])

  /* Both this banner and the navbar are `position: fixed; top: 0`
     (Navigation.scss) — the navbar has to be told how tall the banner
     actually rendered so it can shift down and not sit underneath it.
     A CSS custom property (read by .navbar's `top`) rather than a
     hardcoded offset because the banner's text wraps to two lines on
     narrow viewports, changing its height; a fixed guess would either
     leave a gap or still overlap depending on screen width. */
  useEffect(() => {
    const root = document.documentElement
    if (!showBanner) {
      root.style.setProperty('--cookie-banner-offset', '0px')
      return undefined
    }
    const el = bannerRef.current
    if (!el) return undefined

    const sync = () => root.style.setProperty('--cookie-banner-offset', `${el.offsetHeight}px`)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.setProperty('--cookie-banner-offset', '0px')
    }
  }, [showBanner])

  return (
    <>
      {showBanner && (
        <div ref={bannerRef} className="cookie-banner" role="region" aria-label={t('cookies.banner.title')}>
          <div className="cookie-banner-body">
            <p className="cookie-banner-text">
              {t('cookies.banner.text')}{' '}
              <Link to="/cookie-policy">{t('cookies.banner.link')}</Link>
            </p>
            <div className="cookie-banner-actions">
              <button type="button" className="cookie-banner-btn cookie-banner-btn--ghost" onClick={handleBannerSettings}>
                {t('cookies.actions.settings')}
              </button>
              <button type="button" className="cookie-banner-btn cookie-banner-btn--outline" onClick={rejectNonEssential}>
                {t('cookies.actions.rejectNonEssential')}
              </button>
              <button type="button" className="cookie-banner-btn cookie-banner-btn--primary" onClick={acceptAll}>
                {t('cookies.actions.acceptAll')}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
    </>
  )
}
