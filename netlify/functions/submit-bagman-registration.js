// Handles registration submissions from Add events (plan §6.2 point 1).
// - A banned email is silently dropped: no bag_man row is touched, no
//   email sent to anyone (plan §9.10) — the applicant sees an ordinary
//   "thanks, forwarded for vetting" message regardless, so a struck-off
//   individual gets no signal that anything different happened.
// - An already-registered (pending or verified) email isn't re-submitted
//   to the webmaster a second time.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;
  if (!BREVO_API_KEY || !WEBMASTER_EMAIL) {
    console.error('Missing BREVO_API_KEY or WEBMASTER_EMAIL');
    return { statusCode: 500, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  // Honeypot: real visitors never fill this in (hidden via CSS, same
  // pattern as contact-us.html). A filled-in value means a bot — pretend
  // success and do nothing further.
  if (payload.botField) {
    return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  const sideName = (payload.sideName || '').trim();
  const message = (payload.message || '').trim();

  if (!email || !email.includes('@') || !sideName || sideName.length > 200 || message.length > 500) {
    return { statusCode: 400, body: 'Missing or invalid fields' };
  }

  const lookupRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,banned`
  );
  if (!lookupRes.ok) {
    console.error('Supabase lookup error', await lookupRes.text());
    return { statusCode: 502, body: 'Database error' };
  }
  const existing = (await lookupRes.json())[0];

  // Banned: silently drop. Always report success to the caller regardless.
  if (existing && existing.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
  }

  // Already registered (pending or verified): don't create a duplicate
  // row or spam the webmaster a second time.
  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-registered' }) };
  }

  const insertRes = await supabaseRequest('bag_man', {
    method: 'POST',
    body: JSON.stringify({ side_name: sideName, email, verified: false }),
  });
  if (!insertRes.ok) {
    console.error('Supabase insert error', await insertRes.text());
    return { statusCode: 502, body: 'Database error' };
  }

  const sendEmail = (body) =>
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

  await sendEmail({
    sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
    to: [{ email: WEBMASTER_EMAIL }],
    replyTo: { email },
    subject: `New bag-man registration: ${sideName}`,
    textContent:
      `Side: ${sideName}\nEmail: ${email}\n\nMessage:\n${message}\n\n` +
      `To approve, open admin-approve-bagman.html, enter the admin secret and this email address.`,
  });

  await sendEmail({
    sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
    to: [{ email }],
    subject: 'Your registration has been received',
    textContent:
      `Thanks for registering as a bag-man for ${sideName}. This site is run by ` +
      `volunteers, so please bear with us while your details are checked — you'll ` +
      `receive a verification email once approved.`,
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
};
