// plan §9.9. Looks up both bag-men, creates one bag_man_transfer_request
// row, and issues each party their own bagman_retirement_transfer token
// (7-day expiry — longer than the 48hr event tokens since this needs two
// separate people to act). Wording refers to each party by email, not
// side_name — retiring and successor bag-men are often from the SAME side,
// so "handed over to <side name>" would be confusing/wrong.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid payload' }; }

  const email = (body.email || '').trim().toLowerCase();
  const successorEmail = (body.successorEmail || '').trim().toLowerCase();
  if (!email || !successorEmail) return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message: 'Both email addresses are required.' }) };
  if (email === successorEmail) return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message: 'Successor must be a different bag-man.' }) };

  const retiringRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(email)}&select=id,email,verified,retired,banned`);
  const retiring = (await retiringRes.json())[0];
  if (!retiring || !retiring.verified || retiring.retired || retiring.banned) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const successorRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(successorEmail)}&select=id,email,verified,retired,banned`);
  const successor = (await successorRes.json())[0];
  if (!successor || !successor.verified || successor.retired || successor.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message: "That successor isn't a registered bag-man yet — ask them to register via Add events first." }) };
  }

  const transferRes = await supabaseRequest('bag_man_transfer_request', {
    method: 'POST',
    body: JSON.stringify({ retiring_bag_man_id: retiring.id, successor_bag_man_id: successor.id }),
  });
  if (!transferRes.ok) {
    console.error('Supabase transfer insert error', await transferRes.text());
    return { statusCode: 502, body: 'Database error' };
  }
  const transfer = (await transferRes.json())[0];

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const retiringToken = crypto.randomUUID();
  const successorToken = crypto.randomUUID();

  await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({ type: 'bagman_retirement_transfer', token: retiringToken, related_id: transfer.id, recipient_bag_man_id: retiring.id, expires_at: expiresAt }),
  });
  await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({ type: 'bagman_retirement_transfer', token: successorToken, related_id: transfer.id, recipient_bag_man_id: successor.id, expires_at: expiresAt }),
  });

  const SITE_URL = process.env.SITE_URL;
  const sendEmail = (to, subject, textContent) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL }, to: [{ email: to }], subject, textContent }),
  });

  await sendEmail(
    retiring.email,
    'Confirm handing over your events',
    `Please confirm you want to hand over your Where to See Morris Dancing events to ${successor.email} ` +
      `by clicking the link below (valid for 7 days) — this only takes effect once ${successor.email} confirms too:\n\n` +
      `${SITE_URL}/confirm-transfer.html?token=${retiringToken}`
  );
  await sendEmail(
    successor.email,
    'Confirm taking over these events',
    `${retiring.email} wants to hand over their Where to See Morris Dancing events to you. Please confirm by clicking ` +
      `the link below (valid for 7 days) — this only takes effect once ${retiring.email} confirms too:\n\n` +
      `${SITE_URL}/confirm-transfer.html?token=${successorToken}`
  );

  return { statusCode: 200, body: JSON.stringify({ status: 'requested' }) };
};
