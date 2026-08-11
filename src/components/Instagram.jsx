import { gsap } from 'gsap'
import { Instagram as InstagramIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import mediaManifest from '../data/mediaManifest.json'
import { animateTextReveal } from '../utils/animations'
import './Instagram.scss'

/* Real client photography from the services media pool (the same
   manifest that backs /services/digital-marketing,
   /services/corporate-video and /services/photography), rather than
   generic stock stills. `thumb` is the grid-sized derivative — `full`
   is 40-60 megapixel camera originals, sized for the lightbox, not a
   few-hundred-pixel tile. Two images per service keeps the row from
   reading as one service's gallery. */
const pickTwo = (slug) =>
  mediaManifest[slug]
    .filter((item) => item.type === 'image')
    .slice(0, 2)
    .map((item) => ({ src: item.thumb, width: item.width, height: item.height }))

const images = [
  ...pickTwo('photography'),
  ...pickTwo('digital-marketing'),
  ...pickTwo('corporate-video')
]

export default function Instagram() {
  const { t } = useTranslation()
  const sectionRef = useRef(null)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      revertText = animateTextReveal('.instagram-section .heading-2')
    }, sectionRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  return (
    <section className="instagram-section" ref={sectionRef}>
      <div className="container text-center">
        <h2 className="heading-2">{t('instagram.title')}</h2>
      </div>
      <div className="instagram-grid">
        {images.map((image, index) => (
          <a
            key={index}
            className="instagram-item"
            href="https://www.instagram.com/vyewfinderfilms/"
            target="_blank"
            rel="noreferrer noopener"
          >
            <img
              src={image.src}
              alt="Instagram post"
              width={image.width}
              height={image.height}
              loading="lazy"
            />
            <div className="instagram-hover">
              <InstagramIcon size={22} />
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
