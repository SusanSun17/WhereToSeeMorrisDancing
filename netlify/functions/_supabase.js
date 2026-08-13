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

module.exports = { supabaseRequest };
