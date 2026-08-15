// Triggered by a Netlify Forms "outgoing webhook" notification (set up in
// Step 11) every time someone submits the Contact form. Sends two emails via
// Brevo: one to the webmaster (reply-to set to the sender, so you can just
// hit "reply"), and a short acknowledgement back to the sender.
const { checkAndBumpRateLimit } = require('./_supabase');
const { verifyTurnstile } = require('./_turnstile');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;

  if (!BREVO_API_KEY || !WEBMASTER_EMAIL) {
    console.error('Missing BREVO_API_KEY or WEBMASTER_EMAIL environment variable');
    return { statusCode: 500, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  // Netlify's outgoing webhook wraps the submitted fields under payload.data.
  const senderEmail = payload?.data?.email;
  const message = payload?.data?.message;

  if (!senderEmail || !message) {
    return { statusCode: 400, body: 'Missing email or message' };
  }

  // Silent no-ops below — don't tell a bot which check it failed.
  if (!(await verifyTurnstile(payload?.data?.['cf-turnstile-response']))) {
    return { statusCode: 200, body: 'OK' };
  }
  if (!(await checkAndBumpRateLimit(senderEmail, 2 * 60 * 1000))) {
    return { statusCode: 200, body: 'OK' };
  }

  // WEBMASTER_EMAIL doubles as the Brevo "sender" identity — it must be the
  // address verified as a sender in Brevo (Step 5), otherwise sends fail.
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

  try {
    const webmasterResult = await sendEmail({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email: WEBMASTER_EMAIL }],
      replyTo: { email: senderEmail },
      subject: 'New contact form message',
      textContent: `From: ${senderEmail}\n\n${message}`,
    });

    const senderResult = await sendEmail({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email: senderEmail }],
      subject: "We've received your message",
      textContent: `Thanks for getting in touch with Where to See Morris Dancing. This site is run by volunteers, so please bear with us — we'll get back to you as soon as we can.\n\nFor your records, here's a copy of your message:\n\n${message}`,
    });

    if (!webmasterResult.ok || !senderResult.ok) {
      console.error('Brevo error', await webmasterResult.text(), await senderResult.text());
      return { statusCode: 502, body: 'Failed to send one or both emails' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error sending emails', err);
    return { statusCode: 500, body: 'Error sending emails' };
  }
};
