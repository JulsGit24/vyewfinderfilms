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
    settleMs: 9000, // loader animation runs on first paint
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
      const expectedOrder = ['Home', 'Services', 'Podcast', 'Gallery', 'About us', 'Contact']
      t.ok('nav order is Home, Services, Podcast, Gallery, About us, Contact',
        JSON.stringify(navOrder) === JSON.stringify(expectedOrder), JSON.stringify(navOrder))
      const wheel = await page.$$('.wheel-slide')
      t.ok('services wheel has 4 slides', wheel.length === 4, `got ${wheel.length}`)
      t.ok('chatbot launcher present', await page.$('.chatbot-launcher') !== null)

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
    }
  },
  {
    name: 'podcast',
    path: '/podcast',
    settleMs: 6000,
    assert: async (page, t) => {
      t.ok('hero title renders', await page.$('.podcast-hero-title') !== null)
      t.ok('FAQ items render', (await page.$$('.podcast-faq-item')).length > 0)
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
