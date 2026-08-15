// Owner-only (plan §9.8): re-uses the access token's identity (see "A used
// access token can still prove identity" in
// docs/phase7_event_submission_v001.md) to issue a brand-new event_delete
// token and email a permanent-deletion confirmation link.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid payload' }; }

  const accessToken = body.accessToken;
  if (!accessToken) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(accessToken)}&type=eq.event_edit&select=*`);
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow) return { statusCode: 200, body: JSON.stringify({ status: 'invalid' }) };

  const eventRes = await supabaseRequest(`event?id=eq.${tokenRow.related_id}&select=id,bag_man_id`);
  const eventRow = (await eventRes.json())[0];
  if (!eventRow) return { statusCode: 200, body: JSON.stringify({ status: 'event-gone' }) };

  if (eventRow.bag_man_id !== tokenRow.recipient_bag_man_id) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const bagManRes = await supabaseRequest(`bag_man?id=eq.${tokenRow.recipient_bag_man_id}&select=email`);
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan) return { statusCode: 200, body: JSON.stringify({ status: 'invalid' }) };

  const deleteToken = crypto.randomUUID();
  await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({
      type: 'event_delete',
      token: deleteToken,
      related_id: eventRow.id,
      recipient_bag_man_id: tokenRow.recipient_bag_man_id,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    }),
  });

  const SITE_URL = process.env.SITE_URL;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
      to: [{ email: bagMan.email }],
      subject: 'Confirm deleting your event',
      textContent:
        `Clicking the link below will PERMANENTLY delete this event and all its locations — this cannot be undone. ` +
        `If you didn't request this, just ignore this email and nothing will change.\n\n` +
        `${SITE_URL}/delete-event.html?token=${deleteToken}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent' }) };
};
