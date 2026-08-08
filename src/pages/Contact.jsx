import React, { useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Mail, Phone, MapPin, Plus, Check } from 'lucide-react'
import { gsap } from 'gsap'
import { animateTextReveal } from '../utils/animations'
import {
  submitLead,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_E164,
  BUSINESS_PHONE_DISPLAY
} from '../utils/leads'
import './Contact.scss'

const FAQ_KEYS = ['timeline', 'pricing', 'process', 'travel', 'rights', 'podcast']

const PURPOSES = ['project', 'partnership', 'careers', 'other']

/* Deliberately permissive: the point is to catch typos, not to police
   what a valid address looks like. A single @ with something either
   side and a dotted domain rejects the mistakes people actually make. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/* Digits only after stripping the punctuation people type into phone
   fields — spaces, dashes, dots, brackets and a leading +. */
const PHONE_CLEAN_RE = /[\s\-().]/g
const PHONE_RE = /^\+?\d{7,15}$/

const validators = {
  name: (v) => (v.trim().length >= 2 ? '' : 'nameError'),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'emailError'),
  phone: (v) => (PHONE_RE.test(v.replace(PHONE_CLEAN_RE, '')) ? '' : 'phoneError'),
  company: () => '',
  purpose: (v) => (PURPOSES.includes(v) ? '' : 'purposeError'),
  message: (v) => (v.trim().length >= 10 ? '' : 'messageError')
}

const EMPTY = { name: '', company: '', email: '', phone: '', purpose: '', message: '' }

export default function Contact() {
  const { t, i18n } = useTranslation()
  const pageRef = useRef(null)

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  /* 'idle' | 'sending' | 'error'. Separate from `submitted`, which now
     only flips once the POST has actually confirmed. */
  const [status, setStatus] = useState('idle')
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    let revertText
    const ctx = gsap.context(() => {
      /* FAQ questions are deliberately excluded. They are compact list
         items, so a scrubbed word ramp catches them mid-reveal and
         they read as half-greyed-out text rather than as animation. */
      revertText = animateTextReveal(
        '.contact-hero .eyebrow, .contact-hero h1, .contact-hero .contact-lede, .contact-faq h2'
      )
    }, pageRef)
    return () => {
      if (revertText) revertText()
      ctx.revert()
    }
  }, [])

  const validateAll = () =>
    Object.keys(validators).reduce((acc, field) => {
      const error = validators[field](values[field])
      if (error) acc[field] = error
      return acc
    }, {})

  const handleChange = (field) => (e) => {
    const next = e.target.value
    setValues((prev) => ({ ...prev, [field]: next }))
    // Only re-validate live once the field has been left dirty, so
    // nobody is told their email is wrong while typing the first letter.
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validators[field](next) || undefined }))
    }
  }

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors((prev) => ({ ...prev, [field]: validators[field](values[field]) || undefined }))
  }

  /* This used to flip straight to the success panel after client-side
     validation, without sending anything anywhere — the visitor was
     told their message had been delivered when nothing had left the
     browser. It now POSTs to the same /api/lead.php endpoint the
     chatbot uses (see submitLead), and the success panel waits for
     {ok:true}. On failure the filled form stays mounted. */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status === 'sending') return

    const found = validateAll()
    setErrors(found)
    setTouched(Object.keys(validators).reduce((a, k) => ({ ...a, [k]: true }), {}))

    if (Object.keys(found).length > 0) {
      const first = document.querySelector(`[name="${Object.keys(found)[0]}"]`)
      first?.focus()
      return
    }

    setStatus('sending')

    /* Contact-form-specific keys, so the emailed record reads as a
       contact-form submission instead of being force-fit into the
       chatbot's field labels. `email` and `phone` keep the shared
       names — lead.php's "is this lead actionable" check keys on them.
       The purpose is sent in English so the team always reads the same
       value whichever language the visitor used. */
    const ok = await submitLead(
      {
        lead_source: 'Website Contact Form',
        contact_name: values.name.trim(),
        contact_company: values.company.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        contact_purpose: t(`contact.form.purposes.${values.purpose}`, { lng: 'en' }),
        contact_message: values.message.trim()
      },
      i18n.language
    )

    if (ok) {
      setStatus('idle')
      setSubmitted(true)
    } else {
      setStatus('error')
    }
  }

  const fieldProps = (field) => ({
    name: field,
    value: values[field],
    onChange: handleChange(field),
    onBlur: handleBlur(field),
    'aria-invalid': errors[field] ? 'true' : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
    className: errors[field] ? 'has-error' : undefined
  })

  const errorFor = (field) =>
    errors[field] ? (
      <p className="field-error" id={`${field}-error`} role="alert">
        {t(`contact.form.${errors[field]}`)}
      </p>
    ) : null

  return (
    <div className="contact-page" ref={pageRef}>
      <section className="contact-hero">
        <div className="container">
          <p className="eyebrow">{t('contact.eyebrow')}</p>
          <h1 className="heading-1">{t('contact.title')}</h1>
          <p className="contact-lede">{t('contact.lede')}</p>

          <ul className="contact-details">
            <li>
              <Mail size={16} />
              <a href="mailto:info@vyewfinderfilms.com">info@vyewfinderfilms.com</a>
            </li>
            <li>
              <Phone size={16} />
              <a href={`tel:${BUSINESS_PHONE_E164}`}>{BUSINESS_PHONE_DISPLAY}</a>
            </li>
            <li>
              <MapPin size={16} />
              <span>{t('contact.location')}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="container">
          {submitted ? (
            <div className="contact-success" role="status">
              <span className="contact-success-mark"><Check size={26} /></span>
              <h2 className="heading-3">{t('contact.successTitle')}</h2>
              <p>{t('contact.successBody')}</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="c-name">{t('contact.form.name')} <span aria-hidden="true">*</span></label>
                  <input id="c-name" type="text" autoComplete="name" placeholder={t('contact.form.namePh')} {...fieldProps('name')} />
                  {errorFor('name')}
                </div>
                <div className="field">
                  <label htmlFor="c-company">{t('contact.form.company')}</label>
                  <input id="c-company" type="text" autoComplete="organization" placeholder={t('contact.form.companyPh')} {...fieldProps('company')} />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="c-email">{t('contact.form.email')} <span aria-hidden="true">*</span></label>
                  <input id="c-email" type="email" autoComplete="email" placeholder={t('contact.form.emailPh')} {...fieldProps('email')} />
                  {errorFor('email')}
                </div>
                <div className="field">
                  <label htmlFor="c-phone">{t('contact.form.phone')} <span aria-hidden="true">*</span></label>
                  <input id="c-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder={t('contact.form.phonePh')} {...fieldProps('phone')} />
                  {errorFor('phone')}
                </div>
              </div>

              <div className="field">
                <label htmlFor="c-purpose">{t('contact.form.purpose')} <span aria-hidden="true">*</span></label>
                <select id="c-purpose" {...fieldProps('purpose')}>
                  <option value="">{t('contact.form.purposePh')}</option>
                  {PURPOSES.map((p) => (
                    <option key={p} value={p}>{t(`contact.form.purposes.${p}`)}</option>
                  ))}
                </select>
                {errorFor('purpose')}
              </div>

              <div className="field">
                <label htmlFor="c-message">{t('contact.form.message')} <span aria-hidden="true">*</span></label>
                <textarea id="c-message" rows="5" placeholder={t('contact.form.messagePh')} {...fieldProps('message')} />
                {errorFor('message')}
              </div>

              {status === 'error' && (
                <p className="form-status form-status--error" role="alert">
                  <Trans
                    i18nKey="contact.form.sendError"
                    components={{
                      mail: <a href={`mailto:${BUSINESS_EMAIL}`} />,
                      tel: <a href={`tel:${BUSINESS_PHONE_E164}`} />
                    }}
                  />
                </p>
              )}

              <div className="form-foot">
                <p className="form-note">{t('contact.form.required')}</p>
                <button type="submit" className="btn-primary" disabled={status === 'sending'}>
                  {status === 'sending' ? t('contact.form.sending') : t('contact.form.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="contact-faq">
        <div className="container">
          <h2 className="heading-2">{t('contact.faqTitle')}</h2>

          <ul className="faq-list">
            {FAQ_KEYS.map((key, i) => {
              const isOpen = openFaq === i
              return (
                <li className={`faq-item ${isOpen ? 'is-open' : ''}`} key={key}>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${key}`}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span className="faq-question-text">{t(`contact.faq.${key}.q`)}</span>
                    <span className="faq-icon" aria-hidden="true"><Plus size={18} /></span>
                  </button>
                  <div className="faq-panel" id={`faq-panel-${key}`} role="region" hidden={!isOpen}>
                    <p>{t(`contact.faq.${key}.a`)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
