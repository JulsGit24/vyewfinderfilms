import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/* Canonical production origin. Confirmed with the site owner on
   2026-08-22: bare domain, no `www`.

   This is the JS-side source of truth. The same origin is hardcoded in
   three files that cannot import it — index.html (JSON-LD `url`),
   public/robots.txt (Sitemap:) and public/sitemap.xml (<loc>). If the
   domain ever changes, all four change together. */
export const CANONICAL_ORIGIN = 'https://vyewfinderfilms.com'

/* Path only: query strings and hashes are dropped deliberately so every
   ?utm_source=... variant points at one canonical URL. Root keeps its
   slash; everything else loses a trailing one so /services and
   /services/ never disagree. */
const canonicalUrl = (pathname) =>
  `${CANONICAL_ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`

/* Find-or-create. Never assume the tag is already there: the
   description is in index.html, canonical and hreflang are not, and
   after the first route change all three are. Upserting rather than
   appending guarantees exactly one of each in <head> at all times. */
const upsertMeta = (name, content) => {
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

const upsertLink = (selector, attrs) => {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('link')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
}

/* Per-page <head> metadata. Renders nothing — same shape as ScrollToTop
   in App.jsx: useLocation() + useEffect, no JSX.

   Props are translation KEYS, and t() is called in here rather than by
   the page. That is what makes the title and description follow a
   mid-session language toggle no matter what the parent does: this
   component subscribes to i18next itself, so HomePage() in App.jsx
   needs no hook of its own. There is deliberately no raw
   title/description prop — routing every string through t() is what
   keeps EN/ES parity checkable. */
export default function Seo({ titleKey, descriptionKey, values }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  /* Resolved here rather than passing `values` into the dep array:
     `values` is a fresh object literal on every parent render, which
     would re-run the effect constantly. These resolved strings are
     primitives and only change when the copy or the language does. */
  const title = t(titleKey, values)
  const description = t(descriptionKey, values)

  useEffect(() => {
    const url = canonicalUrl(pathname)

    document.title = title
    upsertMeta('description', description)
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: url })

    /* Single-URL architecture (site owner, 2026-08-22): one set of URLs
       serves both languages through the in-page toggle, so the only
       correct hreflang is a self-referential x-default. Do NOT add
       per-language alternates until /es/... routes actually exist. */
    upsertLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: 'alternate',
      hreflang: 'x-default',
      href: url
    })
  }, [title, description, pathname])

  /* No cleanup on purpose. Removing these on unmount would leave a frame
     with no canonical/description between routes; the next route's Seo
     overwrites them instead. */
  return null
}
