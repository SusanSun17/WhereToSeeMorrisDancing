// Called when a bag-man types their email on Add events (plan §6.2 point 2).
// Deliberately returns the SAME 'unrecognised' status for both "no such
// row" and "banned" — see plan §9.10 and docs/phase6_bagman_registration_v001.md.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: 'Missing or invalid email' };
  }

  const res = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=verified,banned`
  );
  if (!res.ok) {
    console.error('Supabase error', await res.text());
    return { statusCode: 502, body: 'Database error' };
  }

  const rows = await res.json();
  const bagMan = rows[0];

  if (!bagMan || bagMan.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'unrecognised' }) };
  }
  if (!bagMan.verified) {
    return { statusCode: 200, body: JSON.stringify({ status: 'pending' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ status: 'verified' }) };
};
