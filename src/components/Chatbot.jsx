import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, ChevronDown, RotateCcw, Mail } from 'lucide-react'
import { FLOW, ROOT_NODE, VALIDATORS } from '../data/chatbotFlow'
import { useTheme } from '../context/ThemeContext'
import {
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  buildMailtoUrl,
  buildWhatsappUrl,
  submitLead,
  summarizeLead
} from '../utils/leads'
import './Chatbot.scss'

/* ==========================================================
   Chatbot

   Walks the scripted graph in data/chatbotFlow.js. Deliberately has
   no model behind it — see the note at the top of that file for why.

   Layout reproduces the fin.ai messenger, measured on the live site:
   a bottom-centre "ask anything" pill that expands into a frosted
   glass panel (rgba tint + blur(50px), radius 24) with a detached
   solid composer pill beneath it. Bot messages sit directly on the
   glass; only the visitor's messages get a bubble.

   The component owns three things: the transcript, the collected
   lead, and which node is current. Everything the visitor reads is
   a translation lookup, so the bot is bilingual for free and cannot
   say anything that was not written down and approved.
   ========================================================== */

const LOGO_LIGHT = '/assets/logo_isotype_1.svg' // black wordmark — CSS crops it to the V mark
const LOGO_DARK = '/assets/logo_isotype_2.svg' // white isotype

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let messageSeq = 0
const nextId = () => {
  messageSeq += 1
  return `m${messageSeq}`
}

export default function Chatbot() {
  const { t, i18n } = useTranslation()
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [nodeId, setNodeId] = useState(ROOT_NODE)
  const [messages, setMessages] = useState([])
  const [lead, setLead] = useState({})
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | failed

  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const launcherRef = useRef(null)
  const wasOpenRef = useRef(false)

  const node = FLOW[nodeId]
  const lang = i18n.language === 'es' ? 'es' : 'en'
  const isInputNode = node?.type === 'input'

  const nodeText = useCallback((id, suffix) => t(`chatbot.nodes.${id}.${suffix}`), [t])

  /* ---------- transcript ----------
     Messages store a translation KEY, not resolved text, and are
     resolved at render. Storing the string instead froze each bubble
     in whatever language was active when it was pushed — flip the
     language mid-chat and the buttons switched while the question
     above them stayed behind. Only what the visitor typed is stored
     literally, since there is nothing to translate. */
  const pushBotKey = useCallback((key) => {
    setMessages((prev) => [...prev, { id: nextId(), from: 'bot', key }])
  }, [])

  const pushUserKey = useCallback((key) => {
    setMessages((prev) => [...prev, { id: nextId(), from: 'user', key }])
  }, [])

  const pushUserText = useCallback((text) => {
    setMessages((prev) => [...prev, { id: nextId(), from: 'user', text }])
  }, [])

  /* Seed the opening message the first time the panel opens. Doing it
     on open rather than on mount means the transcript survives close
     and re-open without duplicating the greeting. */
  useEffect(() => {
    if (open && messages.length === 0) {
      pushBotKey(`chatbot.nodes.${ROOT_NODE}.message`)
    }
  }, [open, messages.length, pushBotKey])

  /* Announce each new node's message as the visitor advances. */
  const goTo = useCallback(
    (id) => {
      setNodeId(id)
      setError('')
      setDraft('')
      pushBotKey(`chatbot.nodes.${id}.message`)
    },
    [pushBotKey]
  )

  const handleOption = (option) => {
    pushUserKey(`chatbot.nodes.${nodeId}.options.${option.key}`)
    if (option.set) setLead((prev) => ({ ...prev, ...option.set }))
    goTo(option.next)
  }

  const commitInput = (value) => {
    const trimmed = value.trim()
    const validate = VALIDATORS[node.validate] || VALIDATORS.text
    const failure = validate(trimmed)
    if (failure) {
      setError(t(`chatbot.${failure}`))
      return
    }
    pushUserText(trimmed)
    setLead((prev) => ({ ...prev, [node.field]: trimmed, ...(node.set || {}) }))
    goTo(node.next)
  }

  const handleSkip = () => {
    pushUserKey('chatbot.skip')
    setLead((prev) => ({ ...prev, ...(node.set || {}) }))
    goTo(node.next)
  }

  const restart = () => {
    setMessages([])
    setLead({})
    setNodeId(ROOT_NODE)
    setDraft('')
    setError('')
    setStatus('idle')
  }

  const close = () => setOpen(false)

  /* ---------- send ---------- */
  /* Fires the durable record independently of the WhatsApp handoff, so
     an abandoned deep link is not a lost lead. */
  const handleSend = async () => {
    setStatus('sending')
    const ok = await submitLead(lead, lang)
    setStatus(ok ? 'sent' : 'failed')
    goTo('done')
  }

  /* ---------- effects ---------- */
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [messages, error, status])

  useEffect(() => {
    if (open && isInputNode) inputRef.current?.focus()
  }, [open, nodeId, isInputNode])

  /* The launcher unmounts while the panel is open, so focus is
     restored on the re-mounted pill after close — keyboard users are
     not dumped at the top of the document. */
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
    } else if (wasOpenRef.current) {
      launcherRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const summary = useMemo(() => summarizeLead(lead), [lead])

  /* Chips, summary card and handoff CTAs all live inside the panel,
     under the transcript — the composer pill below only ever types. */
  const renderInline = () => {
    if (!node) return null

    if (node.type === 'done') {
      return (
        <div className="chatbot-actions">
          <a
            className="chatbot-cta chatbot-cta--whatsapp"
            href={buildWhatsappUrl(lead, lang)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('chatbot.sendWhatsapp')}
          </a>
          <a className="chatbot-cta" href={buildMailtoUrl(lead, lang)}>
            <Mail size={15} />
            <span>{t('chatbot.sendEmail')}</span>
          </a>
        </div>
      )
    }

    if (node.type === 'input') {
      if (!node.skippable) return null
      return (
        <div className="chatbot-options">
          <button type="button" className="chatbot-option" onClick={handleSkip}>
            {t('chatbot.skip')}
          </button>
        </div>
      )
    }

    const options = node.options || []
    return (
      <>
        {node.type === 'review' && (
          <dl className="chatbot-summary">
            <p className="chatbot-summary-title">{t('chatbot.summaryTitle')}</p>
            {summary.map(({ label, value }) => (
              <div className="chatbot-summary-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="chatbot-options">
          {options.map((option) => (
            <button
              type="button"
              key={option.key}
              className="chatbot-option"
              disabled={status === 'sending'}
              onClick={() => {
                if (node.type === 'review' && option.key === 'send') {
                  pushUserKey(`chatbot.nodes.${nodeId}.options.${option.key}`)
                  handleSend()
                  return
                }
                if (option.key === 'restart') {
                  restart()
                  return
                }
                handleOption(option)
              }}
            >
              {option.key === 'send' && status === 'sending'
                ? t('chatbot.sending')
                : nodeText(nodeId, `options.${option.key}`)}
            </button>
          ))}
        </div>
      </>
    )
  }

  if (!open) {
    return (
      <button
        ref={launcherRef}
        type="button"
        className="chatbot-launcher"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="chatbot-panel"
        aria-label={t('chatbot.launcher')}
      >
        <span className="chatbot-launcher-text">{t('chatbot.launcher')}</span>
        <span className="chatbot-launcher-arrow" aria-hidden="true">
          <ArrowUp size={15} />
        </span>
      </button>
    )
  }

  return (
    <div className="chatbot-root">
      <section id="chatbot-panel" className="chatbot-panel" aria-label={t('chatbot.title')}>
        <header className="chatbot-head">
          <div className="chatbot-identity">
            <img
              className="chatbot-logo"
              src={theme === 'light' ? LOGO_LIGHT : LOGO_DARK}
              alt=""
              aria-hidden="true"
            />
            <div>
              <p className="chatbot-title">{t('chatbot.title')}</p>
              {/* §24 forbids claiming to be human — the subtitle says so plainly. */}
              <p className="chatbot-subtitle">{t('chatbot.subtitle')}</p>
            </div>
          </div>
          <div className="chatbot-head-actions">
            <button type="button" onClick={restart} aria-label={t('chatbot.restart')} title={t('chatbot.restart')}>
              <RotateCcw size={15} />
            </button>
            <button type="button" onClick={close} aria-label={t('chatbot.close')}>
              <ChevronDown size={18} />
            </button>
          </div>
        </header>

        <div className="chatbot-scroll" ref={scrollRef} aria-live="polite">
          {messages.map((m) => (
            <p key={m.id} className={`chatbot-bubble chatbot-bubble--${m.from}`}>
              {m.key ? t(m.key) : m.text}
            </p>
          ))}
          {status === 'sent' && <p className="chatbot-note chatbot-note--ok">{t('chatbot.sentOk')}</p>}
          {status === 'failed' && <p className="chatbot-note">{t('chatbot.sentFail')}</p>}
          {error && <p className="chatbot-note chatbot-note--error" role="alert">{error}</p>}
          {renderInline()}
        </div>
      </section>

      <form
        className="chatbot-composer"
        /* noValidate hands validation to VALIDATORS. Without it the
           browser's own type="email" check blocks submit before the
           handler runs, so the in-chat error never appears and the
           visitor gets an untranslated native tooltip instead. */
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (isInputNode) commitInput(draft)
        }}
      >
        {node?.kind === 'textarea' && isInputNode ? (
          <textarea
            ref={inputRef}
            rows="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('chatbot.inputPlaceholder')}
            aria-label={nodeText(nodeId, 'message')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitInput(draft)
              }
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type={node?.kind === 'email' ? 'email' : node?.kind === 'tel' ? 'tel' : 'text'}
            value={draft}
            disabled={!isInputNode}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isInputNode ? t('chatbot.inputPlaceholder') : t('chatbot.pickOption')}
            aria-label={isInputNode ? nodeText(nodeId, 'message') : t('chatbot.pickOption')}
          />
        )}
        <button
          type="submit"
          className="chatbot-send"
          disabled={!isInputNode}
          aria-label={t('chatbot.send')}
        >
          <ArrowUp size={16} />
        </button>
      </form>

      <div className="chatbot-foot">
        {/* §25.1 customer-facing privacy notice. */}
        <p className="chatbot-privacy">{t('chatbot.privacy')}</p>
        <p className="chatbot-direct">
          <a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
          <span aria-hidden="true"> · </span>
          <a href={`tel:+${BUSINESS_PHONE_DISPLAY.replace(/\D/g, '')}`}>{BUSINESS_PHONE_DISPLAY}</a>
        </p>
      </div>
    </div>
  )
}
