import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const COOKIE_NAME = 'vf-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // one year
const THEMES = ['dark', 'light']
const DEFAULT_THEME = 'light'

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: () => {}, toggleTheme: () => {} })

const readCookie = (name) => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/* The stored choice always wins, so an explicit pick is never
   overridden. With no cookie the site opens light — that is the
   brand default now, deliberately not the OS preference, so a first
   visit looks the same for everyone. */
const resolveInitialTheme = () => {
  const stored = readCookie(COOKIE_NAME)
  return THEMES.includes(stored) ? stored : DEFAULT_THEME
}

/* Applied straight to the DOM rather than only from an effect.
   React runs effects child-first, so a provider-level effect lands
   *after* its consumers' effects — the navbar was re-measuring its
   background while :root still carried the previous theme, which is
   why its colour only caught up on the next scroll. Writing the
   attribute inside the event handler updates the tokens before any
   re-render, so consumers always read the new values. */
const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme)

  // Drives every token in index.scss via :root[data-theme='light'].
  // Covers first mount and any state change that bypassed the setters.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    applyTheme(next)
    setThemeState(next)
    writeCookie(COOKIE_NAME, next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      writeCookie(COOKIE_NAME, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

export default ThemeContext
