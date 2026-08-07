/* ==========================================================
   Chatbot flow graph

   A deterministic decision tree built from
   chatbot/vyewfinder_films_chatbot_knowledge_base.md.

   WHY SCRIPTED, NOT GENERATIVE: the knowledge base lists 26
   prohibited claims (§24) — no invented price, package, discount,
   turnaround, availability, or capability — and most operational
   details are still marked TO CONFIRM (§29). A fixed graph cannot
   invent any of them. Every string the visitor sees is authored
   copy in the translation files, so the guardrails hold by
   construction rather than by instruction.

   Structure only lives here; all copy lives under the `chatbot`
   key in src/locales/{en,es}/translation.json.

   Node shapes
     choice  — a message plus quick-reply buttons (max 6, per §12)
     input   — a message plus one field, appended to the lead record
     consent — asks permission before contact details (§14.3)
     review  — renders the collected lead for confirmation (§15.8)
     done    — terminal; offers WhatsApp / email handoff
   ========================================================== */

/* Mirrors the lead record schema in §26. Fields are filled in as the
   visitor moves through a flow; whatever is present at handoff time
   is what gets sent. */
export const LEAD_FIELDS = [
  'service_interest',
  'project_goal',
  'deliverables_requested',
  'production_location',
  'preferred_date',
  'budget_guidance',
  'full_name',
  'business_name',
  'email',
  'phone',
  'preferred_contact_method'
]

/* Deliberately permissive — the job is catching typos, not policing
   what a valid address looks like. Same rules as the contact form. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PHONE_CLEAN_RE = /[\s\-().]/g
const PHONE_RE = /^\+?\d{7,15}$/

export const VALIDATORS = {
  name: (v) => (v.trim().length >= 2 ? '' : 'errName'),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'errEmail'),
  phone: (v) => (PHONE_RE.test(v.replace(PHONE_CLEAN_RE, '')) ? '' : 'errPhone'),
  text: (v) => (v.trim().length >= 2 ? '' : 'errShort'),
  optional: () => ''
}

/* Node ids are also translation keys: `chatbot.nodes.<id>.message`
   and `chatbot.nodes.<id>.options.<key>`. */
export const FLOW = {
  /* ---------- entry ---------- */
  welcome: {
    type: 'choice',
    options: [
      { key: 'video', next: 'svc_video' },
      { key: 'social', next: 'svc_social' },
      { key: 'photo', next: 'menu_photo' },
      { key: 'quote', next: 'quote_service' },
      { key: 'consult', next: 'consult_intro' },
      { key: 'faq', next: 'menu_faq' }
    ]
  },

  /* ---------- service explainers (§7) ---------- */
  svc_video: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Corporate / commercial video' } },
      { key: 'consult', next: 'consult_intro', set: { service_interest: 'Corporate / commercial video' } },
      { key: 'back', next: 'welcome' }
    ]
  },
  svc_social: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Social media content' } },
      { key: 'consult', next: 'consult_intro', set: { service_interest: 'Social media content' } },
      { key: 'back', next: 'welcome' }
    ]
  },
  menu_photo: {
    type: 'choice',
    options: [
      { key: 'food', next: 'svc_food' },
      { key: 'realestate', next: 'svc_realestate' },
      { key: 'headshots', next: 'svc_headshots' },
      { key: 'other', next: 'svc_photo_other' },
      { key: 'back', next: 'welcome' }
    ]
  },
  svc_food: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Food photography' } },
      { key: 'back', next: 'menu_photo' }
    ]
  },
  svc_realestate: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Real-estate photography' } },
      { key: 'back', next: 'menu_photo' }
    ]
  },
  svc_headshots: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Headshot photography' } },
      { key: 'back', next: 'menu_photo' }
    ]
  },
  /* §7.9 — anything not clearly on the list goes to review, never a promise. */
  svc_photo_other: {
    type: 'choice',
    options: [
      { key: 'quote', next: 'quote_goal', set: { service_interest: 'Photography — other (needs team review)' } },
      { key: 'back', next: 'menu_photo' }
    ]
  },

  /* ---------- quote flow (§15) ---------- */
  quote_service: {
    type: 'choice',
    options: [
      { key: 'video', next: 'quote_goal', set: { service_interest: 'Corporate / commercial video' } },
      { key: 'social', next: 'quote_goal', set: { service_interest: 'Social media content' } },
      { key: 'food', next: 'quote_goal', set: { service_interest: 'Food photography' } },
      { key: 'realestate', next: 'quote_goal', set: { service_interest: 'Real-estate photography' } },
      { key: 'headshots', next: 'quote_goal', set: { service_interest: 'Headshot photography' } },
      { key: 'other', next: 'quote_goal', set: { service_interest: 'Other / custom (needs team review)' } }
    ]
  },
  quote_goal: {
    type: 'choice',
    options: [
      { key: 'promote', next: 'quote_scope', set: { project_goal: 'Promote a service' } },
      { key: 'introduce', next: 'quote_scope', set: { project_goal: 'Introduce the business' } },
      { key: 'inquiries', next: 'quote_scope', set: { project_goal: 'Generate inquiries' } },
      { key: 'awareness', next: 'quote_scope', set: { project_goal: 'Build brand awareness' } },
      { key: 'property', next: 'quote_scope', set: { project_goal: 'Showcase a property' } },
      { key: 'other', next: 'quote_scope', set: { project_goal: 'Other' } }
    ]
  },
  quote_scope: {
    type: 'input',
    field: 'deliverables_requested',
    kind: 'textarea',
    validate: 'text',
    next: 'quote_location'
  },
  quote_location: {
    type: 'input',
    field: 'production_location',
    kind: 'text',
    validate: 'text',
    next: 'quote_date'
  },
  quote_date: {
    type: 'input',
    field: 'preferred_date',
    kind: 'text',
    validate: 'text',
    next: 'quote_budget'
  },
  /* §15.6 — budget is explicitly optional and never gates acceptance. */
  quote_budget: {
    type: 'input',
    field: 'budget_guidance',
    kind: 'text',
    validate: 'optional',
    skippable: true,
    next: 'consent'
  },

  /* ---------- consultation flow (§16) ---------- */
  consult_intro: {
    type: 'input',
    field: 'project_goal',
    kind: 'textarea',
    validate: 'text',
    next: 'consult_when'
  },
  consult_when: {
    type: 'input',
    field: 'preferred_date',
    kind: 'text',
    validate: 'text',
    next: 'consent',
    set: { deliverables_requested: 'Consultation request' }
  },

  /* ---------- FAQ (§18) — answers only, never a lead gate (§6) ---------- */
  menu_faq: {
    type: 'choice',
    options: [
      { key: 'pricing', next: 'faq_pricing' },
      { key: 'areas', next: 'faq_areas' },
      { key: 'timeline', next: 'faq_timeline' },
      { key: 'spanish', next: 'faq_spanish' },
      { key: 'work', next: 'faq_work' },
      { key: 'back', next: 'welcome' }
    ]
  },
  faq_pricing: { type: 'choice', options: [{ key: 'quote', next: 'quote_service' }, { key: 'back', next: 'menu_faq' }] },
  faq_areas: { type: 'choice', options: [{ key: 'quote', next: 'quote_service' }, { key: 'back', next: 'menu_faq' }] },
  faq_timeline: { type: 'choice', options: [{ key: 'consult', next: 'consult_intro' }, { key: 'back', next: 'menu_faq' }] },
  faq_spanish: { type: 'choice', options: [{ key: 'back', next: 'menu_faq' }] },
  faq_work: { type: 'choice', options: [{ key: 'quote', next: 'quote_service' }, { key: 'back', next: 'menu_faq' }] },

  /* ---------- contact capture (§14) ---------- */
  consent: {
    type: 'consent',
    options: [
      { key: 'yes', next: 'lead_name' },
      { key: 'no', next: 'declined' }
    ]
  },
  lead_name: { type: 'input', field: 'full_name', kind: 'text', validate: 'name', next: 'lead_business' },
  lead_business: {
    type: 'input',
    field: 'business_name',
    kind: 'text',
    validate: 'optional',
    skippable: true,
    next: 'lead_email'
  },
  lead_email: { type: 'input', field: 'email', kind: 'email', validate: 'email', next: 'lead_phone' },
  lead_phone: { type: 'input', field: 'phone', kind: 'tel', validate: 'phone', next: 'lead_contact_pref' },
  lead_contact_pref: {
    type: 'choice',
    options: [
      { key: 'email', next: 'review', set: { preferred_contact_method: 'Email' } },
      { key: 'phone', next: 'review', set: { preferred_contact_method: 'Phone' } },
      { key: 'whatsapp', next: 'review', set: { preferred_contact_method: 'WhatsApp' } }
    ]
  },

  /* §15.8 — read the request back before anything is sent. */
  review: {
    type: 'review',
    options: [
      { key: 'send', next: 'done' },
      { key: 'restart', next: 'welcome' }
    ]
  },

  done: { type: 'done' },
  declined: { type: 'choice', options: [{ key: 'back', next: 'welcome' }] }
}

export const ROOT_NODE = 'welcome'
