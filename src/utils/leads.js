/* ==========================================================
   Lead delivery

   Two independent paths, because either can fail on its own:

   1. WhatsApp deep link — instant, but only "delivered" if the
      visitor actually hits send in WhatsApp. Nothing on our side
      ever learns whether they did.
   2. POST to /api/lead.php — the durable record. Fires on its own
      so a lead survives an abandoned WhatsApp handoff.

   The transcript sent to both follows the handoff template in §27
   of the knowledge base.
   ========================================================== */

export const BUSINESS_PHONE_E164 = '18049980564'
export const BUSINESS_PHONE_DISPLAY = '804-998-0564'
export const BUSINESS_EMAIL = 'info@vyewfinderfilms.com'

const LEAD_ENDPOINT = '/api/lead.php'

/* Order and labels mirror §27 so the owner sees the same shape
   whether a lead arrives by WhatsApp or by email. */
const SUMMARY_ROWS = [
  ['Name', 'full_name'],
  ['Business', 'business_name'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Preferred contact', 'preferred_contact_method'],
  ['Service requested', 'service_interest'],
  ['Project goal', 'project_goal'],
  ['Requested deliverables', 'deliverables_requested'],
  ['Location', 'production_location'],
  ['Preferred date', 'preferred_date'],
  ['Budget guidance', 'budget_guidance']
]

export const summarizeLead = (lead) =>
  SUMMARY_ROWS.filter(([, key]) => lead[key]).map(([label, key]) => ({
    label,
    value: lead[key]
  }))

export function buildHandoffText(lead, language = 'en') {
  const lines = ['NEW VYEWFINDER FILMS CHATBOT LEAD', '']
  lines.push(`Preferred language: ${language === 'es' ? 'Spanish' : 'English'}`)
  summarizeLead(lead).forEach(({ label, value }) => lines.push(`${label}: ${value}`))
  lines.push('', 'Sent from the website assistant.')
  return lines.join('\n')
}

export function buildWhatsappUrl(lead, language = 'en') {
  return `https://wa.me/${BUSINESS_PHONE_E164}?text=${encodeURIComponent(
    buildHandoffText(lead, language)
  )}`
}

export function buildMailtoUrl(lead, language = 'en') {
  const subject = `Website lead — ${lead.service_interest || 'New enquiry'}`
  return `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(buildHandoffText(lead, language))}`
}

/**
 * Posts the lead to the PHP endpoint. Resolves to true on success.
 * Never throws — the WhatsApp and mailto paths must stay usable when
 * the endpoint is missing (e.g. running the Vite dev server, where
 * there is no PHP at all).
 */
export async function submitLead(lead, language = 'en') {
  try {
    const response = await fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_source: 'Website Chatbot',
        language: language === 'es' ? 'Spanish' : 'English',
        submitted_at: new Date().toISOString(),
        ...lead
      })
    })
    if (!response.ok) return false
    const data = await response.json().catch(() => null)
    return Boolean(data && data.ok)
  } catch {
    return false
  }
}
