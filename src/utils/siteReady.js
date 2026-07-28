import { useEffect, useState } from 'react'

/* ==========================================================
   Site-ready gate

   Every <video> on the home page used to mount with autoPlay and
   preload="auto" behind the loader. Measured on a throttled link:
   35 media requests fired at +1.6s for ~114 MB of footage, and the
   loader — which needed 1.75 MB of frames to animate at all — got
   3 frames in 14 seconds. The camera never moved.

   Video sources are therefore withheld until the loader is gone.
   Nothing below the loader is visible before then, so there is no
   reason for it to compete for bandwidth.
   ========================================================== */

const EVENT = 'vf:site-ready'

let ready = false

export const isSiteReady = () => ready

export function markSiteReady() {
  if (ready) return
  ready = true
  window.dispatchEvent(new Event(EVENT))
}

export function useSiteReady() {
  const [value, setValue] = useState(ready)

  useEffect(() => {
    if (ready) {
      if (!value) setValue(true)
      return undefined
    }
    const onReady = () => setValue(true)
    window.addEventListener(EVENT, onReady)
    return () => window.removeEventListener(EVENT, onReady)
  }, [value])

  return value
}
