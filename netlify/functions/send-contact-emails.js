exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;

  if (!RESEND_API_KEY || !WEBMASTER_EMAIL) {
    console.error('Missing RESEND_API_KEY or WEBMASTER_EMAIL environment variable');
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

  const sendEmail = (body) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  try {
    const webmasterResult = await sendEmail({
      from: 'Where to See Morris Dancing <onboarding@resend.dev>',
      to: WEBMASTER_EMAIL,
      reply_to: senderEmail,
      subject: 'New contact form message',
      text: `From: ${senderEmail}\n\n${message}`,
    });

    const senderResult = await sendEmail({
      from: 'Where to See Morris Dancing <onboarding@resend.dev>',
      to: senderEmail,
      subject: "We've received your message",
      text: 'Thanks for getting in touch with Where to See Morris Dancing. This site is run by volunteers, so please bear with us — we\'ll get back to you as soon as we can.',
    });

    if (!webmasterResult.ok || !senderResult.ok) {
      console.error('Resend error', await webmasterResult.text(), await senderResult.text());
      return { statusCode: 502, body: 'Failed to send one or both emails' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error sending emails', err);
    return { statusCode: 500, body: 'Error sending emails' };
  }
};
