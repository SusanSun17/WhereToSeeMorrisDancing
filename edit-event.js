const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const statusEl = document.getElementById('edit-event-status');
const container = document.getElementById('event-form-container');

if (!token) {
  statusEl.textContent = 'Missing edit link — please use the link from your email. ' +
        'Remember to check your spam/junk folder — the confirmation email comes from wheretoseemorrisdancing.admin, sent via Brevo.';
} else {
  fetch(`/.netlify/functions/get-event-for-edit?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'ok') {
        statusEl.textContent = '';
        renderEventForm(container, {
          bagManEmail: data.email,
          existingEvent: { ...data, accessToken: token },
        });
      } else if (data.status === 'event-gone') {
        statusEl.textContent = 'This event no longer exists — it may have already been deleted.';
      } else if (data.status === 'invalid-or-expired') {
        statusEl.innerHTML =
          'This link has expired or already been used. Please go back to <a href="add-events.html">Add events</a> ' +
          'and use "Manage my existing events" for a fresh link.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
