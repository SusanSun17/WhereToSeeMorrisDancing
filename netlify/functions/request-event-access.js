// Reached from the "Request edit access" button on a single event's
// details popup/modal on find-events.html (plan §6.2 point 7 — a second,
// lighter-weight route back to one event's edit/delete links, alongside
// the bulk "Manage my existing events" list in request-manage-events.js).
// Never reveals whether the given email is registered, or whether it
// owns/co-edits this particular event — always responds the same way,
// and only ever emails the address already on file for a matching
// bag-man (never the address typed into the form).
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');
const { formatEventDetailsText, mapDbLocations, DELETE_WARNING } = require('./_event-details');

const RATE_LIMIT_MS = 1 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Invalid payload' }; }

  const email = (body.email || '').trim().toLowerCase();
  const eventId = body.eventId;
  if (!email || !eventId) return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };

  const bagManRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(email)}&select=id,email,verified,retired,banned,last_manage_request_at`);
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan || !bagMan.verified || bagMan.retired || bagMan.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };
  }
  // Shares the same cooldown column/window as request-manage-events.js,
  // so this route can't be used to work around that rate limit by
  // probing one event at a time instead of requesting the bulk list.
  if (bagMan.last_manage_request_at && Date.now() - new Date(bagMan.last_manage_request_at).getTime() < RATE_LIMIT_MS) {
    return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };
  }
  await supabaseRequest(`bag_man?id=eq.${bagMan.id}`, { method: 'PATCH', body: JSON.stringify({ last_manage_request_at: new Date().toISOString() }) });

  const eventRes = await supabaseRequest(`event?id=eq.${eventId}&select=id,bag_man_id,morris_sides,location(event_date,start_time,end_time,address_text)`);
  const eventRow = (await eventRes.json())[0];
  if (!eventRow) return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };

  const isOwner = eventRow.bag_man_id === bagMan.id;
  let isCoEditor = false;
  if (!isOwner) {
    const ceRes = await supabaseRequest(`event_co_editor?event_id=eq.${eventId}&bag_man_id=eq.${bagMan.id}&select=id`);
    isCoEditor = (await ceRes.json()).length > 0;
  }
  if (!isOwner && !isCoEditor) {
    return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };
  }

  const editToken = await issueToken('event_edit', eventId, bagMan.id);
  let lines = `Edit: ${process.env.SITE_URL}/edit-event.html?token=${editToken}`;
  if (isOwner) {
    const deleteToken = await issueToken('event_delete', eventId, bagMan.id);
    lines += `\nDelete: ${process.env.SITE_URL}/delete-event.html?token=${deleteToken}\n(${DELETE_WARNING})`;
  }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
      to: [{ email: bagMan.email }],
      subject: 'Your requested event link',
      textContent:
        `Here is a fresh link for your event, valid for 48 hours:\n\n` +
        `${formatEventDetailsText({ morrisSides: eventRow.morris_sides, locations: mapDbLocations(eventRow.location) })}\n\n${lines}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };

  async function issueToken(type, relatedId, recipientId) {
    const token = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type, token, related_id: relatedId, recipient_bag_man_id: recipientId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    return token;
  }
};
