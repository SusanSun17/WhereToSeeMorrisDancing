// Reached when a bag-man clicks the confirmation link from submit-event.js.
// Only ever acts on a token that HAS a payload — an event_edit "access"
// token (payload null, from request-manage-events.js) is a different job
// and is handled by get-event-for-edit.js instead. See "The same
// event_edit token type does two different jobs" in
// docs/phase7_event_submission_v001.md.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');
const { formatEventDetailsText, DELETE_WARNING } = require('./_event-details');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=in.(event_publish,event_edit)&select=*`);
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || !tokenRow.payload || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const { description, morrisSides, coEditorIds, locations } = tokenRow.payload;
  let eventId = tokenRow.related_id;
  let ownerBagManId;

  if (tokenRow.type === 'event_publish') {
    const insertRes = await supabaseRequest('event', {
      method: 'POST',
      body: JSON.stringify({ bag_man_id: tokenRow.recipient_bag_man_id, morris_sides: morrisSides, description: description || null }),
    });
    if (!insertRes.ok) { console.error(await insertRes.text()); return { statusCode: 502, body: JSON.stringify({ status: 'error' }) }; }
    eventId = (await insertRes.json())[0].id;
    ownerBagManId = tokenRow.recipient_bag_man_id;
  } else {
    // Event no longer exists (e.g. deleted between submitting and confirming).
    const existsRes = await supabaseRequest(`event?id=eq.${eventId}&select=id,bag_man_id`);
    const existingEvent = (await existsRes.json())[0];
    if (!existingEvent) {
      return { statusCode: 200, body: JSON.stringify({ status: 'event-gone' }) };
    }
    ownerBagManId = existingEvent.bag_man_id;
    await supabaseRequest(`event?id=eq.${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ morris_sides: morrisSides, description: description || null }),
    });
    await supabaseRequest(`location?event_id=eq.${eventId}`, { method: 'DELETE' });
    await supabaseRequest(`event_co_editor?event_id=eq.${eventId}`, { method: 'DELETE' });
  }

  for (const loc of locations) {
    await supabaseRequest('location', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId, latitude: loc.lat, longitude: loc.lng, address_text: loc.addressText,
        event_date: loc.eventDate, start_time: loc.startTime, end_time: loc.endTime || null,
      }),
    });
  }
  for (const coEditorId of coEditorIds) {
    await supabaseRequest('event_co_editor', { method: 'POST', body: JSON.stringify({ event_id: eventId, bag_man_id: coEditorId }) });
  }

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  // So the bag-man isn't forced to use "Manage my existing events" just to get
  // back to this event — send fresh access links now that eventId is known.
  await sendAccessLinksEmail(eventId, tokenRow.recipient_bag_man_id, ownerBagManId === tokenRow.recipient_bag_man_id, morrisSides, description, locations);

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };

  async function sendAccessLinksEmail(eventId, recipientBagManId, isOwner, morrisSides, description, locations) {
    const recipientRes = await supabaseRequest(`bag_man?id=eq.${recipientBagManId}&select=email`);
    const recipient = (await recipientRes.json())[0];
    if (!recipient) return;

    const editToken = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_edit', token: editToken, related_id: eventId, recipient_bag_man_id: recipientBagManId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    let lines = `Edit: ${process.env.SITE_URL}/edit-event.html?token=${editToken}`;

    if (isOwner) {
      const deleteToken = crypto.randomUUID();
      await supabaseRequest('verification_token', {
        method: 'POST',
        body: JSON.stringify({ type: 'event_delete', token: deleteToken, related_id: eventId, recipient_bag_man_id: recipientBagManId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
      });
      lines += `\nDelete: ${process.env.SITE_URL}/delete-event.html?token=${deleteToken}\n(${DELETE_WARNING})`;
    }

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
        to: [{ email: recipient.email }],
        subject: 'Save these links for your event',
        textContent:
          `Your event is now live. Keep these links safe (each valid for 48 hours) in case you need to make changes:\n\n` +
          `${formatEventDetailsText({ morrisSides, description, locations })}\n\n${lines}\n\n` +
          `If they expire, just use "Manage my existing events" on the Add events page to get fresh ones.`,
      }),
    });
  }
};
