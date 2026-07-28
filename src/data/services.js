/* ==========================================================
   Service catalogue

   Single source of truth for the service sections on /services,
   their preview rows, and the per-service gallery routes at
   /services/:slug.

   NOTE ON MEDIA: these reference the stock already in the repo, so
   several services share frames. Swap the `media` arrays for the real
   per-service shoots when they land — nothing else needs to change.
   ========================================================== */

export const services = [
  {
    slug: 'digital-marketing',
    anchor: 'digital-marketing',
    titleKey: 'nav.digitalMarketing',
    descKey: 'services.items.social.desc',
    media: [
      { type: 'image', src: '/images/digital-marketing-side.jpg', alt: 'Campaign planning on set' },
      { type: 'image', src: '/images/portfolio-social.png', alt: 'Social campaign still' },
      { type: 'image', src: '/images/portfolio-social-1.jpg', alt: 'Paid campaign creative' },
      { type: 'image', src: '/images/portfolio-corporate.png', alt: 'Brand channel artwork' },
      { type: 'image', src: '/images/hero-bg.jpg', alt: 'Production crew at work' },
      { type: 'image', src: '/images/portfolio-social-2.jpg', alt: 'Short-form content still' },
      { type: 'video', src: '/assets/video1.mp4', poster: '/images/portfolio-corporate.jpg', alt: 'Campaign film' }
    ]
  },
  {
    slug: 'corporate-video',
    anchor: 'corporate-video',
    titleKey: 'nav.corporateVideo',
    descKey: 'services.items.corporate.desc',
    media: [
      { type: 'image', src: '/images/portfolio-corporate.jpg', alt: 'Corporate interview setup' },
      { type: 'image', src: '/images/portfolio-corporate.png', alt: 'Boardroom coverage' },
      { type: 'image', src: '/images/hero-bg.jpg', alt: 'Camera on location' },
      { type: 'image', src: '/images/digital-marketing-side.jpg', alt: 'Studio lighting' },
      { type: 'image', src: '/images/portfolio-photography.png', alt: 'Executive portrait' },
      { type: 'image', src: '/images/portfolio-social-2.jpg', alt: 'Company culture still' },
      { type: 'video', src: '/assets/video2.mp4', poster: '/images/portfolio-social-1.jpg', alt: 'Corporate film' }
    ]
  },
  {
    slug: 'photography',
    anchor: 'photography',
    titleKey: 'nav.photography',
    descKey: 'services.items.photography.desc',
    media: [
      { type: 'image', src: '/images/portfolio-photography.png', alt: 'Editorial portrait' },
      { type: 'image', src: '/images/testimonial-avatar.jpg', alt: 'Studio portrait' },
      { type: 'image', src: '/images/hero-bg.jpg', alt: 'Location photography' },
      { type: 'image', src: '/images/portfolio-corporate.jpg', alt: 'Product detail' },
      { type: 'image', src: '/images/portfolio-social-1.jpg', alt: 'Lifestyle frame' },
      { type: 'image', src: '/images/portfolio-social.png', alt: 'Campaign photography' }
    ]
  },
  {
    slug: 'social-media',
    anchor: 'social-media',
    titleKey: 'nav.socialMedia',
    descKey: 'services.items.social.desc',
    media: [
      { type: 'image', src: '/images/portfolio-social.png', alt: 'Vertical social still' },
      { type: 'image', src: '/images/portfolio-social-1.jpg', alt: 'Reel frame' },
      { type: 'image', src: '/images/portfolio-social-2.jpg', alt: 'Story frame' },
      { type: 'image', src: '/images/portfolio-corporate.jpg', alt: 'Brand content still' },
      { type: 'image', src: '/images/digital-marketing-side.jpg', alt: 'Behind the scenes' },
      { type: 'image', src: '/images/hero-bg.jpg', alt: 'Shoot day' },
      { type: 'video', src: '/assets/video3.mp4', poster: '/images/portfolio-social-2.jpg', alt: 'Social film' }
    ]
  }
]

export const getService = (slug) => services.find((s) => s.slug === slug)

/* The preview row is exactly one grid row: five tiles plus the
   view-more tile that closes it on the right. */
export const PREVIEW_COUNT = 5
