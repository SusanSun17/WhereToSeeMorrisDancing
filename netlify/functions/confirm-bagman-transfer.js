// plan §9.9. Only enacts the transfer once BOTH parties' tokens (same
// bag_man_transfer_request via related_id) are used. Emails refer to each
// party by email, not side_name — see note in request-bagman-transfer.js.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_retirement_transfer&select=*`);
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }
  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  // Is the OTHER party's token (same transfer request) already used too?
  const otherRes = await supabaseRequest(
    `verification_token?type=eq.bagman_retirement_transfer&related_id=eq.${tokenRow.related_id}&id=neq.${tokenRow.id}&select=used_at`
  );
  const other = (await otherRes.json())[0];
  if (!other || !other.used_at) {
    return { statusCode: 200, body: JSON.stringify({ status: 'waiting-for-other-party' }) };
  }

  // Both confirmed — enact the transfer atomically.
  const transferRes = await supabaseRequest(`bag_man_transfer_request?id=eq.${tokenRow.related_id}&select=*`);
  const transfer = (await transferRes.json())[0];
  if (!transfer || transfer.completed_at) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-completed' }) };
  }

  const now = new Date().toISOString();
  // Only reassign events with at least one future/current location — past
  // events keep their original owner for accurate historical attribution.
  const eventsRes = await supabaseRequest(
    `event?bag_man_id=eq.${transfer.retiring_bag_man_id}&select=id,location(event_date,start_time,end_time)`
  );
  const events = (await eventsRes.json()).filter((ev) =>
    ev.location.some((l) => new Date(`${l.event_date}T${l.end_time || l.start_time}`) >= new Date())
  );
  for (const ev of events) {
    await supabaseRequest(`event?id=eq.${ev.id}`, { method: 'PATCH', body: JSON.stringify({ bag_man_id: transfer.successor_bag_man_id }) });
  }
  await supabaseRequest(`bag_man?id=eq.${transfer.retiring_bag_man_id}`, { method: 'PATCH', body: JSON.stringify({ retired: true }) });
  await supabaseRequest(`bag_man_transfer_request?id=eq.${transfer.id}`, { method: 'PATCH', body: JSON.stringify({ completed_at: now }) });

  // Completion emails to both parties (fetch their addresses to send to).
  const bothRes = await supabaseRequest(`bag_man?id=in.(${transfer.retiring_bag_man_id},${transfer.successor_bag_man_id})&select=id,email`);
  const both = await bothRes.json();
  const retiring = both.find((b) => b.id === transfer.retiring_bag_man_id);
  const successor = both.find((b) => b.id === transfer.successor_bag_man_id);
  const sendEmail = (to, subject, textContent) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL }, to: [{ email: to }], subject, textContent }),
  });
  await sendEmail(retiring.email, 'Handover complete', `Your events have been handed over to ${successor.email}. Thanks for your time as bag-man!`);
  await sendEmail(successor.email, 'You now own these events', `${events.length} event(s) from ${retiring.email} are now yours to manage — use "Manage my existing events" on Add events any time.`);

  return { statusCode: 200, body: JSON.stringify({ status: 'transfer-complete' }) };
};
