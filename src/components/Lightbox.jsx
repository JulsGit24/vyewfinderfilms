import React, { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import './Lightbox.scss'

/* ==========================================================
   Lightbox

   Expands a grid tile to its natural size. "Natural size" is honoured
   literally — the media is not upscaled to fill the viewport; it is
   only scaled *down* when it would otherwise overflow.
   ========================================================== */
export default function Lightbox({ items, index, onClose, onIndex }) {
  const closeRef = useRef(null)
  const item = index === null || index < 0 ? null : items[index]
  const many = items.length > 1

  const go = useCallback(
    (step) => {
      if (!many) return
      onIndex((index + step + items.length) % items.length)
    },
    [index, items.length, many, onIndex]
  )

  useEffect(() => {
    if (!item) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }

    /* The page behind must not scroll under the overlay. Lenis drives
       scrolling from the body, so hiding overflow is enough. */
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [item, onClose, go])

  if (!item) return null

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || 'Expanded media'}
    >
      <button
        type="button"
        className="lightbox-backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />

      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <X size={26} />
      </button>

      {many && (
        <>
          <button type="button" className="lightbox-nav lightbox-nav--prev" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft size={28} />
          </button>
          <button type="button" className="lightbox-nav lightbox-nav--next" onClick={() => go(1)} aria-label="Next">
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <figure className="lightbox-stage">
        {item.type === 'video' ? (
          <video
            className="lightbox-media"
            src={item.src}
            poster={item.poster}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img className="lightbox-media" src={item.src} alt={item.alt || ''} />
        )}
        {item.alt && <figcaption className="lightbox-caption">{item.alt}</figcaption>}
      </figure>
    </div>,
    document.body
  )
}
