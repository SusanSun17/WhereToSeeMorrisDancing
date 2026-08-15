// Validates an event_edit "access" token (payload IS NULL — the
// confirmation-payload variant of this type is handled by confirm-event.js
// instead, see "The same event_edit token type does two different jobs"
// in docs/phase7_event_submission_v001.md), marks it used, and returns
// the event's current details for event-form.js to prefill.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=eq.event_edit&payload=is.null&select=*`);
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const eventRes = await supabaseRequest(
    `event?id=eq.${tokenRow.related_id}&select=id,bag_man_id,description,morris_sides,location(address_text,latitude,longitude,event_date,start_time,end_time),event_co_editor(bag_man:bag_man_id(email))`
  );
  const eventRow = (await eventRes.json())[0];
  if (!eventRow) {
    return { statusCode: 200, body: JSON.stringify({ status: 'event-gone' }) };
  }

  const bagManRes = await supabaseRequest(`bag_man?id=eq.${tokenRow.recipient_bag_man_id}&select=email`);
  const bagMan = (await bagManRes.json())[0];

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'ok',
      id: eventRow.id,
      email: bagMan ? bagMan.email : '',
      isOwner: eventRow.bag_man_id === tokenRow.recipient_bag_man_id,
      description: eventRow.description,
      morrisSides: eventRow.morris_sides,
      coEditorEmails: eventRow.event_co_editor.map((ce) => ce.bag_man.email),
      locations: eventRow.location.map((l) => ({
        addressText: l.address_text,
        lat: l.latitude,
        lng: l.longitude,
        eventDate: l.event_date,
        startTime: l.start_time,
        endTime: l.end_time,
      })),
    }),
  };
};
