// Reached when a bag-man clicks the link in their verification email
// (Step 6). A GET request with the token as a query parameter, matching
// how the link is a plain URL, not a form submission.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };
  }

  const tokenRes = await supabaseRequest(
    `verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_registration&select=*`
  );
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const updateBagMan = await supabaseRequest(`bag_man?id=eq.${tokenRow.related_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ verified: true }),
  });
  if (!updateBagMan.ok) {
    console.error('Supabase update error', await updateBagMan.text());
    return { statusCode: 502, body: JSON.stringify({ status: 'error' }) };
  }

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
