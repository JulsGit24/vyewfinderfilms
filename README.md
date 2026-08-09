# Vyewfinder Films

Marketing site for Vyewfinder Films, an audiovisual production company in
Richmond, VA — video, photography, and podcast production. Single-page React app
with scroll-driven cinematics, a bilingual (EN/ES) content layer, light/dark
theming, and a conversational lead-capture assistant.

Production: <https://vyewfinderfilms.com>

---

## Stack

| | |
|---|---|
| Framework | React 18 (function components + hooks, no class components) |
| Build | Vite 5 |
| Routing | React Router 7, SPA, route-level code splitting |
| Styling | SCSS, one `.scss` per component, CSS custom properties for tokens |
| Animation | GSAP + ScrollTrigger, Framer Motion (mobile menu only), SplitType |
| Smooth scroll | Lenis (`@studio-freight/react-lenis`) |
| Carousels | Splide |
| i18n | i18next + react-i18next, EN/ES |
| Icons | lucide-react |
| Media pipeline | sharp + ffmpeg-static (build-time scripts, not shipped) |
| Tests | Puppeteer smoke suite |
| Backend | One PHP endpoint on shared hosting — there is no Node server |

## Quick start

```bash
npm install          # sharp and ffmpeg-static download binaries; give it a minute
npm run dev          # http://localhost:5173
```

Node 20+ (developed on 24). npm 9+.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally — **use this, not `dev`, to check anything scroll- or loader-related** |
| `npm test` | Build, boot a preview server, walk every route with Puppeteer |
| `npm run optimize:all` | Regenerate every web derivative from `media-src/` (see [Media pipeline](#media-pipeline)) |

There is no lint script. `eslint.config.mjs` is scaffold residue — ESLint is not
installed and the config is not wired to anything.

---

## ⚠️ Read this first: the Next.js ghosts

This repo was scaffolded from `create-next-app` and then rebuilt as a Vite SPA.
**The Next.js scaffolding was never deleted.** These files are dead — nothing
imports them, nothing builds them, and editing them has no effect on the site:

```
next.config.ts          tsconfig.json          postcss.config.mjs
eslint.config.mjs       src/app/               public/next.svg
public/vercel.svg       public/file.svg        public/globe.svg
public/window.svg
```

`src/app/page.tsx` and `src/app/layout.tsx` in particular look like the app's
entry points and are not. The real ones are:

```
index.html  →  src/main.jsx  →  src/App.jsx
```

This has already cost real time — one of them actively breaks the build if left
alone. `vite.config.js` declares `css: { postcss: {} }` specifically so Vite
stops auto-discovering the leftover `postcss.config.mjs`, which tries to load
`@tailwindcss/postcss` (not installed, not used — styling is SCSS throughout).
**Don't "clean up" that empty object.**

If you have an interest in deleting the dead scaffold, that's a welcome PR on its
own — just keep the `css: { postcss: {} }` guard until `postcss.config.mjs` is
actually gone.

---

## Project structure

```
index.html                 entry; also inlines the pre-paint theme script
src/
  main.jsx                 mounts React, ThemeProvider, i18n
  App.jsx                  routes, Lenis provider, ScrollTrigger wiring, home page order
  i18n.js                  i18next init; both locales imported statically
  index.scss               global styles + every design token
  components/              one Component.jsx + Component.scss per component
  pages/                   route components (lazy-loaded)
  context/ThemeContext.jsx light/dark, cookie-persisted
  data/
    services.js            service catalogue, reads mediaManifest.json
    chatbotFlow.js         the assistant's question flow
    mediaManifest.json     GENERATED — do not hand-edit
    clientsManifest.json   GENERATED — do not hand-edit
  locales/{en,es}/translation.json
  utils/
    animations.js          animateTextReveal — the shared type-reveal
    leads.js               lead delivery (WhatsApp + POST)
    siteReady.js           the gate that holds video back until the loader ends
scripts/                   media optimisation (build-time, Node)
tests/smoke.mjs            the whole test suite
public/                    served as-is; contains GENERATED media + api/lead.php
media-src/                 camera originals — GITIGNORED, ~465 MB (see below)
```

### Routing

Six routes, all in [src/App.jsx](src/App.jsx). The home page is a single scroll
composition; everything else is a lazy chunk:

```
/                       home (composed inline in App.jsx)
/services               ServicesPage
/services/:slug         ServiceGallery   — unknown slugs <Navigate> back to /services
/podcast                PodcastPage
/about                  About
/contact                Contact
```

**New routes must be lazy-loaded** (`React.lazy`) to match. A visitor landing on
the home page shouldn't download the galleries and the contact form first.

The `<Suspense fallback>` is deliberately `null` — the loader already covers first
paint, and a spinner flash on in-app navigation reads worse than a brief pause.

---

## Design system

Every colour, font, and surface is a CSS custom property defined in
[src/index.scss](src/index.scss). Two namespaces:

- `--brand-*` — the raw palette (charcoal, warm white, soft gold, …). Defined
  once, referenced by the semantic tokens. Don't use these in components.
- `--wst-*` — the semantic layer components actually consume:
  `--wst-color-text-primary`, `--wst-color-action`, `--wst-color-border-strong`,
  `--wst-logo-filter`, etc.

```scss
/* yes */   color: var(--wst-color-text-primary);
/* no  */   color: #F8F6F3;
```

**A hardcoded colour is a bug**, even when it looks right — it looks right in
exactly one theme and silently breaks the other. Same for `rgba(255,255,255,…)`
overlays; use `--wst-color-border`, `--wst-scrim-rgb`, or add a token.

### Theming

Light and dark, switched by `data-theme` on `<html>`, persisted in the `vf-theme`
cookie for a year. Light is the default — deliberately not `prefers-color-scheme`,
so a first visit looks the same for everyone.

Dark values live on `:root`; light overrides them under
`:root[data-theme='light']`. **A new token needs a value in both blocks.**

Two things must stay in sync with `DEFAULT_THEME` in
[src/context/ThemeContext.jsx](src/context/ThemeContext.jsx):

1. The inline script in [index.html](index.html), which applies the saved theme
   *before first paint* so the loader doesn't render in the wrong theme and snap.
2. Anything else reading the cookie directly.

`applyTheme()` writes the DOM attribute inside the event handler rather than only
from an effect — React runs effects child-first, so a provider-level effect lands
*after* its consumers', which is why the navbar used to lag a theme change until
the next scroll. Don't refactor that back into an effect-only flow.

### Type & spacing

`--font-primary` (Montserrat) for body, `--font-display` (Roboto) for display.
Both loaded from Google Fonts, preconnected in `index.html`. Spacing base is
`--wix-spacing-unit: 8px`.

---

## Bilingual content

**Every user-facing string must exist in both**
[`src/locales/en/translation.json`](src/locales/en/translation.json) **and**
[`src/locales/es/translation.json`](src/locales/es/translation.json), under the
same key path. A missing key renders the raw key to the visitor — `services.title`
in place of the heading.

```jsx
const { t } = useTranslation()
<h2>{t('testimonials.title')}</h2>
```

Both locale files are imported statically in [src/i18n.js](src/i18n.js) — there's
no HTTP backend, so a new locale means a new import, not a new file drop.

Spanish is a real translation, not a machine pass. If you're adding copy and can't
write the Spanish, say so in the PR rather than shipping an English string in the
`es` file — a visibly untranslated string is easier to spot and fix than one that
looks translated and isn't.

---

## Animation

Three layers, and it matters which one you reach for:

**1. Scroll position — Lenis.** Smooth scroll is app-wide, provided in `App.jsx`.
Lenis drives its own rAF loop (`autoRaf` defaults on); `ScrollSync` only forwards
its ticks to `ScrollTrigger.update()`. An earlier version handed the rAF job to
`gsap.ticker`, and when that wiring failed Lenis' loop never ran at all — which
silently broke every `lenis.scrollTo()`, i.e. all the nav links. Leave it
self-driving.

Programmatic scrolling goes through `useLenis()`, not `window.scrollTo`.

**2. Scroll-driven effects — GSAP + ScrollTrigger.** Registered once in
`App.jsx`. Anything that changes layout or splits text must call
`ScrollTrigger.refresh()` afterwards, or triggers stay measured against stale
positions. `ScrollToTop` already refreshes on route change.

**3. Type reveals — `animateTextReveal`** in
[src/utils/animations.js](src/utils/animations.js). Use this rather than writing a
new reveal. It picks a treatment automatically:

- headings (`h1`–`h4`, `.heading-*`, `.footer-logo`) → per-character 3D flip
- everything else → word-by-word opacity ramp

and picks scrub vs. entrance based on whether the element is already on screen at
setup — an element above the fold can never be scrubbed, because its trigger
window is already behind the scroll position, so it would sit frozen at the "from"
state (invisible headings). It returns a cleanup function; call it on unmount.

It no-ops under `prefers-reduced-motion`, so **anything that depends on it must
still be readable without it.**

**Framer Motion is for the mobile menu only.** Don't introduce it elsewhere —
GSAP already covers the site's motion vocabulary, and a second animation library
per feature is real bundle cost.

### `ShapeReveal`

[src/components/ShapeReveal.jsx](src/components/ShapeReveal.jsx) drives the three
pinned home-page scenes (Digital Marketing / Podcast / Photography). Each scene
scrubs an SVG clip-path silhouette open to reveal video underneath. Silhouettes
live in the `SHAPES` map — add one there rather than forking the component.

---

## Media pipeline

Gallery originals are straight off the camera: 40–60 megapixel stills and up to
42 MB clips, rendered into tiles a few hundred pixels wide. The site used to ship
those untouched. It doesn't now.

```
media-src/          ← camera originals, GITIGNORED (~465 MB)
   ├── services/<slug>/   gallery media, auto-discovered by folder name
   ├── images/            fixed site images
   ├── assets/
   └── clients/           client logos
        │
        │  npm run optimize:all
        ▼
public/media/, public/images/, public/assets/     ← committed & deployed
src/data/mediaManifest.json, clientsManifest.json ← committed & deployed
```

`npm run optimize:all` runs four scripts in `scripts/`. They're **idempotent** —
an output newer than its source is skipped — so re-running is cheap. Pass
`--force` to `optimize-media.mjs` to rebuild everything.

Per gallery asset it writes:

| | |
|---|---|
| images | `-thumb.webp` (800px long edge), `-full.webp` (2000px) |
| videos | `-tile.mp4` (720px tall, muted, no audio track), `-full.mp4` (1080px, faststart), `-poster.webp` |

`mediaManifest.json` is the single source of truth for what the site loads —
[src/data/services.js](src/data/services.js) reads it. **Both manifests are
generated; don't hand-edit them.**

### If you're contributing media

`media-src/` is gitignored — it's not in your clone, and cloning gets you the
already-optimised derivatives, which is enough to run and develop the site.

You only need it to *add or reprocess* media. It lives as an external backup;
ask a maintainer. If you add a new `media-src/services/<slug>/` folder, tell
whoever holds that backup, or your folder exists only on your machine and the
next person's `optimize:all` silently drops it from the manifest.

Video posters use ffmpeg's `thumbnail=100` filter, not frame 0 — several clips
fade in from black, and a naive first-frame grab produced solid-black posters.

---

## The loader

[src/components/Loader.jsx](src/components/Loader.jsx) plays a 73-frame WebP
sequence (`public/loader/desktop` and `/mobile`) as a canvas animation over first
paint. It buffers every frame before animating, and falls back to the
nearest-loaded frame rather than flashing blank.

It's coupled to one thing you need to know about:
[src/utils/siteReady.js](src/utils/siteReady.js). **Video sources are withheld
until the loader finishes.** Every `<video>` on the home page used to mount with
`autoPlay preload="auto"` behind the loader — 35 media requests at +1.6s for
~114 MB of footage, while the loader (needing 1.75 MB of frames) got 3 frames in
14 seconds. The camera never moved.

So: any new autoplaying video below the fold should gate its `src` on
`useSiteReady()`. Nothing under the loader is visible anyway.

This is also why **`npm run preview` is the honest way to check loader and scroll
behaviour** — the dev server's timing doesn't reproduce it.

---

## Chatbot & lead capture

[src/components/Chatbot.jsx](src/components/Chatbot.jsx) walks the visitor through
the flow in [src/data/chatbotFlow.js](src/data/chatbotFlow.js) and hands off a
lead via [src/utils/leads.js](src/utils/leads.js) on two independent paths,
because either can fail alone:

1. **WhatsApp deep link** — instant, but only "delivered" if the visitor actually
   hits send. Nothing on our side ever learns whether they did.
2. **`POST /api/lead.php`** — the durable record. Fires regardless, so a lead
   survives an abandoned WhatsApp handoff.

`submitLead()` never throws. It must stay usable when the endpoint doesn't exist
— which is the case on the Vite dev server, where there is no PHP at all. **Lead
submission cannot be end-to-end tested locally without a PHP host.**

[public/api/lead.php](public/api/lead.php) targets Hostinger shared hosting
(PHP/LiteSpeed). It logs to `leads.log`, emails the team, and rate-limits to one
submission per IP per 20s. `MAIL_TO` / `MAIL_FROM` are constants at the top —
`MAIL_FROM` must be on a domain the host handles, or mail gets rejected or
spam-filed.

If you touch that file: `header_safe()` strips CR/LF from anything reaching a mail
header. PHP's `mail()` builds headers by string concatenation, so a newline in
attacker-controlled input appends arbitrary headers and turns the endpoint into an
open relay. **Never interpolate raw request input into `$headers` or `$subject`.**

The assistant's answers are grounded in
[chatbot/vyewfinder_films_chatbot_knowledge_base.md](chatbot/vyewfinder_films_chatbot_knowledge_base.md).
Update that alongside the flow.

---

## Testing

```bash
npm test
```

[tests/smoke.mjs](tests/smoke.mjs) is the entire suite. It builds the site, boots
a preview server on :4310, and walks every route with Puppeteer, asserting: the
page loads, nothing throws in the console, no request fails outright, and
per-page structural landmarks are present. Currently ~120 checks across 9 pages.

**Extend it with your change.** That's the expectation, not a nice-to-have:

- new route/page → push an entry onto the `CHECKS` array
- new behaviour on an existing page → add assertions inside that page's `assert`

Keep assertions **structural** — element exists, count is right, state actually
changes on interaction, string present in both locales. Not pixel values, not
screenshots. They have to keep passing unattended.

Two traps that have bitten this suite before:

- **`textContent` vs `innerText`.** `animateTextReveal` splits headings into
  per-word/per-char spans, so `textContent` concatenates without spaces
  (`"workingwith us"`). Use `innerText` for text assertions on animated headings.
- **Asserting on theme-dependent styling.** "background is not white" fails in
  light mode on perfectly correct code. Assert structure instead.

---

## Deployment

Static host + PHP (currently Hostinger shared hosting). `npm run build` produces
`dist/`; `public/api/lead.php` ships alongside it as `public_html/api/lead.php`.

The SPA needs a rewrite rule sending all non-file requests to `index.html`, or
deep links 404 on refresh.

**If you package the build as a zip on Windows:** .NET's
`ZipFile.CreateFromDirectory` writes backslash-separated entry paths, which Linux
extraction reads as literal filenames rather than directories — `api\lead.php`
becomes a file named `api\lead.php` at the root, and the contact form silently
404s in production. Build entries by hand with forward slashes, and verify no
entry contains a backslash before uploading.

---

## Contributing

### Before you open a PR

- [ ] `npm run build` completes clean
- [ ] `npm test` passes, **and covers your change**
- [ ] Every new user-facing string is in **both** `en` and `es` translation files
- [ ] No hardcoded colours — tokens only, and any new token has a light **and**
      dark value
- [ ] Checked in both themes (toggle is in the nav)
- [ ] Checked at mobile width, not just desktop
- [ ] Checked with `prefers-reduced-motion: reduce` — the content is still
      readable and reachable
- [ ] New route is lazy-loaded
- [ ] New media went through `npm run optimize:all`; no raw originals committed
- [ ] Verified against `npm run preview`, not just `npm run dev`, if it touches
      the loader, scroll, or video

### House style

Match the file you're editing. Broadly:

- Function components and hooks. No class components.
- One `Component.jsx` + `Component.scss` pair per component, co-located in
  `src/components/`.
- Comments explain the **why** — a constraint, a workaround, a reason a value is
  what it is. Not what the line does. The existing comments are load-bearing
  documentation of decisions that were expensive to reach; read them before
  overriding one, and don't strip them.
- Reuse the library that's already here for a given job. Adding a second carousel
  or animation library for one feature needs justification in the PR.

---

## Gotchas

Things that have already cost someone time.

**Splide `type: 'loop'` clones slides with `cloneNode`, and React never sees the
clones** — no refs run on them, and re-renders don't reach them. Anything React
would normally set on a slide has to be enforced on the raw DOM instead.
`Stories.jsx` uses `loop` and pays that price explicitly: an effect walks every
video in the section, clones included, to set `muted` (a property, not a reflected
attribute — cloned videos came up unmuted and blared the moment a re-render swapped
one into view) and to attach `src` once the loader releases. **The Instagram
carousel must stay `type: 'slide'`** — its slides are oEmbed widgets that
`embed.js` replaces with iframes, which a clone would never receive.

**Instagram embeds must be re-processed on every mount.** `embed.js` is loaded
once globally and never removed — but this is an SPA, so components remount and
arrive as un-hydrated `<blockquote>`s. Call `window.instgrm.Embeds.process()` on
mount. Also: the resulting iframe carries a hard `min-width: 326px` that can't be
overridden, which is why the carousel gives up its side padding below 420px
rather than clipping the widget.

**GSAP entrance animations on frequently re-rendering lists strand elements at
`opacity: 0`.** A `gsap.from()` on an auto-rotating carousel's items leaves them
invisible after a re-render lands mid-tween. If a component's list re-renders on a
timer, animate the container, not the items.

**`.section-padding` is a shared utility.** Overriding its padding for one section
with a single-class selector is a coin flip against Vite's CSS import order. Use a
compound selector (`.clients-section.section-padding`) so specificity decides it
instead of source order.

**Killing a `vite preview` on Windows** needs `taskkill /pid <pid> /T /F` — the
spawned shell survives a plain kill and holds the port.

**`dist/`, `*.zip`, and `media-src/` are gitignored.** So are `docs/`,
`changes_log/`, `prompts/`, and `.claude/` — this README is intentionally the
complete picture, because a fresh clone gets nothing else.

---

## Brand

[brand.md](brand.md) is where the palette and design principles came from — soft
luxury, editorial, minimal, photography-led. Useful as background for *why* the
system looks the way it does.

Two caveats before you treat it as spec:

- It's a generic design-system document (titled "JCLLLabs — Web Design System",
  derived from an unrelated site), not a Vyewfinder brand book. It carries no
  Vyewfinder voice, positioning, or copy guidance.
- **Its hex values are not the site's.** `brand.md` lists Charcoal `#2E2E2E`,
  Soft Beige `#D9C7B8`, Soft Gold `#C9A86A`; the site ships `#1B1C1E`, `#D8C7A8`,
  `#D7A95B`. The `--brand-*` tokens in [src/index.scss](src/index.scss) are
  authoritative — the values there were tuned against the actual dark base and
  for WCAG AA contrast. Don't "correct" them back to brand.md.

For voice and positioning, the nearest thing to a source of truth is the chatbot
knowledge base in [chatbot/](chatbot/), which is written in the company's own
words.
