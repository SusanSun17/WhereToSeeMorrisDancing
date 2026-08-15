// plan §6.2 point 2, rate-limited per plan §8. Emails one message
// listing every current/upcoming event the bag-man owns (with a fresh
// edit link AND delete link each) or co-edits (edit link only — §9.6/§9.8
// reserve delete/co-editor changes for the owner).
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

const RATE_LIMIT_MS = 5 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { email: rawEmail } = JSON.parse(event.body || '{}');
  const email = (rawEmail || '').trim().toLowerCase();

  const bagManRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,retired,banned,last_manage_request_at`);
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan || !bagMan.verified || bagMan.retired || bagMan.banned) {
    // Same "don't reveal anything" principle as check-bagman-email.js.
    return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };
  }
  if (bagMan.last_manage_request_at && Date.now() - new Date(bagMan.last_manage_request_at).getTime() < RATE_LIMIT_MS) {
    return { statusCode: 200, body: JSON.stringify({ status: 'rate-limited' }) };
  }
  await supabaseRequest(`bag_man?id=eq.${bagMan.id}`, { method: 'PATCH', body: JSON.stringify({ last_manage_request_at: new Date().toISOString() }) });

  const now = new Date().toISOString();
  const ownedRes = await supabaseRequest(
    `event?bag_man_id=eq.${bagMan.id}&select=id,morris_sides,location(event_date,start_time,end_time)`
  );
  const coEditedRes = await supabaseRequest(
    `event_co_editor?bag_man_id=eq.${bagMan.id}&select=event:event_id(id,morris_sides,location(event_date,start_time,end_time))`
  );
  const owned = (await ownedRes.json()).filter(hasFutureLocation);
  const coEdited = (await coEditedRes.json()).map((r) => r.event).filter(hasFutureLocation);

  const lines = [];
  for (const ev of owned) {
    const editToken = await issueAccessToken(ev.id, bagMan.id);
    const deleteToken = await issueDeleteToken(ev.id, bagMan.id);
    lines.push(`${ev.morris_sides.join(', ')}:\n  Edit: ${siteUrl()}/edit-event.html?token=${editToken}\n  Delete: ${siteUrl()}/delete-event.html?token=${deleteToken}`);
  }
  for (const ev of coEdited) {
    const editToken = await issueAccessToken(ev.id, bagMan.id);
    lines.push(`${ev.morris_sides.join(', ')} (you're a co-editor):\n  Edit: ${siteUrl()}/edit-event.html?token=${editToken}`);
  }

  if (lines.length === 0) {
    lines.push('You have no current or upcoming events.');
  }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
      to: [{ email }],
      subject: 'Your Where to See Morris Dancing events',
      textContent: `Here are fresh links for your events (each valid for 48 hours):\n\n${lines.join('\n\n')}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };

  function hasFutureLocation(ev) {
    return ev.location.some((l) => new Date(`${l.event_date}T${l.end_time || l.start_time}`) >= new Date(now));
  }
  function siteUrl() { return process.env.SITE_URL; }
  async function issueAccessToken(eventId, recipientId) {
    const token = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_edit', token, related_id: eventId, recipient_bag_man_id: recipientId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    return token;
  }
  async function issueDeleteToken(eventId, recipientId) {
    const token = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_delete', token, related_id: eventId, recipient_bag_man_id: recipientId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    return token;
  }
};
