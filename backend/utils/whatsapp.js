/**
 * WhatsApp delivery service — Meta Cloud API.
 *
 * Templates used:
 *   OTP    → "supertech_alert"     (language: en)
 *   Alert  → "fieldops_alert"      (language: en)
 *   Query  → "fieldops_query"      (language: en)  ← NEW
 *
 * Required env vars in backend/.env:
 *   WHATSAPP_TOKEN=<permanent or system-user token>
 *   WHATSAPP_PHONE_NUMBER_ID=<your WhatsApp Business phone number id>
 *   (also accepts WHATSAPP_PHONE_ID for backward compat)
 *
 * Phone numbers must be E.164 digits WITHOUT '+', e.g. 919812345678.
 */

const TOKEN       = process.env.WHATSAPP_TOKEN;
const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';

// Retry configuration
const MAX_RETRIES        = 3;   // total attempts per message
const RETRY_BASE_DELAY   = 1000; // ms — doubles on each retry (1s, 2s, 4s)
const BULK_SEND_DELAY    = 300;  // ms between each number in a bulk send (avoid rate limits)

export const isWhatsAppConfigured = () => Boolean(TOKEN && PHONE_ID);

export const normalizePhone = (raw = '') => String(raw).replace(/[^\d]/g, '');

const BASE_HEADERS = () => ({
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
});

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determine if a failed request is worth retrying.
 * Retryable: network errors, 429 (rate limit), 5xx (server errors).
 * Non-retryable: 4xx except 429 (bad payload, invalid number, etc.).
 */
const isRetryable = (status, errorCode) => {
  if (!status) return true;                  // network/timeout — always retry
  if (status === 429) return true;           // rate limited
  if (status >= 500) return true;            // Meta server error
  // Meta WhatsApp error codes that are transient
  if ([130429, 131048, 131056, 80007].includes(errorCode)) return true;
  return false;
};

/**
 * Post a WhatsApp message with automatic retry + exponential backoff.
 * Throws only after all retries are exhausted.
 */
const postMessage = async (payload) => {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: BASE_HEADERS(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorCode = data.error?.code;
        const errorMsg  = data.error?.message || `WhatsApp API error (${response.status})`;

        if (!isRetryable(response.status, errorCode)) {
          // Non-retryable error — throw immediately, no point retrying
          throw new Error(`[non-retryable] ${errorMsg}`);
        }

        lastError = new Error(errorMsg);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
          console.warn(`⚠️  WhatsApp attempt ${attempt}/${MAX_RETRIES} failed (${response.status}): ${errorMsg}. Retrying in ${delay}ms…`);
          await sleep(delay);
          continue;
        }

        throw lastError;
      }

      return data; // success
    } catch (err) {
      // Re-throw non-retryable errors immediately
      if (err.message.startsWith('[non-retryable]')) {
        throw new Error(err.message.replace('[non-retryable] ', ''));
      }

      lastError = err;

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.warn(`⚠️  WhatsApp attempt ${attempt}/${MAX_RETRIES} threw: ${err.message}. Retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/* ─── OTP via approved template ─────────────────────────────── */
export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtpWhatsApp = async (to, otp) => {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'empty phone' };

  if (!isWhatsAppConfigured()) {
    console.log(`📲 [WhatsApp:DEV] OTP for ${phone} → ${otp}`);
    return { ok: true, skipped: true };
  }
  try {
    await postMessage({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'supertech_alert',
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [{ type: 'text', text: otp }],
          },
        ],
      },
    });
    return { ok: true };
  } catch (e) {
    console.error(`❌ WhatsApp OTP error (${phone}):`, e.message);
    return { ok: false, error: e.message };
  }
};

/* ─── Alert via approved template ───────────────────────────── */
/**
 * Sends the "fieldops_alert" template.
 * Template body params:
 *   {{1}} = site name
 *   {{2}} = thana, district
 *   {{3}} = sender phone
 *   {{4}} = remark (or "-")
 *   {{5}} = Google Maps URL (or "-")
 *   {{6}} = time string
 */
export const sendAlertWhatsApp = async (to, { siteName, thana, district, senderPhone, remark, latitude, longitude, time }) => {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'empty phone' };

  const coords = (latitude != null && longitude != null)
    ? `https://maps.google.com/?q=${latitude},${longitude}`
    : '-';

  if (!isWhatsAppConfigured()) {
    console.log(`📲 [WhatsApp:DEV] ALERT to ${phone} — ${siteName}`);
    return { ok: true, skipped: true };
  }
  try {
    await postMessage({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'fieldops_alert',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: siteName },
              { type: 'text', text: `${thana || '-'}, ${district || '-'}` },
              { type: 'text', text: `+${senderPhone}` },
              { type: 'text', text: remark || '-' },
              { type: 'text', text: coords },
              { type: 'text', text: time },
            ],
          },
        ],
      },
    });
    return { ok: true };
  } catch (e) {
    console.error(`❌ WhatsApp Alert error (${phone}):`, e.message);
    return { ok: false, error: e.message };
  }
};

/**
 * Send alerts to multiple numbers SEQUENTIALLY with a small delay between
 * each send to avoid hitting Meta's rate limits.
 * Returns an array of results — one per unique number.
 */
export const sendAlertWhatsAppBulk = async (numbers = [], alertData) => {
  const unique = [...new Set(numbers.map(normalizePhone).filter(Boolean))];
  if (!unique.length) return [];

  const results = [];
  for (const phone of unique) {
    const result = await sendAlertWhatsApp(phone, alertData);
    results.push({ phone, ...result });

    if (!result.ok && !result.skipped) {
      console.error(`❌ Bulk alert failed for ${phone}: ${result.error}`);
    }

    // Small pause between sends to respect Meta rate limits
    if (unique.indexOf(phone) < unique.length - 1) {
      await sleep(BULK_SEND_DELAY);
    }
  }
  return results;
};

/* ─── Query notification via approved template ──────────────── */
/**
 * Sends the "fieldops_query" template to company numbers.
 *
 * Create this template on Meta with these body params:
 *   {{1}} = Query ID (short)
 *   {{2}} = category (e.g. camera / wifi / power_supply)
 *   {{3}} = priority (low / medium / high / critical)
 *   {{4}} = site name
 *   {{5}} = thana, district
 *   {{6}} = title
 *   {{7}} = raised by (superadmin name)
 *   {{8}} = status
 *   {{9}} = time
 *
 * Suggested template body:
 * "🔔 *New Service Query*
 * Query ID: {{1}}
 * Category: {{2}} | Priority: {{3}}
 * Site: {{4}} ({{5}})
 * Issue: {{6}}
 * Raised By: {{7}}
 * Status: {{8}}
 * Time: {{9}}"
 */
export const sendQueryWhatsApp = async (numbers = [], {
  queryId, siteName, thana, district, category, title, priority, superadminName, status, time,
}) => {
  const unique = [...new Set(numbers.map(normalizePhone).filter(Boolean))];
  if (!unique.length) return [];

  if (!isWhatsAppConfigured()) {
    console.log(`📲 [WhatsApp:DEV] QUERY to [${unique.join(', ')}] — ${siteName}: ${title}`);
    return unique.map(() => ({ ok: true, skipped: true }));
  }

  const results = [];
  for (const phone of unique) {
    try {
      await postMessage({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'fieldops_query',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: queryId || '-' },
                { type: 'text', text: category || '-' },
                { type: 'text', text: priority || 'medium' },
                { type: 'text', text: siteName || '-' },
                { type: 'text', text: `${thana || '-'}, ${district || '-'}` },
                { type: 'text', text: title || '-' },
                { type: 'text', text: superadminName || '-' },
                { type: 'text', text: status || 'open' },
                { type: 'text', text: time || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
              ],
            },
          ],
        },
      });
      results.push({ phone, ok: true });
    } catch (e) {
      console.error(`❌ WhatsApp Query error (${phone}):`, e.message);
      results.push({ phone, ok: false, error: e.message });
    }

    // Small pause between sends to respect Meta rate limits
    if (unique.indexOf(phone) < unique.length - 1) {
      await sleep(BULK_SEND_DELAY);
    }
  }
  return results;
};

/* ─── Plain text (kept for any internal/dev use) ────────────── */
export const sendWhatsApp = async (to, body) => {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'empty phone' };

  if (!isWhatsAppConfigured()) {
    console.log(`📲 [WhatsApp:DEV] -> ${phone}\n${body}\n`);
    return { ok: true, skipped: true };
  }
  try {
    await postMessage({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { preview_url: false, body },
    });
    return { ok: true };
  } catch (e) {
    console.error(`❌ WhatsApp error (${phone}):`, e.message);
    return { ok: false, error: e.message };
  }
};

/**
 * Send plain-text messages to multiple numbers sequentially.
 */
export const sendWhatsAppBulk = async (numbers = [], body) => {
  const unique = [...new Set(numbers.map(normalizePhone).filter(Boolean))];
  if (!unique.length) return [];

  const results = [];
  for (const phone of unique) {
    const result = await sendWhatsApp(phone, body);
    results.push({ phone, ...result });

    if (unique.indexOf(phone) < unique.length - 1) {
      await sleep(BULK_SEND_DELAY);
    }
  }
  return results;
};