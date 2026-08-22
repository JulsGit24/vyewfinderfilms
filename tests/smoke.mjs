#!/usr/bin/env node
/* ==========================================================
   Smoke test suite

   Boots a production build and walks every route with Puppeteer,
   asserting the baseline that should never regress: the page loads,
   nothing throws in the console, no request fails outright, and a
   handful of structural landmarks are present.

   This exists because the project had no persisted test suite —
   verification during development was a series of throwaway
   .verify-*.mjs scripts written and deleted per session. This is the
   same technique, kept as a real repo asset so the QA teammate (see
   .claude/agents/qa-tester.md) has something concrete to run and
   extend instead of reinventing a harness every time.

   Run: npm test
   Add coverage: push a new entry onto CHECKS below, or add assertions
   inside an existing page's `assert` function.
   ========================================================== */

import { spawn, spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer'

const PORT = 4310
const BASE = `http://localhost:${PORT}`
const BUILD_TIMEOUT_MS = 180_000
const SERVER_BOOT_MS = 4_000
const NAV_TIMEOUT_MS = 30_000
const SETTLE_MS = 2_500

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ----------------------------------------------------------
   Page checklist. Each entry is one route plus assertions that run
   against it once the page has settled. Keep assertions structural
   (things break silently) rather than pixel-perfect (things that are
   easy to eyeball in a screenshot when something looks off).
   ---------------------------------------------------------- */
const CHECKS = [
  {
    name: 'home',
    path: '/',
    // loader animation runs on first paint and needs time to buffer +
    // play its frame sequence before the rest of the page settles
    settleMs: 13000,
    assert: async (page, t) => {
      t.ok('hero renders', await page.$('.hero-section') !== null)
      // '> ul > li > a' scopes to top-level nav items only — excludes
      // dropdown sub-links (nested in .dropdown-menu) and is filtered
      // to drop the trailing "Contact Us" phone-call button, which is
      // a top-level <a> too but not a nav destination.
      const navOrder = await page.evaluate(() =>
        [...document.querySelectorAll('.desktop-nav > ul > li > a')]
          .map((a) => a.textContent.trim())
          .filter((txt) => txt !== 'Contact Us'))
      // "Gallery" was removed — it pointed at /services, the same
      // destination as the Services item directly above it.
      const expectedOrder = ['Home', 'Services', 'Podcast', 'About us', 'Contact']
      t.ok('nav order is Home, Services, Podcast, About us, Contact',
        JSON.stringify(navOrder) === JSON.stringify(expectedOrder), JSON.stringify(navOrder))
      const wheel = await page.$$('.wheel-slide')
      t.ok('services wheel has 4 slides', wheel.length === 4, `got ${wheel.length}`)
      t.ok('chatbot launcher present', await page.$('.chatbot-launcher') !== null)

      // SEO: baseline <head> metadata for the home route, set by
      // Seo.jsx from seo.home.* in translation.json. Also confirms the
      // upsert lookups (Seo.jsx §1) find exactly one of each tag rather
      // than accumulating duplicates on first mount.
      const seoHome = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        hreflang: document.querySelector('link[rel="alternate"][hreflang="x-default"]')?.getAttribute('href'),
        metaDescCount: document.querySelectorAll('meta[name="description"]').length,
        canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
        hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang="x-default"]').length,
        jsonLdCount: document.querySelectorAll('script[type="application/ld+json"]').length
      }))
      t.ok('home <title> matches seo.home.title',
        seoHome.title === 'Video Production Company in Richmond, VA | Vyewfinder Films', seoHome.title)
      t.ok('home meta description matches seo.home.description',
        seoHome.description === 'Vyewfinder Films is an audiovisual production company in Richmond, VA. We create video, photography, and podcast content that makes clients choose you. Est. 2017.',
        seoHome.description)
      t.ok('home canonical is the self-referential root URL (trailing slash kept)',
        seoHome.canonical === 'https://vyewfinderfilms.com/', seoHome.canonical)
      t.ok('hreflang x-default equals canonical (self-referential, no per-language alternates)',
        seoHome.hreflang === seoHome.canonical, JSON.stringify(seoHome))
      t.ok('exactly one meta description / canonical / hreflang tag on first mount (upsert, not append)',
        seoHome.metaDescCount === 1 && seoHome.canonicalCount === 1 && seoHome.hreflangCount === 1,
        JSON.stringify(seoHome))
      t.ok('exactly one LocalBusiness JSON-LD script tag', seoHome.jsonLdCount === 1, seoHome.jsonLdCount)

      // every wheel slide carries its own visible label ("text at the
      // edge of every image"), not just the active slide's caption
      const wheelLabels = await page.$$('.wheel-slide-label')
      t.ok('every wheel slide has a label', wheelLabels.length === 4, `got ${wheelLabels.length}`)

      // no wheel slide's painted box drops into the copy sitting below
      // the stage — this is the specific overlap bug item 2 fixed.
      // The section only reaches its resting position once its
      // scroll-triggered entrance (gsap.from, y:60/opacity:0) has run,
      // so scroll it into view first rather than measuring it pre-animation.
      await page.evaluate(() => document.querySelector('.services-wheel')?.scrollIntoView())
      await wait(1000)
      const overlap = await page.evaluate(() => {
        const uiTop = document.querySelector('.wheel-ui')?.getBoundingClientRect().top
        return [...document.querySelectorAll('.wheel-slide')].some((s) => {
          const r = s.getBoundingClientRect()
          return parseFloat(getComputedStyle(s).opacity) > 0.05 && r.bottom > uiTop
        })
      })
      t.ok('no wheel slide overlaps the copy below it', !overlap)

      // scroll-driven mask scenes (DM + Podcast + Photography): each
      // renders with its shaped clip-path, CTAs route to the right
      // pages, and the shape actually grows while the section is
      // pinned — the serotoninn.com-style reveal that replaced the old
      // case cards. DM runs the iPhone silhouette (client request),
      // Podcast the mic, Photography the camera, in that order after
      // Services.
      const scenes = await page.$$('.shape-scene')
      t.ok('three shape-reveal scenes render (DM + Podcast + Photography)',
        scenes.length === 3, `got ${scenes.length}`)
      const dmClip = await page.evaluate(() =>
        document.querySelector('.dm-section .shape-mask')?.style.clipPath || '')
      t.ok('DM mask carries the iPhone clip-path', dmClip.includes('shape-clip-dm'), dmClip)
      const pcClip = await page.evaluate(() =>
        document.querySelector('.podcast-section .shape-mask')?.style.clipPath || '')
      t.ok('Podcast mask carries the mic clip-path', pcClip.includes('shape-clip-podcast'), pcClip)
      const phClip = await page.evaluate(() =>
        document.querySelector('.photography-section .shape-mask')?.style.clipPath || '')
      t.ok('Photography mask carries its own camera clip-path',
        phClip.includes('shape-clip-photography'), phClip)
      const dmCta = await page.evaluate(() =>
        document.querySelector('.dm-section .case-link')?.getAttribute('href'))
      t.ok('DM scene CTA routes to the digital-marketing gallery',
        dmCta === '/services/digital-marketing', dmCta)
      const pcCta = await page.evaluate(() =>
        document.querySelector('.podcast-section .case-link')?.getAttribute('href'))
      t.ok('Podcast scene CTA routes to /podcast', pcCta === '/podcast', pcCta)
      const phCta = await page.evaluate(() =>
        document.querySelector('.photography-section .case-link')?.getAttribute('href'))
      t.ok('Photography scene CTA routes to the photography gallery',
        phCta === '/services/photography', phCta)

      // Photography sits after Podcast in the DOM, not next to DM —
      // two camera silhouettes back to back would read as a repeat.
      // (DigitalMarketing passes no `sectionId`, so its section carries
      // no id; class names are the stable handle here.)
      const sceneOrder = await page.evaluate(() =>
        [...document.querySelectorAll('.shape-scene')]
          .map((s) => [...s.classList].find((c) => c !== 'shape-scene')))
      t.ok('shape scenes run dm -> podcast -> photography',
        JSON.stringify(sceneOrder) ===
          JSON.stringify(['dm-section', 'podcast-section', 'photography-section']),
        JSON.stringify(sceneOrder))

      const dmTop = await page.evaluate(() => {
        const el = document.querySelector('.dm-section')
        return el.getBoundingClientRect().top + window.scrollY
      })
      await page.evaluate((y) => window.scrollTo(0, y), dmTop)
      await wait(700)
      const maskAtStart = await page.evaluate(() =>
        document.querySelector('.dm-section .shape-mask').getBoundingClientRect().width)
      // 1.4 viewport-heights into the 230%-long pin ≈ 60% progress
      await page.evaluate((y) => window.scrollTo(0, y), dmTop + 900 * 1.4)
      await wait(700)
      const maskAtMid = await page.evaluate(() =>
        document.querySelector('.dm-section .shape-mask').getBoundingClientRect().width)
      t.ok('DM mask grows under scroll (pinned scrub reveal)',
        maskAtMid > maskAtStart * 1.5, `${Math.round(maskAtStart)}px -> ${Math.round(maskAtMid)}px`)

      // Three ShapeReveal scenes now run back-to-back (DM -> Podcast ->
      // Photography, ~10 viewport-heights of pinned scrolling total per
      // the design spec's placement decision — that total length is a
      // known, accepted trade-off and is NOT asserted against here).
      // What IS asserted: each scene pins, zooms and releases cleanly on
      // its own, and ScrollTrigger never confuses which scene is
      // currently active while three pins run in sequence — a scene that
      // hasn't been reached yet must stay fully at rest, and a scene
      // already scrolled past must stay fully revealed, not reset.
      await page.evaluate(() => window.scrollTo(0, 0))
      await wait(300)
      const sceneTops = await page.evaluate(() => {
        const abs = (sel) => {
          const el = document.querySelector(sel)
          return el.getBoundingClientRect().top + window.scrollY
        }
        return { dm: abs('.dm-section'), podcast: abs('.podcast-section'), photography: abs('.photography-section') }
      })
      const readScene = (sel) => page.evaluate((s) => {
        const el = document.querySelector(s)
        const mask = el.querySelector('.shape-mask')
        const overlay = el.querySelector('.shape-overlay')
        return {
          maskWidth: mask.getBoundingClientRect().width,
          overlayOpacity: parseFloat(getComputedStyle(overlay).opacity),
          rectTop: el.getBoundingClientRect().top
        }
      }, sel)
      const scrollTo = async (y) => { await page.evaluate((yy) => window.scrollTo(0, yy), y); await wait(600) }

      const pinScenes = [
        { key: 'dm', sel: '.dm-section', top: sceneTops.dm },
        { key: 'podcast', sel: '.podcast-section', top: sceneTops.podcast },
        { key: 'photography', sel: '.photography-section', top: sceneTops.photography }
      ]

      for (let i = 0; i < pinScenes.length; i++) {
        const { sel, top } = pinScenes[i]

        await scrollTo(top + 20)
        const start = await readScene(sel)
        t.ok(`${sel} sits small and un-revealed right as its pin engages`,
          start.maskWidth < 500 && start.overlayOpacity < 0.1,
          `mask ${Math.round(start.maskWidth)}px, overlay ${start.overlayOpacity}`)

        await scrollTo(top + 900 * 1.4)
        const mid = await readScene(sel)
        t.ok(`${sel} mask grows mid-pin`,
          mid.maskWidth > start.maskWidth * 1.5, `${Math.round(start.maskWidth)}px -> ${Math.round(mid.maskWidth)}px`)

        // While this scene is mid-pin, confirm the other two aren't
        // confused: not-yet-reached scenes are still fully at rest,
        // already-released scenes are still fully revealed.
        for (let j = 0; j < pinScenes.length; j++) {
          if (j === i) continue
          const other = await readScene(pinScenes[j].sel)
          if (j < i) {
            t.ok(`${pinScenes[j].sel} stays fully revealed while ${sel} is mid-pin (no reset)`,
              other.overlayOpacity > 0.9 && other.maskWidth > 3000,
              `overlay ${other.overlayOpacity}, mask ${Math.round(other.maskWidth)}px`)
          } else {
            t.ok(`${pinScenes[j].sel} hasn't started yet while ${sel} is mid-pin (no early-fire)`,
              other.overlayOpacity < 0.05 && other.maskWidth < 500,
              `overlay ${other.overlayOpacity}, mask ${Math.round(other.maskWidth)}px`)
          }
        }

        await scrollTo(top + 900 * 2.2)
        const late = await readScene(sel)
        t.ok(`${sel} overlay copy fades in near the end of its pin`,
          late.overlayOpacity > 0.8, late.overlayOpacity)

        await scrollTo(top + 3200)
        const released = await readScene(sel)
        t.ok(`${sel} releases its pin cleanly and scrolls out of the way`,
          released.rectTop < -500, released.rectTop)
        t.ok(`${sel} stays fully revealed after release, not reset`,
          released.overlayOpacity > 0.9 && released.maskWidth > 3000,
          `overlay ${released.overlayOpacity}, mask ${Math.round(released.maskWidth)}px`)
      }

      // services dropdown: reduced to 3 sub-links (Social Media merged
      // into Digital Marketing) and renders an opaque themed panel
      // rather than the transparent one caused by undefined CSS vars
      await page.hover('.has-dropdown > a')
      await wait(300)
      const subLinks = await page.evaluate(() =>
        [...document.querySelectorAll('.dropdown-menu a')].map((a) => a.textContent.trim()))
      t.ok('dropdown has exactly 3 sub-links (Social Media merged away)',
        subLinks.length === 3, JSON.stringify(subLinks))
      const dropdownBg = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.dropdown-menu')).backgroundColor)
      t.ok('dropdown background is opaque, not transparent',
        !!dropdownBg && dropdownBg !== 'rgba(0, 0, 0, 0)' && !dropdownBg.includes('transparent'), dropdownBg)

      // theme-toggle hover preview: shows a label without flipping the
      // live theme until actually clicked
      const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme)
      await page.hover('.theme-toggle')
      await wait(400)
      const themeDuringHover = await page.evaluate(() => document.documentElement.dataset.theme)
      const previewOpacity = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.theme-preview')).opacity)
      const previewLabel = await page.evaluate(() =>
        document.querySelector('.theme-preview-label')?.textContent || '')
      t.ok('theme preview does not flip the live theme on hover', themeBefore === themeDuringHover)
      t.ok('theme preview panel becomes visible on hover', parseFloat(previewOpacity) > 0.5, previewOpacity)
      t.ok('theme preview shows "Try X theme!" copy', /Try (Light|Dark) theme!/.test(previewLabel), previewLabel)

      // nav "Contact Us" button + Instagram section both had placeholder
      // phone numbers / stock imagery — verify the real fixes landed
      const contactBtnTel = await page.evaluate(() =>
        document.querySelector('.btn-contact-us')?.getAttribute('href'))
      t.ok('nav Contact Us button uses the real business phone number',
        contactBtnTel === 'tel:18049980564', contactBtnTel)

      // Instagram section: an image grid drawn from the same media pool
      // as the service galleries (real client photography, no stock
      // stills), linking out to the profile — not a live embed, so
      // there is no third-party script or iframe here to hydrate.
      const instaItems = await page.$$('.instagram-item')
      t.ok('instagram grid renders 6 tiles (2 each from 3 services)',
        instaItems.length === 6, `got ${instaItems.length}`)

      const instaHrefs = await page.evaluate(() =>
        [...document.querySelectorAll('.instagram-item')].map((a) => a.getAttribute('href')))
      t.ok('every instagram tile links to the real profile',
        instaHrefs.every((href) => href === 'https://www.instagram.com/vyewfinderfilms/'),
        JSON.stringify(instaHrefs))

      const instaImgDims = await page.evaluate(() =>
        [...document.querySelectorAll('.instagram-item img')].map((img) => ({
          w: img.getAttribute('width'), h: img.getAttribute('height')
        })))
      t.ok('every instagram tile image carries explicit width/height (CLS)',
        instaImgDims.every((d) => d.w && d.h), JSON.stringify(instaImgDims))

      // Same grid must still be there (not orphaned React state) after a
      // client-side remount away and back.
      await page.click('.desktop-nav a[href="/about"]')
      await wait(800)
      t.ok('instagram: client-side nav away from home', page.url().endsWith('/about'), page.url())

      // SEO: a client-side route change (no full page load) must
      // upsert, not append — exactly one of each tag, updated to the
      // new route's copy. This is the specific scenario an
      // append-instead-of-upsert bug would show up in.
      const seoAfterNav = await page.evaluate(() => ({
        title: document.title,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        metaDescCount: document.querySelectorAll('meta[name="description"]').length,
        canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
        hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang="x-default"]').length
      }))
      t.ok('client-side nav to /about updates the title',
        seoAfterNav.title === 'About Us | Vyewfinder Films, Richmond VA Production Company', seoAfterNav.title)
      t.ok('client-side nav to /about updates the canonical to /about',
        seoAfterNav.canonical === 'https://vyewfinderfilms.com/about', seoAfterNav.canonical)
      t.ok('still exactly one description/canonical/hreflang tag after a client-side route change',
        seoAfterNav.metaDescCount === 1 && seoAfterNav.canonicalCount === 1 && seoAfterNav.hreflangCount === 1,
        JSON.stringify(seoAfterNav))

      await page.click('.logo')
      await wait(800)
      t.ok('instagram: client-side nav back to home', page.url() === BASE + '/', page.url())
      const remountItems = await page.$$('.instagram-item')
      t.ok('instagram grid re-renders after remount (6 tiles)',
        remountItems.length === 6, `got ${remountItems.length}`)

      const seoAfterNavBack = await page.evaluate(() => ({
        title: document.title,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        metaDescCount: document.querySelectorAll('meta[name="description"]').length,
        canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
        hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang="x-default"]').length
      }))
      t.ok('client-side nav back to / restores the home title',
        seoAfterNavBack.title === 'Video Production Company in Richmond, VA | Vyewfinder Films', seoAfterNavBack.title)
      t.ok('client-side nav back to / restores the root canonical',
        seoAfterNavBack.canonical === 'https://vyewfinderfilms.com/', seoAfterNavBack.canonical)
      t.ok('still exactly one description/canonical/hreflang tag after two client-side route changes',
        seoAfterNavBack.metaDescCount === 1 && seoAfterNavBack.canonicalCount === 1 && seoAfterNavBack.hreflangCount === 1,
        JSON.stringify(seoAfterNavBack))

      // testimonials: one review on screen at a time in a centered card
      // (avatar monogram, stars, quote, attribution), with a row of dots
      // below to jump directly to any review.
      await page.evaluate(() => document.querySelector('.testimonials-section')?.scrollIntoView())
      await wait(800)
      // The default scrollIntoView() can rest with the nav row inside
      // the fixed bottom chat dock's band (centered, z-index 8000) —
      // real coordinate clicks land on the dock instead of the arrow
      // underneath. Re-center specifically on the nav row before any
      // click test touches it, same as a real visitor scrolling a
      // little further to actually see the control they're aiming for.
      await page.evaluate(() =>
        document.querySelector('.testimonial-nav-row')?.scrollIntoView({ block: 'center' }))
      await wait(400)
      // Review count is content, not structure — derived here so adding
      // or removing a review doesn't turn this suite red on its own.
      const slideCount = (await page.$$('.testimonial-slide')).length
      t.ok('testimonials mount every review as a slide', slideCount > 0, `got ${slideCount}`)
      const activeCount = (await page.$$('.testimonial-slide.is-active')).length
      t.ok('exactly one testimonial slide is active', activeCount === 1, `got ${activeCount}`)
      // innerText, not textContent: the heading is split into per-word
      // spans by the text reveal, and textContent concatenates those
      // without inter-word spaces (same trap as the digital-marketing
      // gallery heading check).
      const testimonialHeading = await page.evaluate(() =>
        document.querySelector('.testimonials-heading')?.innerText.replace(/\s+/g, ' ').trim())
      t.ok('testimonials heading is the sentence-style reference copy',
        testimonialHeading === 'What our clients say', testimonialHeading)
      const dotCount = (await page.$$('.testimonial-dot')).length
      t.ok('one dot renders per review', dotCount === slideCount, `got ${dotCount} dots, ${slideCount} slides`)

      // Slides are sorted shortest quote first, longest last.
      const quoteLengths = await page.evaluate(() =>
        [...document.querySelectorAll('.testimonial-quote')].map((q) => q.textContent.length))
      const sorted = [...quoteLengths].sort((a, b) => a - b)
      t.ok('slides are ordered shortest quote to longest',
        JSON.stringify(quoteLengths) === JSON.stringify(sorted), JSON.stringify(quoteLengths))

      // Clicking a dot jumps straight to that review and pins the
      // carousel, so the auto-rotate cannot race the assertions below.
      const readState = () => page.evaluate(() => ({
        slideIndex: [...document.querySelectorAll('.testimonial-slide')].findIndex((s) => s.classList.contains('is-active')),
        dotIndex: [...document.querySelectorAll('.testimonial-dot')].findIndex((d) => d.classList.contains('is-active'))
      }))
      const startState = await readState()
      t.ok('active dot matches active slide on load',
        startState.dotIndex === startState.slideIndex, JSON.stringify(startState))

      const lastIndex = slideCount - 1
      await page.click(`.testimonial-dot:nth-child(${lastIndex + 1})`)
      await wait(700)
      const afterLast = await readState()
      t.ok('clicking the last dot jumps straight to the last review',
        afterLast.slideIndex === lastIndex && afterLast.dotIndex === lastIndex, JSON.stringify(afterLast))

      await page.click('.testimonial-dot:nth-child(1)')
      await wait(700)
      const afterFirst = await readState()
      t.ok('clicking the first dot jumps back to the first review',
        afterFirst.slideIndex === 0 && afterFirst.dotIndex === 0, JSON.stringify(afterFirst))

      // Prev/next arrows flank the dots as a visible scroll affordance
      // and wrap in both directions.
      t.ok('prev and next arrows render',
        await page.$('.testimonial-arrow--prev') !== null && await page.$('.testimonial-arrow--next') !== null)

      await page.click('.testimonial-arrow--next')
      await wait(700)
      const afterArrowNext = await readState()
      t.ok('next arrow advances one review',
        afterArrowNext.slideIndex === 1 && afterArrowNext.dotIndex === 1, JSON.stringify(afterArrowNext))

      await page.click('.testimonial-arrow--prev')
      await wait(700)
      const afterArrowPrev = await readState()
      t.ok('prev arrow steps back to the review before it',
        afterArrowPrev.slideIndex === 0 && afterArrowPrev.dotIndex === 0, JSON.stringify(afterArrowPrev))

      await page.click('.testimonial-arrow--prev')
      await wait(700)
      const afterArrowWrap = await readState()
      t.ok('prev arrow wraps from the first review to the last',
        afterArrowWrap.slideIndex === lastIndex && afterArrowWrap.dotIndex === lastIndex, JSON.stringify(afterArrowWrap))

      // The card is sized by the longest quote, so jumping between
      // reviews must never change the section's height (no page jump).
      const heightA = await page.evaluate(() =>
        document.querySelector('.testimonial-stage').getBoundingClientRect().height)
      await page.click(`.testimonial-dot:nth-child(${lastIndex + 1})`)
      await wait(700)
      const heightB = await page.evaluate(() =>
        document.querySelector('.testimonial-stage').getBoundingClientRect().height)
      t.ok('panel height is stable across slides (no layout jump)',
        Math.abs(heightA - heightB) < 1, `${Math.round(heightA)}px -> ${Math.round(heightB)}px`)

      // footer: newsletter form removed, hours updated (Sunday closed),
      // and every string routes through t() (spot-check EN then ES)
      await page.evaluate(() => document.querySelector('footer')?.scrollIntoView())
      await wait(500)
      t.ok('footer has no newsletter form', await page.$('.newsletter-form') === null)
      t.ok('footer has zero <input> elements (newsletter removed)',
        (await page.$$('footer input')).length === 0)
      const footerTextEn = await page.evaluate(() => document.querySelector('footer').textContent)
      t.ok('footer (EN) shows Sunday as Closed', footerTextEn.includes('Closed'))
      t.ok('footer (EN) shows the updated hours', footerTextEn.includes('9:00 am') && footerTextEn.includes('5:00 pm'))
      t.ok('footer (EN) copyright is correct, no "@viewfinderfilms" misspelling',
        footerTextEn.includes('Vyewfinder Films') && !footerTextEn.includes('@viewfinderfilms'))

      await page.click('.lang-toggle')
      await wait(600)
      const footerTextEs = await page.evaluate(() => document.querySelector('footer').textContent)
      t.ok('footer (ES) shows Domingo/Cerrado, no residual English hours labels',
        footerTextEs.includes('Cerrado') && !footerTextEs.includes('Sunday') && !footerTextEs.includes('Closed'))

      // SEO: a mid-session language toggle must update title,
      // description AND <html lang> together — this is the specific
      // case Seo.jsx's props-are-keys contract (§1) and i18n.js's
      // syncHtmlLang (§4) exist for. HomePage() itself has no
      // useTranslation() hook, so this also proves Seo subscribes to
      // i18next on its own rather than relying on the parent re-rendering.
      const seoAfterToggle = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        lang: document.documentElement.lang
      }))
      t.ok('mid-session language toggle updates the title to Spanish',
        seoAfterToggle.title === 'Productora de Video en Richmond, VA | Vyewfinder Films', seoAfterToggle.title)
      t.ok('mid-session language toggle updates the meta description to Spanish',
        seoAfterToggle.description === 'Vyewfinder Films es una productora audiovisual en Richmond, VA. Creamos video, fotografía y podcast que hacen que los clientes te elijan. Est. 2017.',
        seoAfterToggle.description)
      t.ok('mid-session language toggle syncs <html lang> to es',
        seoAfterToggle.lang === 'es', seoAfterToggle.lang)

      // toggle back so nothing later in this check (or a human re-reading
      // it) assumes the page is stuck in Spanish
      await page.click('.lang-toggle')
      await wait(600)
      const seoAfterToggleBack = await page.evaluate(() => ({
        title: document.title,
        lang: document.documentElement.lang
      }))
      t.ok('toggling back updates the title back to English',
        seoAfterToggleBack.title === 'Video Production Company in Richmond, VA | Vyewfinder Films', seoAfterToggleBack.title)
      t.ok('toggling back syncs <html lang> to en',
        seoAfterToggleBack.lang === 'en', seoAfterToggleBack.lang)

      // theme toggle actually flips document state
      const before = await page.evaluate(() => document.documentElement.dataset.theme)
      await page.click('.theme-toggle')
      await wait(500)
      const after = await page.evaluate(() => document.documentElement.dataset.theme)
      t.ok('theme toggle flips data-theme', before !== after, `${before} -> ${after}`)

      // ---- cookie consent banner ----
      // A fresh session (no vf-cookie-consent cookie yet) must show the
      // banner, and — since both it and the navbar are `position: fixed;
      // top: 0` — the navbar must have shifted down by exactly the
      // banner's own rendered height, not be hidden underneath it.
      t.ok('cookie banner shows on a fresh visit (no consent cookie yet)',
        await page.$('.cookie-banner') !== null)
      const bannerHeight = await page.evaluate(() =>
        document.querySelector('.cookie-banner')?.getBoundingClientRect().height)
      const navTop = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector('.navbar')).top))
      t.ok('navbar shifts down to clear the banner exactly (no gap, no overlap)',
        Math.abs(navTop - bannerHeight) < 1, `banner ${bannerHeight}px vs navbar top ${navTop}px`)
      const policyLinkHref = await page.evaluate(() =>
        document.querySelector('.cookie-banner a')?.getAttribute('href'))
      t.ok('banner links to the cookie policy page', policyLinkHref === '/cookie-policy', policyLinkHref)

      // Reject Non-Essential: banner closes, consent cookie records every
      // optional category as false (necessary is never optional).
      await page.click('.cookie-banner-btn--outline')
      await wait(400)
      const rejectState = await page.evaluate(() => ({
        bannerGone: document.querySelector('.cookie-banner') === null,
        navTop: getComputedStyle(document.querySelector('.navbar')).top,
        consent: JSON.parse(decodeURIComponent(document.cookie.match(/vf-cookie-consent=([^;]*)/)?.[1] || 'null'))
      }))
      t.ok('reject non-essential dismisses the banner', rejectState.bannerGone)
      t.ok('navbar returns to top:0 once the banner is gone', rejectState.navTop === '0px', rejectState.navTop)
      t.ok('reject non-essential records every optional category as false',
        rejectState.consent?.necessary === true &&
        rejectState.consent?.functional === false &&
        rejectState.consent?.analytics === false &&
        rejectState.consent?.marketing === false,
        JSON.stringify(rejectState.consent))

      // Cookie Settings (footer) reopens the panel and its Accept-All
      // path records every category true.
      await page.evaluate(() => document.querySelector('.footer')?.scrollIntoView())
      await wait(400)
      await page.click('.footer-legal button')
      await wait(400)
      const switches = await page.$$('.cookie-switch')
      t.ok('settings panel opens with one toggle per optional category (3)',
        switches.length === 3, `got ${switches.length}`)
      // flip all three on, then Save
      for (const sw of switches) await sw.click()
      await page.click('.cookie-settings-actions .btn-primary')
      await wait(400)
      const acceptState = await page.evaluate(() =>
        JSON.parse(decodeURIComponent(document.cookie.match(/vf-cookie-consent=([^;]*)/)?.[1] || 'null')))
      t.ok('saving all three toggles on records full consent',
        acceptState?.functional === true && acceptState?.analytics === true && acceptState?.marketing === true,
        JSON.stringify(acceptState))

      // Reset to an undecided state so later CHECKS (podcast's consent
      // gate in particular) see a fresh visitor, not this test's choice —
      // Puppeteer pages share one cookie jar across the whole run.
      await page.deleteCookie({ name: 'vf-cookie-consent' })
    }
  },
  {
    name: 'services',
    path: '/services',
    assert: async (page, t) => {
      t.ok('media grid tiles render', (await page.$$('.media-tile')).length > 0)

      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('services <title> matches seo.services.title',
        seo.title === 'Video, Photography & Podcast Services | Vyewfinder Films', seo.title)
      t.ok('services meta description matches seo.services.description',
        seo.description === 'Commercial video, product and real estate photography, social media content, and podcast production in Richmond, VA. See what Vyewfinder Films can do for your brand.',
        seo.description)
    }
  },
  {
    name: 'services/photography gallery',
    path: '/services/photography',
    settleMs: 6000,
    assert: async (page, t) => {
      t.ok('scroll wall renders tiles', (await page.$$('.wall-tile')).length > 0)
      const chips = await page.evaluate(() =>
        [...document.querySelectorAll('.service-keyword')].map((c) => c.textContent.trim()))
      t.ok('photography gallery shows the 4 new keyword chips', chips.length === 4, JSON.stringify(chips))
      t.ok('photography gallery has no highlight callout (digital-marketing only)',
        await page.$('.service-highlight') === null)

      // SEO: gallery title/description interpolate the service name
      // (values={{ service: t(service.titleKey) }}) — no per-slug copy.
      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('gallery <title> interpolates the service name (Photography)',
        seo.title === 'Photography — Selected Work | Vyewfinder Films', seo.title)
      t.ok('gallery meta description interpolates the service name (Photography)',
        seo.description === 'Selected Photography work by Vyewfinder Films, an audiovisual production company in Richmond, VA. Photos and video from real client projects.',
        seo.description)
    }
  },
  {
    name: 'services/digital-marketing gallery (merged Social Media)',
    path: '/services/digital-marketing',
    settleMs: 6000,
    assert: async (page, t) => {
      // textContent picks up the SplitType text-reveal DOM as one
      // continuous string with no inter-line space; innerText mirrors
      // rendered line breaks so it reassembles the header correctly.
      const heading = await page.evaluate(() =>
        document.querySelector('h1')?.innerText.replace(/\s+/g, ' ').trim())
      t.ok('header reads the merged "Digital Marketing and Social Media" title',
        heading === 'Digital Marketing and Social Media', heading)

      const chips = await page.evaluate(() =>
        [...document.querySelectorAll('.service-keyword')].map((c) => c.textContent.trim()))
      t.ok('digital-marketing gallery shows all 6 keyword chips', chips.length === 6, JSON.stringify(chips))

      const highlight = await page.evaluate(() => document.querySelector('.service-highlight')?.textContent)
      t.ok('digital-marketing gallery shows the highlight callout', !!highlight, highlight)

      t.ok('scroll wall renders tiles (merged media pool)', (await page.$$('.wall-tile')).length > 0)

      // SEO: gallery title interpolates the merged service's title key
      // (services.items.digitalMarketing.title, not a generic label).
      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('gallery <title> interpolates the service name (Digital Marketing and Social Media)',
        seo.title === 'Digital Marketing and Social Media — Selected Work | Vyewfinder Films', seo.title)
      t.ok('gallery meta description interpolates the service name (Digital Marketing and Social Media)',
        seo.description === 'Selected Digital Marketing and Social Media work by Vyewfinder Films, an audiovisual production company in Richmond, VA. Photos and video from real client projects.',
        seo.description)
    }
  },
  {
    name: 'services/corporate-video gallery',
    path: '/services/corporate-video',
    settleMs: 6000,
    assert: async (page, t) => {
      const chips = await page.evaluate(() =>
        [...document.querySelectorAll('.service-keyword')].map((c) => c.textContent.trim()))
      t.ok('corporate-video gallery shows the 5 new keyword chips', chips.length === 5, JSON.stringify(chips))
      t.ok('corporate-video gallery has no highlight callout (digital-marketing only)',
        await page.$('.service-highlight') === null)

      const seo = await page.evaluate(() => ({ title: document.title }))
      t.ok('gallery <title> interpolates the service name (Corporate Video)',
        seo.title === 'Corporate Video — Selected Work | Vyewfinder Films', seo.title)
    }
  },
  {
    name: 'services/social-media (removed slug redirects)',
    path: '/services/social-media',
    assert: async (page, t) => {
      // Social Media was merged into Digital Marketing; the slug no
      // longer exists in services.js, so ServiceGallery redirects any
      // unrecognised :slug back to /services instead of 404ing.
      t.ok('unknown /services/social-media slug redirects to /services',
        page.url().endsWith('/services'), page.url())

      // SEO: <Seo> in ServiceGallery sits below the `if (!service)`
      // redirect guard specifically so an unknown slug never writes a
      // gallery title before bouncing. Confirm the page that actually
      // renders after the redirect (ServicesPage) is the one that owns
      // the title — not a stale/blank/mis-interpolated gallery title.
      const title = await page.evaluate(() => document.title)
      t.ok('redirect from an unknown slug shows the /services title, not a stale gallery title',
        title === 'Video, Photography & Podcast Services | Vyewfinder Films', title)
    }
  },
  {
    name: 'podcast',
    path: '/podcast',
    settleMs: 6000,
    assert: async (page, t) => {
      t.ok('hero title renders', await page.$('.podcast-hero-title') !== null)
      t.ok('FAQ items render', (await page.$$('.podcast-faq-item')).length > 0)

      // "Live streaming" was removed from "What we produce" this round
      const formatTitles = await page.evaluate(() =>
        [...document.querySelectorAll('.podcast-format-title')].map((h) => h.textContent.trim()))
      t.ok('formats grid shows 5 cards with no Live streaming card',
        formatTitles.length === 5 && !formatTitles.some((s) => /live/i.test(s)),
        JSON.stringify(formatTitles))

      // YouTube section, populated state (embedsocial spotlight + list):
      // podcastPage.youtube.videos now holds 5 real channel videos, so
      // the "visit the channel" facade card is replaced by one
      // autoplaying-muted spotlight iframe plus 4 click-through
      // thumbnail rows.
      t.ok('youtube facade card is gone now that real videos exist',
        await page.$('#youtube .podcast-youtube-card') === null)

      // The spotlight is a live third-party embed (sets YouTube/Google
      // cookies), so it's consent-gated: a fresh visitor with no cookie
      // choice yet sees a poster + explicit opt-in, not an auto-loading
      // iframe. See CookieConsentContext / the "Functional" category.
      t.ok('spotlight is consent-gated before any cookie choice is made',
        await page.$('#youtube .podcast-youtube-spotlight-gate') !== null &&
        await page.$('#youtube .podcast-youtube-spotlight-frame') === null)

      await page.click('#youtube .podcast-youtube-spotlight-gate-actions .btn-primary')
      await wait(600)

      const spotlightSrc = await page.evaluate(() =>
        document.querySelector('#youtube .podcast-youtube-spotlight-frame')?.getAttribute('src') || '')
      t.ok('after granting consent, spotlight embeds the newest channel video',
        spotlightSrc.includes('/embed/At59vMU1WRU'), spotlightSrc)
      t.ok('spotlight autoplays muted and loops',
        spotlightSrc.includes('autoplay=1') && spotlightSrc.includes('mute=1') && spotlightSrc.includes('loop=1'),
        spotlightSrc)
      const consentCookie = await page.evaluate(() => document.cookie.includes('vf-cookie-consent'))
      t.ok('granting consent from the video gate persists a consent cookie', consentCookie)
      const listHrefs = await page.evaluate(() =>
        [...document.querySelectorAll('#youtube .podcast-youtube-list-item')].map((a) => a.getAttribute('href')))
      t.ok('4 more channel videos render as click-through thumbnails',
        listHrefs.length === 4 && listHrefs.every((h) => h.startsWith('https://www.youtube.com/watch?v=')),
        JSON.stringify(listHrefs))
      const ytCtaHref = await page.evaluate(() =>
        document.querySelector('#youtube .podcast-youtube-cta')?.getAttribute('href'))
      t.ok('youtube section CTA still links to the real channel handle',
        ytCtaHref === 'https://www.youtube.com/@vyewfinderfilmsrva', ytCtaHref)
      const blockOrder = await page.evaluate(() =>
        [...document.querySelectorAll('.podcast-block')].map((s) => s.id))
      t.ok('youtube section sits directly after the formats section',
        blockOrder.indexOf('youtube') === blockOrder.indexOf('formats') + 1, JSON.stringify(blockOrder))

      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('podcast <title> matches seo.podcast.title',
        seo.title === 'Podcast Production in Richmond, VA | Vyewfinder Films', seo.title)
      t.ok('podcast meta description matches seo.podcast.description',
        seo.description === 'Full-service podcast production in Richmond, VA: recording, video, and editing. Vyewfinder Films helps your brand launch and grow a podcast that gets seen.',
        seo.description)
    }
  },
  {
    name: 'about',
    path: '/about',
    assert: async (page, t) => {
      t.ok('page renders a heading', await page.$('h1') !== null)

      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('about <title> matches seo.about.title',
        seo.title === 'About Us | Vyewfinder Films, Richmond VA Production Company', seo.title)
      t.ok('about meta description matches seo.about.description',
        seo.description === 'Since 2017, Vyewfinder Films has produced video, photography, and podcasts for brands in Richmond, VA. Meet the team behind the work.',
        seo.description)
    }
  },
  {
    name: 'contact',
    path: '/contact',
    assert: async (page, t) => {
      t.ok('contact form renders', await page.$('form') !== null)

      const seo = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('contact <title> matches seo.contact.title',
        seo.title === 'Contact | Vyewfinder Films, Richmond VA', seo.title)
      t.ok('contact meta description matches seo.contact.description (hyphenated phone, per spec)',
        seo.description === 'Ready to create video, photography, or podcast content for your brand? Contact Vyewfinder Films in Richmond, VA. Call 804-998-0564 or send a message.',
        seo.description)

      const heroTel = await page.evaluate(() =>
        document.querySelector('.contact-details a[href^="tel:"]')?.getAttribute('href'))
      t.ok('contact hero uses the real business phone number, not the placeholder',
        heroTel === 'tel:18049980564', heroTel)

      t.ok('success panel is not present before any submission', await page.$('.contact-success') === null)

      // lead.php has no PHP runtime to talk to in this sandbox (flagged
      // explicitly by the implementation notes) — intercept the POST so
      // the frontend's own success/error/in-flight handling can still
      // be verified without a real backend.
      let mockOk = false
      let capturedBody = null
      await page.setRequestInterception(true)
      page.on('request', (req) => {
        if (req.url().includes('/api/lead.php')) {
          capturedBody = req.postData()
          // Always HTTP 200 — a non-2xx status (which is what a real
          // lead.php validation/rate-limit failure returns) makes the
          // browser log its own "Failed to load resource" console
          // error, which would trip the harness's page-wide "no
          // console errors" check for a failure we triggered on
          // purpose. Encoding the failure in the JSON body instead
          // exercises the exact same submitLead()/Contact.jsx branch
          // (it only ever branches on `data.ok`, not on HTTP status).
          req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: mockOk, mailed: mockOk })
          })
        } else {
          req.continue()
        }
      })

      // These are React-controlled inputs — setting `.value` directly
      // via evaluate() doesn't survive React's next render, so fields
      // are only ever filled once, via real keystrokes, and reused
      // across both submissions below rather than re-cleared/re-typed.
      await page.type('#c-name', 'QA Smoke Test')
      await page.type('#c-email', 'qa-smoke@example.com')
      await page.type('#c-phone', '8045551234')
      await page.select('#c-purpose', 'project')
      await page.type('#c-message', 'Automated smoke test submission, safe to ignore.')

      // failure path first: success must not render on a failed POST,
      // and the filled-in form must stay mounted rather than being
      // discarded on error
      mockOk = false
      await page.click('button[type="submit"]')
      await wait(1200)
      t.ok('failed submit shows the .form-status--error banner',
        await page.$('.form-status--error') !== null)
      t.ok('failed submit keeps the filled form mounted (nothing discarded)',
        await page.$('.contact-form') !== null)
      const nameAfterFailure = await page.evaluate(() => document.querySelector('#c-name')?.value)
      t.ok('failed submit preserves what the visitor typed',
        nameAfterFailure === 'QA Smoke Test', nameAfterFailure)

      let parsedBody = null
      try { parsedBody = JSON.parse(capturedBody) } catch { /* leave null, assertion below fails */ }
      t.ok('POST body carries the contact form fields in the expected shape',
        !!parsedBody && parsedBody.lead_source === 'Website Contact Form' &&
        parsedBody.contact_name === 'QA Smoke Test' && parsedBody.email === 'qa-smoke@example.com',
        JSON.stringify(parsedBody))

      // success path: the panel is gated on {ok:true} from the server,
      // not shown unconditionally once client-side validation passes.
      // The form is still mounted with the same valid values from the
      // failed attempt above (that's the point of the previous
      // assertion), so this resubmits as-is rather than re-typing.
      mockOk = true
      await page.click('button[type="submit"]')
      await wait(1200)
      t.ok('successful submit ({ok:true}) shows the success panel',
        await page.$('.contact-success') !== null)

      await page.setRequestInterception(false)
    }
  },
  {
    name: 'cookie-policy',
    path: '/cookie-policy',
    assert: async (page, t) => {
      t.ok('page renders a heading', await page.$('h1') !== null)
      const heading = await page.evaluate(() => document.querySelector('h1')?.innerText)
      t.ok('heading is the cookie policy title', heading === 'Cookie Policy', heading)

      const sections = await page.$$('.cookie-policy-section')
      t.ok('renders all 9 policy sections', sections.length === 9, `got ${sections.length}`)

      const tableRows = await page.$$('.cookie-policy-table tbody tr')
      t.ok('cookies-we-use table lists exactly the 2 real cookies',
        tableRows.length === 2, `got ${tableRows.length}`)
      const firstCookieName = await page.evaluate(() =>
        document.querySelector('.cookie-policy-table tbody tr td')?.textContent)
      t.ok('table names the real theme cookie', firstCookieName === 'vf-theme', firstCookieName)

      t.ok('categories glossary renders', await page.$('.cookie-policy-deflist') !== null)

      const seoEn = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('cookie-policy <title> matches seo.cookiePolicy.title',
        seoEn.title === 'Cookie Policy | Vyewfinder Films', seoEn.title)
      t.ok('cookie-policy meta description matches seo.cookiePolicy.description',
        seoEn.description === 'How Vyewfinder Films uses cookies on vyewfinderfilms.com, which ones we set, and how to change your choice at any time.',
        seoEn.description)

      // The page's own "Cookie Settings" button re-opens the same panel
      // used everywhere else — not a second, disconnected settings UI.
      await page.click('.cookie-policy-settings-btn')
      await wait(400)
      t.ok('the page\'s Cookie Settings button opens the real settings panel',
        await page.$('.cookie-settings-panel') !== null)
      await page.keyboard.press('Escape')
      await wait(300)

      // bilingual parity
      await page.click('.lang-toggle')
      await wait(600)
      const esHeading = await page.evaluate(() => document.querySelector('h1')?.innerText)
      t.ok('heading translates to Spanish', esHeading === 'Política de cookies', esHeading)
      const esSections = await page.$$('.cookie-policy-section')
      t.ok('Spanish version has the same 9 sections', esSections.length === 9, `got ${esSections.length}`)

      const seoEs = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      }))
      t.ok('cookie-policy <title> translates to Spanish',
        seoEs.title === 'Política de cookies | Vyewfinder Films', seoEs.title)
      t.ok('cookie-policy meta description translates to Spanish',
        seoEs.description === 'Cómo usa Vyewfinder Films las cookies en vyewfinderfilms.com, cuáles instalamos y cómo cambiar tu elección en cualquier momento.',
        seoEs.description)
    }
  },
  {
    name: 'seo static files (robots.txt, sitemap.xml, JSON-LD)',
    path: '/',
    assert: async (page, t) => {
      // robots.txt and sitemap.xml are served straight from public/ by
      // Vite with no build step — confirm they're actually reachable at
      // runtime, not just present as source files in the repo. Fetched
      // directly (not via page.evaluate) so this exercises exactly what
      // a crawler requesting these URLs would get.
      const robotsRes = await fetch(`${BASE}/robots.txt`)
      const robotsBody = await robotsRes.text()
      t.ok('robots.txt is served with a 200', robotsRes.status === 200, robotsRes.status)
      t.ok('robots.txt allows crawling, disallows /api/, and points at the sitemap',
        robotsBody.includes('Allow: /') && robotsBody.includes('Disallow: /api/') &&
        robotsBody.includes('Sitemap: https://vyewfinderfilms.com/sitemap.xml'),
        robotsBody.slice(0, 200))

      const sitemapRes = await fetch(`${BASE}/sitemap.xml`)
      const sitemapBody = await sitemapRes.text()
      t.ok('sitemap.xml is served with a 200', sitemapRes.status === 200, sitemapRes.status)
      t.ok('sitemap.xml declaration is the first line',
        sitemapBody.trimStart().startsWith('<?xml'), sitemapBody.slice(0, 60))
      const sitemapUrls = ['/', '/services', '/podcast', '/about', '/contact']
        .map((p) => `https://vyewfinderfilms.com${p === '/' ? '/' : p}`)
      // Compare against the actual <loc> entries only — the file's own
      // explanatory comment intentionally mentions "/services/:slug" and
      // "/cookie-policy" as *excluded* paths, so a raw substring check
      // against the whole file false-positives on the comment text.
      const locEntries = [...sitemapBody.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
      t.ok('sitemap.xml lists exactly the 5 top-level URLs, no sub-galleries or cookie-policy',
        locEntries.length === 5 && sitemapUrls.every((u) => locEntries.includes(u)),
        JSON.stringify(locEntries))

      // LocalBusiness JSON-LD: fetched as raw HTML (not through
      // Puppeteer's rendered DOM) so this specifically verifies it's in
      // the BUILT dist/index.html itself, readable by a crawler that
      // never executes JS — not something React injected at runtime.
      const rawHtml = await fetch(`${BASE}/`).then((r) => r.text())
      const scriptMatches = [...rawHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      t.ok('exactly one JSON-LD script tag in the built index.html',
        scriptMatches.length === 1, scriptMatches.length)

      let jsonLd = null
      try { jsonLd = JSON.parse(scriptMatches[0]?.[1] ?? '') } catch { /* leave null, assertions below fail */ }
      t.ok('JSON-LD script parses as valid JSON', !!jsonLd, scriptMatches[0]?.[1]?.slice(0, 200))
      t.ok('JSON-LD @type is LocalBusiness', jsonLd?.['@type'] === 'LocalBusiness', jsonLd?.['@type'])
      t.ok('JSON-LD name is "Vyewfinder Films"', jsonLd?.name === 'Vyewfinder Films', jsonLd?.name)
      t.ok('JSON-LD url is the canonical bare domain (no www)',
        jsonLd?.url === 'https://vyewfinderfilms.com', jsonLd?.url)
      t.ok('JSON-LD telephone matches BUSINESS_PHONE_E164 (src/utils/leads.js)',
        jsonLd?.telephone === '+1-804-998-0564', jsonLd?.telephone)
      t.ok('JSON-LD email matches BUSINESS_EMAIL (src/utils/leads.js)',
        jsonLd?.email === 'info@vyewfinderfilms.com', jsonLd?.email)
      t.ok('JSON-LD foundingDate is "2017"', jsonLd?.foundingDate === '2017', jsonLd?.foundingDate)
      t.ok('JSON-LD address has no streetAddress (none on file — do not invent one)',
        jsonLd?.address?.['@type'] === 'PostalAddress' &&
        jsonLd?.address?.addressLocality === 'Richmond' &&
        jsonLd?.address?.addressRegion === 'VA' &&
        jsonLd?.address?.addressCountry === 'US' &&
        !('streetAddress' in (jsonLd?.address || {})),
        JSON.stringify(jsonLd?.address))
      t.ok('JSON-LD sameAs carries all 4 profiles, TikTok included with no tracking query string',
        Array.isArray(jsonLd?.sameAs) && jsonLd.sameAs.length === 4 &&
        jsonLd.sameAs.includes('https://www.tiktok.com/@vyewfinderfilms') &&
        !jsonLd.sameAs.some((u) => u.includes('?')),
        JSON.stringify(jsonLd?.sameAs))

      // index.html must NOT ship a static canonical/hreflang — Seo.jsx
      // owns those exclusively (§5b: a hardcoded one would point every
      // route at "/" until React mounts, which is worse than absent).
      t.ok('built index.html ships no static <link rel="canonical"> (Seo.jsx sets it, not the HTML baseline)',
        !rawHtml.includes('rel="canonical"'), rawHtml.includes('rel="canonical"'))
      t.ok('built index.html ships no static hreflang alternate (Seo.jsx sets it, not the HTML baseline)',
        !rawHtml.includes('hreflang='), rawHtml.includes('hreflang='))
    }
  }
]

/* ---------------------------------------------------------- */

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, stdio: 'inherit', ...opts })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))))
    child.on('error', reject)
  })
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await wait(300)
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`)
}

async function main() {
  const results = []

  console.log('Building…')
  await run('npm', ['run', 'build'], { timeout: BUILD_TIMEOUT_MS })

  console.log(`Starting preview server on :${PORT}…`)
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true })
  server.stdout?.on('data', () => {})
  server.stderr?.on('data', (d) => process.stderr.write(d))

  /* On Windows, `shell: true` runs the command through cmd.exe, so
     server.pid is cmd's PID, not vite's — server.kill() only kills the
     shell and leaves vite listening on PORT forever (confirmed: a run
     without this fix left the port bound after the process exited).
     `taskkill /T` kills the whole process tree instead. */
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (process.platform === 'win32' && server.pid) {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    } else if (!server.killed) {
      server.kill()
    }
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(130) })

  try {
    await wait(SERVER_BOOT_MS)
    await waitForServer(BASE, NAV_TIMEOUT_MS)

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
    })

    for (const check of CHECKS) {
      const page = await browser.newPage()
      await page.setViewport({ width: 1440, height: 900 })

      const consoleErrors = []
      const failedRequests = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
      page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)))
      page.on('requestfailed', (r) => {
        // aborted requests are normal (lazy video sourcing, cancelled
        // prefetches) — only a genuine failure should fail the check
        if (r.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(r.url().split('/').pop())
      })

      const local = []
      const t = {
        ok(label, cond, detail = '') {
          local.push({ label, pass: !!cond, detail })
        }
      }

      let crashed = null
      try {
        await page.goto(BASE + check.path, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
        await wait(check.settleMs ?? SETTLE_MS)
        await check.assert(page, t)
      } catch (err) {
        crashed = err.message.slice(0, 300)
      }

      t.ok('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
      t.ok('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 5).join(', '))
      if (crashed) local.push({ label: 'assertions ran without throwing', pass: false, detail: crashed })

      results.push({ name: check.name, path: check.path, local })
      await page.close()
    }

    await browser.close()
  } finally {
    cleanup()
  }

  console.log('\n' + '='.repeat(60))
  let failCount = 0
  for (const { name, path, local } of results) {
    console.log(`\n${name}  (${path})`)
    for (const { label, pass, detail } of local) {
      if (!pass) failCount += 1
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
    }
  }
  console.log('\n' + '='.repeat(60))
  const total = results.reduce((n, r) => n + r.local.length, 0)
  console.log(`${total - failCount}/${total} checks passed across ${results.length} pages`)

  if (failCount > 0) {
    console.log('\nSMOKE TESTS FAILED')
    process.exitCode = 1
  } else {
    console.log('\nSMOKE TESTS PASSED')
  }
}

main().catch((err) => {
  console.error('Smoke test run crashed:', err)
  process.exitCode = 1
})
