const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('confirm-status');

if (!token) {
  statusEl.textContent = 'Missing confirmation link — please use the link from your email.';
} else {
  fetch(`/.netlify/functions/confirm-bagman-registration?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'confirmed') {
        statusEl.innerHTML =
          'You\'re verified! Head back to <a href="add-events.html">Add events</a> to submit your side\'s first event.';
      } else if (data.status === 'invalid-or-expired') {
        statusEl.innerHTML =
          'This link has expired or already been used. Please <a href="contact-us.html">contact us</a> ' +
          'and we\'ll send you a new one, or head back to <a href="add-events.html">Add events</a> if you haven\'t registered yet. ' +
          'Remember to check your spam/junk folder — the verification email will come from wheretoseemorrisdancing.admin, sent via Brevo.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
