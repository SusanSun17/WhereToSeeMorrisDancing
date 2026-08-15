// Reached when the WEBMASTER clicks the link from their own inbox
// (plan §9.10) — never sent to or clickable by the bag-man being struck
// off. Performs the whole strike-off atomically-enough for this scale:
// delete owned events (cascades location/event_co_editor), remove them
// as someone else's co-editor, cancel pending transfers, invalidate
// their other tokens, then ban.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };
  }

  const tokenRes = await supabaseRequest(
    `verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_strike_off&select=*`
  );
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const bagManId = tokenRow.related_id;

  // Cascades to location + event_co_editor for events they OWN.
  await supabaseRequest(`event?bag_man_id=eq.${bagManId}`, { method: 'DELETE' });

  // Co-editor rows on OTHER people's events — those events are untouched.
  await supabaseRequest(`event_co_editor?bag_man_id=eq.${bagManId}`, { method: 'DELETE' });

  // Pending (unfinished) retirement handovers involving them, either side.
  await supabaseRequest(
    `bag_man_transfer_request?completed_at=is.null&or=(retiring_bag_man_id.eq.${bagManId},successor_bag_man_id.eq.${bagManId})`,
    { method: 'DELETE' }
  );

  // Any other outstanding links emailed directly to them (registration,
  // retirement) become no-ops. Event-scoped tokens need no action here —
  // their events no longer exist, and confirm-event.js / confirm-event-delete.js
  // already handle a missing event gracefully (Phase 7).
  await supabaseRequest(
    `verification_token?recipient_bag_man_id=eq.${bagManId}&used_at=is.null`,
    { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) }
  );

  await supabaseRequest(`bag_man?id=eq.${bagManId}`, {
    method: 'PATCH',
    body: JSON.stringify({ banned: true }),
  });

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
