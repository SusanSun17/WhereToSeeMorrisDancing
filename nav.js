// Shared navigation bar, injected into every page.
// To change a link (add/remove/rename a page), edit it here ONCE —
// every page that includes this script picks up the change automatically.
document.getElementById('site-nav').innerHTML = `
  <a href="index.html">Home</a>
  <a href="find-events.html">Find events</a>
  <a href="add-events.html">Add events</a>
  <a href="links.html">Links</a>
  <a href="contact-us.html">Contact us</a>
`;

// Cloudflare Web Analytics (plan §10) — free, cookie-less, no DNS change
// needed. Loaded here (not per-page) so every page is tracked from one
// place, same reasoning as the nav links above.
const analyticsScript = document.createElement('script');
analyticsScript.type = 'module';
analyticsScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
analyticsScript.setAttribute('data-cf-beacon', '{"token": "c9f8953f06b54efcbca6ce5dfd20c0a3"}');
document.head.appendChild(analyticsScript);

