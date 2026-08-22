import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './locales/en/translation.json'
import esTranslation from './locales/es/translation.json'

const resources = {
  en: { translation: enTranslation },
  es: { translation: esTranslation }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

/* Keeps <html lang> in step with the active language. index.html ships
   lang="en" and nothing updated it, so toggling to Spanish left every
   screen reader and crawler reading Spanish copy as English. Same
   category of problem as ThemeContext's documentElement.dataset.theme
   sync — a root <html> attribute mirroring app state — and it lives
   here, as one app-wide subscription, rather than inside Seo, so it
   still holds on any route that does not mount <Seo>. */
const syncHtmlLang = (lng) => {
  if (typeof document === 'undefined' || !lng) return
  document.documentElement.lang = lng
}

syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
