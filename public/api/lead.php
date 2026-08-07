<?php
/* ==========================================================
   Vyewfinder Films — chatbot lead endpoint
   Target: Hostinger shared hosting (PHP on LiteSpeed).

   Receives the lead JSON from the website assistant, writes it to a
   local log, and emails it to the team using the handoff template in
   §27 of the chatbot knowledge base.

   DEPLOY: this file is served from public_html/api/lead.php.
   Set MAIL_TO / MAIL_FROM below before going live. MAIL_FROM must be
   an address on a domain hosted here — shared hosts reject or spam-file
   mail claiming to come from a domain they don't handle.
   ========================================================== */

declare(strict_types=1);

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
const MAIL_TO      = 'info@vyewfinderfilms.com';
const MAIL_FROM    = 'website@vyewfinderfilms.com'; // must be on this domain
const LOG_FILE     = __DIR__ . '/leads.log';
const MAX_BODY     = 20000;   // bytes; a lead is ~1KB
const MAX_FIELD    = 2000;    // chars per field
const RATE_SECONDS = 20;      // min gap between submissions from one IP

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Strips CR/LF and NUL from any value that will touch a mail header.
 *
 * This is the whole reason this function exists: PHP's mail() builds
 * headers by string concatenation, so a newline inside an attacker-
 * controlled value lets them append arbitrary headers (Bcc, Content-Type)
 * and turn this endpoint into an open relay. Never interpolate raw
 * request input into $headers or $subject.
 */
function header_safe(string $value): string {
    return trim(str_replace(["\r", "\n", "\0", "%0a", "%0d"], ' ', $value));
}

/**
 * Body text is not header context, so newlines are fine — only length
 * is capped. mbstring is present on virtually all shared hosting but
 * is not guaranteed; falling back to substr keeps a missing extension
 * from fatalling the whole endpoint.
 */
function body_safe($value): string {
    if (!is_scalar($value)) return '';
    $text = trim((string) $value);
    return function_exists('mb_substr')
        ? mb_substr($text, 0, MAX_FIELD)
        : substr($text, 0, MAX_FIELD);
}

function respond(int $code, array $payload): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

// ---------------------------------------------------------------
// Request guards
// ---------------------------------------------------------------
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0 || strlen($raw) > MAX_BODY) {
    respond(400, ['ok' => false, 'error' => 'bad_payload']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'error' => 'bad_json']);
}

/* Crude per-IP throttle. Not a security boundary — it just stops a
   stuck client or a casual script from flooding the inbox. */
$ipHash    = substr(hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'cli'), 0, 16);
$rateFile  = sys_get_temp_dir() . '/vf_lead_' . $ipHash;
if (is_file($rateFile) && (time() - (int) filemtime($rateFile)) < RATE_SECONDS) {
    respond(429, ['ok' => false, 'error' => 'rate_limited']);
}
@touch($rateFile);

// ---------------------------------------------------------------
// Build the lead record (§26 / §27)
// ---------------------------------------------------------------
$fields = [
    'Name'                   => 'full_name',
    'Business'               => 'business_name',
    'Email'                  => 'email',
    'Phone'                  => 'phone',
    'Preferred contact'      => 'preferred_contact_method',
    'Service requested'      => 'service_interest',
    'Project goal'           => 'project_goal',
    'Requested deliverables' => 'deliverables_requested',
    'Location'               => 'production_location',
    'Preferred date'         => 'preferred_date',
    'Budget guidance'        => 'budget_guidance',
];

$lines = ['NEW VYEWFINDER FILMS CHATBOT LEAD', ''];
$lines[] = 'Preferred language: ' . body_safe($data['language'] ?? 'English');
$lines[] = 'Submitted: ' . body_safe($data['submitted_at'] ?? gmdate('c'));
$lines[] = '';

$hasContact = false;
foreach ($fields as $label => $key) {
    $value = body_safe($data[$key] ?? '');
    if ($value === '') continue;
    if ($key === 'email' || $key === 'phone') $hasContact = true;
    $lines[] = $label . ': ' . $value;
}

// §14.1 — without a contact method the lead is not actionable.
if (!$hasContact) {
    respond(422, ['ok' => false, 'error' => 'missing_contact']);
}

$lines[] = '';
$lines[] = 'Source: website assistant';
$body = implode("\n", $lines);

// ---------------------------------------------------------------
// Durable record first — the log survives even if mail() fails
// ---------------------------------------------------------------
@file_put_contents(
    LOG_FILE,
    '[' . gmdate('c') . '] ' . json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL,
    FILE_APPEND | LOCK_EX
);

// ---------------------------------------------------------------
// Email
// ---------------------------------------------------------------
$service = header_safe(body_safe($data['service_interest'] ?? 'New enquiry'));
$subject = 'Website lead — ' . ($service !== '' ? $service : 'New enquiry');

$headers = [
    'From: Vyewfinder Website <' . MAIL_FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
];

/* Reply-To lets the team hit reply and reach the visitor directly.
   Validated *and* header-sanitised: filter_var alone would still pass
   some values that are unsafe once concatenated into a header. */
$replyTo = header_safe(body_safe($data['email'] ?? ''));
if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
    $headers[] = 'Reply-To: ' . $replyTo;
}

$sent = @mail(MAIL_TO, $subject, $body, implode("\r\n", $headers));

/* Report ok when the lead was captured. The log write is the record of
   truth; a mail() failure is reported separately so the client can fall
   back to the WhatsApp or mailto handoff. */
respond(200, ['ok' => true, 'mailed' => (bool) $sent]);
