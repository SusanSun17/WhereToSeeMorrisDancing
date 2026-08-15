// plan §6.2 point 2, rate-limited per plan §8. Emails one message
// listing events the bag-man owns (with a fresh edit link AND delete
// link each) or co-edits (edit link only — §9.6/§9.8 reserve
// delete/co-editor changes for the owner). Capped to the same 2-months-
// back window the public map/calendar already uses (§9.1) — an event
// older than that is already invisible to Spectators, so there's no
// value (and real cost, e.g. token-row bloat / a huge email) in bulk-
// (re-)issuing links for it here every time. While an event is still
// within that window it's also individually reachable via the "Request
// edit access" button on its own details popup/modal
// (request-event-access.js) — a lighter-weight route for just one event,
// without waiting for/generating a link for every other event too.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

const RATE_LIMIT_MS = 1 * 60 * 1000;

// Matches find-events-data.js's twoMonthsAgoISODate() — kept as a
// separate copy since this runs in Node, not the browser.
function twoMonthsAgoISODate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

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

  const cutoff = twoMonthsAgoISODate();
  const ownedRes = await supabaseRequest(
    `event?bag_man_id=eq.${bagMan.id}&select=id,morris_sides,location(event_date,start_time,end_time)`
  );
  const coEditedRes = await supabaseRequest(
    `event_co_editor?bag_man_id=eq.${bagMan.id}&select=event:event_id(id,morris_sides,location(event_date,start_time,end_time))`
  );
  const owned = (await ownedRes.json()).filter(hasRecentOrFutureLocation);
  const coEdited = (await coEditedRes.json()).map((r) => r.event).filter(hasRecentOrFutureLocation);

  function hasRecentOrFutureLocation(ev) {
    return ev.location.some((l) => l.event_date >= cutoff);
  }

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
    lines.push(
      'You have no events within the last 2 months or upcoming ' +
      '(older events have already dropped off the public map/calendar, ' +
      'so there is nothing left to manage there).'
    );
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
