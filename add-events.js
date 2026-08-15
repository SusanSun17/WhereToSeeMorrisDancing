// add-events.js — the "enter your email" gate on Add events (plan §6.2).
const emailCheckSection = document.getElementById('email-check-section');
const registrationSection = document.getElementById('registration-section');
const verifiedSection = document.getElementById('verified-section');
const emailCheckMessage = document.getElementById('email-check-message');
const registrationMessageStatus = document.getElementById('registration-message-status');

document.getElementById('email-check-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('check-email').value.trim();
  emailCheckMessage.textContent = 'Checking…';

  try {
    const res = await fetch('/.netlify/functions/check-bagman-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      console.error('check-bagman-email failed', res.status, await res.text());
      emailCheckMessage.textContent = 'Something went wrong — please try again.';
      return;
    }
    const data = await res.json();

    if (data.status === 'verified') {
      emailCheckMessage.textContent = '';
      checkedEmail = email;
      emailCheckSection.hidden = true;
      verifiedSection.hidden = false;
    } else if (data.status === 'pending') {
      emailCheckMessage.textContent =
        "You're already registered and awaiting approval — you'll receive a verification email once a volunteer has checked your details. " +
        "That email comes from wheretoseemorrisdancing.admin, sent via Brevo — if it doesn't turn up in your inbox, please check your spam/junk folder.";
    } else {
      emailCheckMessage.textContent = '';
      document.getElementById('registration-email').value = email;
      emailCheckSection.hidden = true;
      registrationSection.hidden = false;
    }
  } catch (err) {
    console.error('check-bagman-email network error', err);
    emailCheckMessage.textContent = 'Something went wrong — please try again.';
  }
});

document.getElementById('registration-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  registrationMessageStatus.textContent = 'Submitting…';

  try {
    const res = await fetch('/.netlify/functions/submit-bagman-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('registration-email').value,
        sideName: document.getElementById('side-name').value.trim(),
        message: document.getElementById('registration-message').value.trim(),
        botField: document.getElementById('registration-bot-field').value,
      }),
    });
    if (!res.ok) {
      console.error('submit-bagman-registration failed', res.status, await res.text());
      registrationMessageStatus.textContent = 'Something went wrong — please try again.';
      return;
    }
    const data = await res.json();

    if (data.status === 'already-registered') {
      registrationMessageStatus.textContent = 'That email is already registered — check your inbox, or wait for approval.';
    } else {
      form.hidden = true;
      registrationMessageStatus.textContent =
        "Thanks — your registration has been forwarded to a volunteer for checking. You'll hear back by email, and once approved you'll " +
        "receive a verification email from wheretoseemorrisdancing.admin, sent via Brevo — if it doesn't turn up in your inbox, please check your spam/junk folder.";
    }
  } catch (err) {
    console.error('submit-bagman-registration network error', err);
    registrationMessageStatus.textContent = 'Something went wrong — please try again.';
  }
});

// Added to add-events.js after the existing email-check logic.
let checkedEmail = null; // set below when status === 'verified'

document.getElementById('show-new-event-btn').addEventListener('click', () => {
  document.getElementById('manage-events-section').hidden = true;
  document.getElementById('retire-section').hidden = true;
  renderEventForm(document.getElementById('event-form-section'), { bagManEmail: checkedEmail });
});

document.getElementById('show-manage-events-btn').addEventListener('click', () => {
  document.getElementById('event-form-section').hidden = true;
  document.getElementById('retire-section').hidden = true;
  document.getElementById('manage-events-section').hidden = false;
});

document.getElementById('show-retire-btn').addEventListener('click', () => {
  document.getElementById('event-form-section').hidden = true;
  document.getElementById('manage-events-section').hidden = true;
  document.getElementById('retire-section').hidden = false;
});

document.getElementById('request-manage-events-btn').addEventListener('click', async () => {
  const status = document.getElementById('manage-events-status');
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/.netlify/functions/request-manage-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: checkedEmail }),
    });
    const data = await res.json();
    status.textContent = data.status === 'rate-limited'
      ? 'Please wait a few minutes before requesting this again.'
      : 'If that email is registered, check your inbox shortly.';
  } catch (err) {
    console.error('request-manage-events network error', err);
    status.textContent = 'Something went wrong — please try again.';
  }
});

document.getElementById('retire-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('retire-status');
  const successorEmail = document.getElementById('successor-email').value.trim();
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/.netlify/functions/request-bagman-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: checkedEmail, successorEmail }),
    });
    const data = await res.json();
    if (data.status === 'requested') {
      status.textContent = 'Check your email — the handover completes once you and your successor have both confirmed.';
    } else if (data.status === 'validation-error') {
      status.textContent = data.message || 'Please check the successor\'s email and try again.';
    } else {
      status.textContent = 'Something went wrong — please try again.';
    }
  } catch (err) {
    console.error('request-bagman-transfer network error', err);
    status.textContent = 'Something went wrong — please try again.';
  }
});