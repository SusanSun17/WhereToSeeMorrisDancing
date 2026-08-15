// Webmaster-only, admin-secret-protected (plan §9.10). Emails a
// last-chance "are you sure, here's what will be deleted" summary to the
// WEBMASTER's own address, never the bag-man's — never a two-sided
// confirmation like retirement (§9.9), since this is deliberately
// one-sided.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

function secretMatches(provided) {
  const expected = process.env.ADMIN_SECRET || '';
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }
  if (!secretMatches(payload.adminSecret)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;
  const SITE_URL = process.env.SITE_URL;
  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    return { statusCode: 400, body: 'Missing email' };
  }

  const bagManRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,side_name,email`
  );
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan) {
    return { statusCode: 200, body: JSON.stringify({ status: 'not-found' }) };
  }

  const eventsRes = await supabaseRequest(
    `event?bag_man_id=eq.${bagMan.id}&select=id,description,morris_sides,location(address_text,date,start_time)`
  );
  const events = await eventsRes.json();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({ type: 'bagman_strike_off', token, related_id: bagMan.id, expires_at: expiresAt }),
  });

  const summary = events
    .map((ev) => `- ${ev.location?.map((l) => `${l.address_text} on ${l.date} ${l.start_time}`).join(' / ')} (${ev.morris_sides?.join(', ')})`)
    .join('\n') || '(no events)';

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email: WEBMASTER_EMAIL }],
      subject: `Confirm strike-off: ${bagMan.side_name} <${bagMan.email}>`,
      textContent:
        `This will PERMANENTLY delete every event below and ban ${bagMan.email} from re-registering. This cannot be undone.\n\n` +
        `Events to be deleted:\n${summary}\n\n` +
        `To confirm, click: ${SITE_URL}/confirm-strike-off.html?token=${token}\n\n` +
        `If you didn't request this, ignore this email — nothing happens until the link is clicked.`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent' }) };
};
