const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('confirm-status');

if (!token) {
  statusEl.textContent = 'Missing confirmation link.';
} else {
  fetch(`/.netlify/functions/confirm-strike-off?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      statusEl.textContent = {
        confirmed: 'Done — their events have been deleted and the email address is now banned.',
        'invalid-or-expired': 'This link has expired or already been used.',
      }[data.status] || 'Something went wrong — please try again later.';
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
