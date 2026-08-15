// Shared helper: every function in this folder that needs to read/write
// bag_man or verification_token calls supabaseRequest() from here, using
// the SECRET key (bypasses Row-Level Security). Never import this
// pattern into any browser-facing file — see docs/phase6_bagman_registration_v001.md.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function supabaseRequest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
}

// Shared per-email cooldown check for anonymous public forms (Contact
// us, bag-man registration) that have no bag_man row to hang a timestamp
// off — see contact_rate_limit table, Phase 8. Returns false (and does
// NOT update the timestamp) if still within the cooldown.
async function checkAndBumpRateLimit(email, minMs) {
  const res = await supabaseRequest(
    `contact_rate_limit?email=eq.${encodeURIComponent(email)}&select=last_submitted_at`
  );
  const row = (await res.json())[0];
  const now = new Date();
  if (row && now.getTime() - new Date(row.last_submitted_at).getTime() < minMs) {
    return false;
  }
  await supabaseRequest('contact_rate_limit?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ email, last_submitted_at: now.toISOString() }),
  });
  return true;
}

module.exports = { supabaseRequest, checkAndBumpRateLimit };
