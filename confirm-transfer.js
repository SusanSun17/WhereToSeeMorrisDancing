const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('confirm-status');

if (!token) {
  statusEl.textContent = 'Missing confirmation link — please use the link from your email. ' +
          'Remember to check your spam/junk folder — the confirmation email comes from wheretoseemorrisdancing.admin, sent via Brevo.';
} else {
  fetch(`/.netlify/functions/confirm-bagman-transfer?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'transfer-complete') {
        statusEl.textContent = 'The handover is complete — thanks for confirming!';
      } else if (data.status === 'waiting-for-other-party') {
        statusEl.textContent = "Thanks — we're waiting for the other person to confirm too. You'll receive an email once the handover is complete.";
      } else if (data.status === 'already-completed') {
        statusEl.textContent = 'This handover has already been completed.';
      } else if (data.status === 'invalid-or-expired') {
        statusEl.innerHTML =
          'This link has expired or already been used. Please go back to <a href="add-events.html">Add events</a> ' +
          'and send a new handover request if needed.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
