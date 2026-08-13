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
      emailCheckSection.hidden = true;
      verifiedSection.hidden = false;
    } else if (data.status === 'pending') {
      emailCheckMessage.textContent =
        "You're already registered and awaiting approval — you'll receive a verification email once a volunteer has checked your details.";
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
        "Thanks — your registration has been forwarded to a volunteer for checking. You'll hear back by email.";
    }
  } catch (err) {
    console.error('submit-bagman-registration network error', err);
    registrationMessageStatus.textContent = 'Something went wrong — please try again.';
  }
});
