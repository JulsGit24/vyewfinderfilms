import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitType from 'split-type'

gsap.registerPlugin(ScrollTrigger)

/* ==========================================================
   Scroll-driven type reveals

   Modelled on the scroll-type reference set (scroll-type.webflow.io,
   scrollType.js). Two treatments, picked automatically:

   - Headings get the per-character 3D flip: chars hinge down from
     transformOrigin 50% 0% with rotationX -90 and a little z travel.
   - Everything else gets the word-opacity ramp: words sit at 0.1
     opacity and light up left-to-right with a 0.05 stagger.

   Both are scrubbed, so the type resolves as you scroll rather than
   firing once — that continuous coupling to scroll position is the
   whole character of the reference.
   ========================================================== */

const HEADING_SELECTOR =
  'h1,h2,h3,h4,.heading-1,.heading-2,.heading-3,.footer-logo'

/* Anything already on screen when the split runs can never be scrubbed
   — its trigger window is behind the scroll position, so it would sit
   frozen at the "from" state (invisible headings above the fold).
   Those play as a timed entrance instead. */
const ENTRANCE_ZONE = 0.88

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const resolveNodes = (target) => {
  let nodes
  if (typeof target === 'string') {
    nodes = Array.from(document.querySelectorAll(target))
  } else if (target && target.length !== undefined) {
    nodes = Array.from(target)
  } else {
    nodes = [target]
  }
  return nodes.filter(Boolean)
}

const isOnScreenAtSetup = (node) =>
  node.getBoundingClientRect().top < window.innerHeight * ENTRANCE_ZONE

/**
 * Split text and reveal it on scroll.
 *
 * @param {string | HTMLElement | NodeList | Array} target selector or elements
 * @param {object} options
 * @param {'auto'|'scrub'|'entrance'} [options.mode] force a treatment
 * @param {number} [options.delay] entrance-mode delay only
 * @param {string} [options.start] ScrollTrigger start override
 * @param {string} [options.end] ScrollTrigger end override
 * @returns {function} cleanup that kills the tweens and reverts the splits
 */
export function animateTextReveal(target, options = {}) {
  const noop = () => {}

  // Splitting text nobody will see animate is just DOM churn.
  if (prefersReducedMotion()) return noop

  // SplitType throws on an empty match, and a selector can legitimately
  // resolve to nothing while a route is still mounting.
  const nodes = resolveNodes(target)
  if (!nodes.length) return noop

  /* `trigger` is deliberately dropped: a scrubbed reveal needs its own
     scroll window, so each element triggers on itself. Pointing every
     paragraph in a tall section at the section would leave the ones
     near the bottom fully resolved before they were ever visible. */
  const { mode = 'auto', delay = 0, trigger: _ignored, ...triggerOverrides } = options

  const splits = []
  const tweens = []

  nodes.forEach((node) => {
    const isHeading = node.matches(HEADING_SELECTOR)
    const entrance =
      mode === 'entrance' || (mode === 'auto' && isOnScreenAtSetup(node))

    const split = new SplitType(node, {
      types: isHeading ? 'lines, words, chars' : 'lines, words'
    })
    const pieces = isHeading ? split.chars : split.words

    if (!pieces || !pieces.length) {
      split.revert()
      return
    }
    splits.push(split)

    if (isHeading) {
      // The perspective has to live on the char's parent for rotationX
      // to read as depth rather than a flat vertical squash.
      gsap.set(split.words, { perspective: 1000 })

      const from = {
        'will-change': 'opacity, transform',
        transformOrigin: '50% 0%',
        opacity: 0,
        rotationX: -90,
        z: -160
      }
      const to = { opacity: 1, rotationX: 0, z: 0 }

      tweens.push(
        gsap.fromTo(
          split.chars,
          from,
          entrance
            ? { ...to, ease: 'power3.out', duration: 0.9, stagger: 0.028, delay }
            : {
                ...to,
                ease: 'power1',
                stagger: 0.045,
                scrollTrigger: {
                  trigger: node,
                  start: 'top 88%',
                  end: 'top 42%',
                  scrub: true,
                  ...triggerOverrides
                }
              }
        )
      )
      return
    }

    const from = { 'will-change': 'opacity', opacity: 0.1 }
    const to = { opacity: 1 }

    tweens.push(
      gsap.fromTo(
        split.words,
        from,
        entrance
          ? { ...to, ease: 'none', duration: 0.7, stagger: 0.03, delay: delay + 0.15 }
          : {
              ...to,
              ease: 'none',
              stagger: 0.05,
              scrollTrigger: {
                trigger: node,
                start: 'top 92%',
                end: 'top 52%',
                scrub: true,
                ...triggerOverrides
              }
            }
      )
    )
  })

  if (!tweens.length) return noop

  // Splitting rewrites the markup and can change element heights, which
  // invalidates any trigger position measured before this ran.
  ScrollTrigger.refresh()

  return () => {
    tweens.forEach((tween) => {
      tween.scrollTrigger?.kill()
      tween.kill()
    })
    splits.forEach((split) => split.revert())
  }
}
