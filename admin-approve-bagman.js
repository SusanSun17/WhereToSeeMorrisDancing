document.getElementById('approve-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('approve-status');
  status.textContent = 'Sending…';

  try {
    const res = await fetch('/.netlify/functions/approve-bagman-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminSecret: document.getElementById('admin-secret').value,
        email: document.getElementById('applicant-email').value.trim(),
      }),
    });

    if (res.status === 403) {
      status.textContent = 'Incorrect admin secret.';
      return;
    }
    const data = await res.json();
    status.textContent = {
      sent: 'Verification email sent.',
      'not-found': 'No registration found for that email.',
      'already-verified': 'That bag-man is already verified.',
      banned: 'That email is banned and cannot be approved.',
    }[data.status] || 'Something went wrong.';
  } catch {
    status.textContent = 'Something went wrong — please try again.';
  }
});
