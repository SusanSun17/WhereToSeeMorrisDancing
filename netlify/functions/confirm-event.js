// Reached when a bag-man clicks the confirmation link from submit-event.js.
// Only ever acts on a token that HAS a payload — an event_edit "access"
// token (payload null, from request-manage-events.js) is a different job
// and is handled by get-event-for-edit.js instead. See "The same
// event_edit token type does two different jobs" in
// docs/phase7_event_submission_v001.md.
const { supabaseRequest } = require('./_supabase');

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

  if (tokenRow.type === 'event_publish') {
    const insertRes = await supabaseRequest('event', {
      method: 'POST',
      body: JSON.stringify({ bag_man_id: tokenRow.recipient_bag_man_id, morris_sides: morrisSides, description: description || null }),
    });
    if (!insertRes.ok) { console.error(await insertRes.text()); return { statusCode: 502, body: JSON.stringify({ status: 'error' }) }; }
    eventId = (await insertRes.json())[0].id;
  } else {
    // Event no longer exists (e.g. deleted between submitting and confirming).
    const existsRes = await supabaseRequest(`event?id=eq.${eventId}&select=id`);
    if ((await existsRes.json()).length === 0) {
      return { statusCode: 200, body: JSON.stringify({ status: 'event-gone' }) };
    }
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

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
