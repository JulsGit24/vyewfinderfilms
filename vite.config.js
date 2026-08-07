import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    /* Declared empty on purpose. Without it Vite auto-discovers the
       postcss.config.mjs left over from the Next.js scaffold this repo
       was created from, which loads @tailwindcss/postcss — a package
       that is not installed and that this app does not use (styling is
       SCSS throughout). That lookup fails the build on src/index.scss. */
    postcss: {}
  },
  build: {
    /* Split the heavy, rarely-changing libraries out of the app chunk.
       They were bundled together with application code, so the browser
       could not start parsing anything until the whole 630 kB arrived,
       and any source edit invalidated the lot in a returning visitor's
       cache. */
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-gsap': ['gsap', 'gsap/ScrollTrigger'],
          'vendor-motion': ['framer-motion'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-slider': ['@splidejs/react-splide', '@splidejs/splide']
        }
      }
    }
  },
  server: {
    // Redirect all non-file requests to index.html for SPA routing
    historyApiFallback: true
  }
});
