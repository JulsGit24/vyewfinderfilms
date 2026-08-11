import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* ==========================================================
   Cookie consent

   Same cookie-backed pattern as ThemeContext (see that file), so the
   choice survives a reload without a network round trip and without
   flashing the banner before JS decides whether to show it.

   Categories mirror what a standard cookie-consent policy covers —
   Necessary, Functional, Analytics, Marketing — deliberately one more
   than the three this project was scoped around (Strictly Necessary /
   Performance-Analytics / Marketing-Targeting), because this site
   genuinely has a fourth kind of cookie surface that doesn't belong in
   any of those three: the YouTube embed on /podcast. Necessary is
   always on and cannot be declined (there is nothing to decline — see
   README/Cookie Policy for what actually falls in it). Analytics and
   Marketing exist here already, off by default, even though nothing on
   this site currently sets either kind of cookie — so if analytics or
   ad tracking is ever added, it only has to check consent.analytics /
   consent.marketing before initialising; no new consent plumbing.
   ========================================================== */

const COOKIE_NAME = 'vf-cookie-consent'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180 // ~6 months — shorter than the theme
// cookie's year: a consent choice is a live legal record, not a UI
// preference, and re-asking periodically is the more defensible default.

export const DEFAULT_CONSENT = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false
}

const ConsentContext = createContext({
  consent: DEFAULT_CONSENT,
  decided: false,
  settingsOpen: false,
  acceptAll: () => {},
  rejectNonEssential: () => {},
  savePreferences: () => {},
  openSettings: () => {},
  closeSettings: () => {}
})

const readCookie = (name) => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/* Anything malformed (a hand-edited cookie, a shape from an earlier
   version of this banner) is treated as "not decided" rather than
   trusted — a banner that re-appears once is a much smaller problem
   than one that silently treats a broken read as full consent. */
const readStoredConsent = () => {
  const raw = readCookie(COOKIE_NAME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing)
    }
  } catch {
    return null
  }
}

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(DEFAULT_CONSENT)
  const [decided, setDecided] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const stored = readStoredConsent()
    if (stored) {
      setConsent(stored)
      setDecided(true)
    }
  }, [])

  const persist = useCallback((next) => {
    setConsent(next)
    setDecided(true)
    writeCookie(COOKIE_NAME, JSON.stringify(next))
    setSettingsOpen(false)
  }, [])

  const acceptAll = useCallback(() => {
    persist({ necessary: true, functional: true, analytics: true, marketing: true })
  }, [persist])

  const rejectNonEssential = useCallback(() => {
    persist({ necessary: true, functional: false, analytics: false, marketing: false })
  }, [persist])

  /* Used by the settings panel's Save action — takes whatever the
     panel's toggles currently hold, necessary forced true last so it
     always wins regardless of what's passed in. */
  const savePreferences = useCallback((partial) => {
    persist({ ...DEFAULT_CONSENT, ...partial, necessary: true })
  }, [persist])

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const value = useMemo(
    () => ({ consent, decided, settingsOpen, acceptAll, rejectNonEssential, savePreferences, openSettings, closeSettings }),
    [consent, decided, settingsOpen, acceptAll, rejectNonEssential, savePreferences, openSettings, closeSettings]
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export const useCookieConsent = () => useContext(ConsentContext)

export default ConsentContext
