document.getElementById('strike-off-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('strike-off-status');
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/.netlify/functions/request-strike-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminSecret: document.getElementById('admin-secret').value,
        email: document.getElementById('target-email').value.trim(),
      }),
    });
    if (res.status === 403) {
      status.textContent = 'Incorrect admin secret.';
      return;
    }
    const data = await res.json();
    status.textContent = {
      sent: 'Summary + confirmation link emailed to the webmaster address.',
      'not-found': 'No bag-man found for that email.',
    }[data.status] || 'Something went wrong.';
  } catch {
    status.textContent = 'Something went wrong — please try again.';
  }
});
