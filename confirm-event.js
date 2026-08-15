const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('confirm-status');

if (!token) {
  statusEl.textContent = 'Missing confirmation link — please use the link from your email. ' +
        'Remember to check your spam/junk folder — the confirmation email comes from wheretoseemorrisdancing.admin, sent via Brevo.';
} else {
  fetch(`/.netlify/functions/confirm-event?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'confirmed') {
        statusEl.innerHTML =
          'Your event is now live! Check it out on the <a href="find-events.html">map and calendar</a>.';
      } else if (data.status === 'event-gone') {
        statusEl.textContent = 'This event no longer exists — it may have been deleted since you submitted these changes.';
      } else if (data.status === 'invalid-or-expired') {
        statusEl.innerHTML =
          'This link has expired or already been used. Please go back to <a href="add-events.html">Add events</a> ' +
          'and submit again, or use "Manage my existing events" for a fresh link. ' +
          'Remember to check your spam/junk folder — the confirmation email comes from wheretoseemorrisdancing.admin, sent via Brevo.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
