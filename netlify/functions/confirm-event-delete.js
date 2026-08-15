// Cascades to location and event_co_editor automatically (Phase 2 FKs).
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=eq.event_delete&select=*`);
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }
  const existsRes = await supabaseRequest(`event?id=eq.${tokenRow.related_id}&select=id`);
  if ((await existsRes.json()).length === 0) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-gone' }) };
  }

  await supabaseRequest(`event?id=eq.${tokenRow.related_id}`, { method: 'DELETE' });
  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  return { statusCode: 200, body: JSON.stringify({ status: 'deleted' }) };
};
