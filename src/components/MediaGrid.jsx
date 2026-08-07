import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Expand, ArrowRight, Play } from 'lucide-react'
import Lightbox from './Lightbox'
import './MediaGrid.scss'

/* ==========================================================
   MediaGrid

   Same tiling as the "Follow us on Instagram" strip, but the tiles
   expand in place instead of leaving for an external site. When
   `moreHref` is set the row is closed on the right by a view-more
   tile that links through to the full gallery.
   ========================================================== */
export default function MediaGrid({ items, moreHref, moreLabel = 'View more', columns }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <ul
        className={`media-grid ${moreHref ? 'media-grid--with-more' : ''}`}
        style={columns ? { '--media-columns': columns } : undefined}
      >
        {items.map((item, i) => (
          <li className="media-tile" key={item.thumb}>
            <button
              type="button"
              className="media-tile-btn"
              onClick={() => setOpen(i)}
              aria-label={item.label}
            >
              {/* Videos show their poster still here — the grid never
                  mounts a decoder. alt is empty because the tile has no
                  visible title and the filename must not surface. */}
              <img
                src={item.type === 'video' ? item.poster : item.thumb}
                alt=""
                width={item.width}
                height={item.height}
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <span className="media-tile-hover" aria-hidden="true">
                {item.type === 'video' ? <Play size={22} /> : <Expand size={22} />}
              </span>
            </button>
          </li>
        ))}

        {moreHref && (
          <li className="media-tile media-tile--more">
            <Link to={moreHref} className="media-more">
              <span className="media-more-label">{moreLabel}</span>
              <span className="media-more-arrow" aria-hidden="true">
                <ArrowRight size={20} />
              </span>
              <span className="media-more-rule" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>

      <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  )
}
