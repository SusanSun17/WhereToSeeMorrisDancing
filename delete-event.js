const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('delete-status');

if (!token) {
  statusEl.textContent = 'Missing confirmation link — please use the link from your email. ' +
        'Remember to check your spam/junk folder — the confirmation email comes from wheretoseemorrisdancing.admin, sent via Brevo.';
} else {
  fetch(`/.netlify/functions/confirm-event-delete?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'deleted') {
        statusEl.textContent = 'This event has been permanently deleted.';
      } else if (data.status === 'already-gone') {
        statusEl.textContent = 'This event has already been deleted.';
      } else if (data.status === 'invalid-or-expired') {
        statusEl.innerHTML =
          'This link has expired or already been used. Please go back to <a href="add-events.html">Add events</a> ' +
          'and use "Manage my existing events" for a fresh delete link.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
