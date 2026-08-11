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
    // loader animation runs on first paint; the Instagram Reels widget
    // also needs time to fetch embed.js and swap in its five iframes
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

      // Instagram section: five real Instagram Reel embeds (oEmbed
      // widget, no credentials) in a Splide carousel.
      t.ok('the old fallback image grid is gone', await page.$('.instagram-item') === null)
      const reelSlides = await page.$$('.instagram-reel-slide')
      t.ok('instagram section renders 5 reel slides', reelSlides.length === 5, `got ${reelSlides.length}`)

      // embed.js swaps each blockquote for its own iframe. Asserting on
      // the iframes (not the blockquotes) is what distinguishes a live
      // playable embed from un-hydrated markup.
      const reelFrames = await page.evaluate(() =>
        [...document.querySelectorAll('.instagram-reels iframe')].map((f) => f.src))
      t.ok('all 5 reels hydrate into live Instagram iframes',
        reelFrames.length === 5, `got ${reelFrames.length}`)
      const SHORTCODES = ['DXsPvORBaAi', 'DWFP5pKlFJZ', 'DVzOTKtlIyv', 'C3Ts7t5sZLR', 'C2dbMlIO4hJ']
      t.ok('every client-supplied reel shortcode is embedded',
        SHORTCODES.every((code) => reelFrames.some((src) => src.includes(code))),
        JSON.stringify(reelFrames))

      const followHref = await page.evaluate(() =>
        document.querySelector('.instagram-section .btn-outline')?.getAttribute('href'))
      t.ok('instagram section has a follow CTA pointing at the profile',
        followHref === 'https://www.instagram.com/vyewfinderfilms/', followHref)

      // Flipping the theme while the reels are on screen must not touch
      // the widget's own subtree (it isn't themeable and React has no
      // reason to re-render it) and must not throw or drop any iframe.
      await page.evaluate(() => document.querySelector('.instagram-section')?.scrollIntoView())
      await wait(500)
      const themeBeforeReelsToggle = await page.evaluate(() => document.documentElement.dataset.theme)
      await page.click('.theme-toggle')
      await wait(800)
      const themeAfterReelsToggle = await page.evaluate(() => document.documentElement.dataset.theme)
      const reelsAfterThemeToggle = await page.$$('.instagram-reels iframe')
      t.ok('theme toggle actually flips while reels are visible',
        themeBeforeReelsToggle !== themeAfterReelsToggle, `${themeBeforeReelsToggle} -> ${themeAfterReelsToggle}`)
      t.ok('all 5 reel iframes survive a theme toggle (widget subtree untouched)',
        reelsAfterThemeToggle.length === 5, `got ${reelsAfterThemeToggle.length}`)
      // flip back so the rest of the page's checks run against a known
      // starting theme
      await page.click('.theme-toggle')
      await wait(500)

      // First third-party embed script in this codebase: embed.js must
      // load exactly once and re-hydrate all 5 reels on every client-side
      // remount, not just the initial full page load. Instagram's oEmbed
      // pipeline hydrates progressively over a few seconds per mount, so
      // this polls rather than asserting immediately after navigating
      // back.
      for (let round = 1; round <= 2; round += 1) {
        await page.click('.desktop-nav a[href="/about"]')
        await wait(800)
        t.ok(`SPA remount round ${round}: client-side nav away from home`,
          page.url().endsWith('/about'), page.url())

        await page.click('.logo')
        await wait(500)
        t.ok(`SPA remount round ${round}: client-side nav back to home`,
          page.url() === BASE + '/', page.url())

        let remountFrames = 0
        for (let poll = 0; poll < 8 && remountFrames < 5; poll += 1) {
          await wait(1000)
          remountFrames = await page.evaluate(() => document.querySelectorAll('.instagram-reels iframe').length)
        }
        t.ok(`SPA remount round ${round}: all 5 reels re-hydrate after remount`,
          remountFrames === 5, `got ${remountFrames}`)

        const remountScripts = await page.evaluate(() =>
          document.querySelectorAll('script[src*="instagram.com/embed.js"]').length)
        t.ok(`SPA remount round ${round}: embed.js is still loaded exactly once (not duplicated)`,
          remountScripts === 1, remountScripts)

        const remountShortcodes = await page.evaluate(() =>
          [...document.querySelectorAll('.instagram-reels iframe')].map((f) => f.src))
        t.ok(`SPA remount round ${round}: every reel shortcode is still present after remount`,
          SHORTCODES.every((code) => remountShortcodes.some((src) => src.includes(code))),
          JSON.stringify(remountShortcodes))
      }

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

      // theme toggle actually flips document state
      const before = await page.evaluate(() => document.documentElement.dataset.theme)
      await page.click('.theme-toggle')
      await wait(500)
      const after = await page.evaluate(() => document.documentElement.dataset.theme)
      t.ok('theme toggle flips data-theme', before !== after, `${before} -> ${after}`)
    }
  },
  {
    name: 'services',
    path: '/services',
    assert: async (page, t) => {
      t.ok('media grid tiles render', (await page.$$('.media-tile')).length > 0)
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
      const spotlightSrc = await page.evaluate(() =>
        document.querySelector('#youtube .podcast-youtube-spotlight-frame')?.getAttribute('src') || '')
      t.ok('spotlight embeds the newest channel video',
        spotlightSrc.includes('/embed/At59vMU1WRU'), spotlightSrc)
      t.ok('spotlight autoplays muted and loops',
        spotlightSrc.includes('autoplay=1') && spotlightSrc.includes('mute=1') && spotlightSrc.includes('loop=1'),
        spotlightSrc)
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
    }
  },
  {
    name: 'about',
    path: '/about',
    assert: async (page, t) => {
      t.ok('page renders a heading', await page.$('h1') !== null)
    }
  },
  {
    name: 'contact',
    path: '/contact',
    assert: async (page, t) => {
      t.ok('contact form renders', await page.$('form') !== null)

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
