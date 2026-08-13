// Unlisted, admin-secret-protected: the webmaster's one manual step per
// pending registration (plan §6.2 point 1, "the webmaster vetting step").
// The same ADMIN_SECRET also gates the Phase 8 strike-off page.
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

  const lookupRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,banned`
  );
  const bagMan = (await lookupRes.json())[0];

  if (!bagMan) {
    return { statusCode: 200, body: JSON.stringify({ status: 'not-found' }) };
  }
  if (bagMan.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'banned' }) };
  }
  if (bagMan.verified) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-verified' }) };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const tokenRes = await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({
      type: 'bagman_registration',
      token,
      related_id: bagMan.id,
      expires_at: expiresAt,
    }),
  });
  if (!tokenRes.ok) {
    console.error('Supabase token insert error', await tokenRes.text());
    return { statusCode: 502, body: 'Database error' };
  }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email }],
      subject: 'Please confirm your bag-man registration',
      textContent:
        `Thanks for registering with Where to See Morris Dancing. Please confirm ` +
        `this is really your email address by clicking the link below (valid for 48 hours):\n\n` +
        `${SITE_URL}/confirm-registration.html?token=${token}\n\n` +
        `Once confirmed, head back to Add events to submit your side's first event.`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent' }) };
};
