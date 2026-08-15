// Verifies a Cloudflare Turnstile token server-side — the widget running
// in the browser proves nothing on its own, since a bot can just skip
// calling it and post straight to the endpoint. TURNSTILE_SITE_KEY is
// NOT secret (it's meant to ship to the browser); only
// TURNSTILE_SECRET_KEY is a real secret, kept server-side only.
async function verifyTurnstile(token) {
  if (!token) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('Missing TURNSTILE_SECRET_KEY');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('Turnstile verification error', err);
    return false;
  }
}

module.exports = { verifyTurnstile };
