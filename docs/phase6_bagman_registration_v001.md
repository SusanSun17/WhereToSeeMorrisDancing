# Phase 6 – Bag-man Registration & Verification

This document expands **Phase 6** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps, continuing on from [phase5_calendar_view_v001.md](phase5_calendar_view_v001.md). It replaces the "under construction" placeholder in `add-events.html` with the real **"enter your email"** check ([plan §6.2](plan_v001.md#62-morris-bag-man) point 1–2), the **registration form** for unrecognised emails, the **webmaster vetting step**, and the **verification email** with a single-use, expiring link that adds a bag-man to the internal verified list. It also implements the **`banned` check** ([plan §9.10](plan_v001.md#910-webmaster-strike-off-banning-a-bag-man-for-misuse)), so a struck-off email is silently refused rather than being offered registration.

**One correction to the plan's wording**: [plan_v001.md item 6](plan_v001.md#12-phased-implementation-plan) says "the Resend verification email" — that's leftover wording from before [§9.5](plan_v001.md#95-resend-vs-brevo) reversed the decision to Brevo. Every email in this phase (and every phase since Phase 3) is sent via **Brevo**, exactly like the existing `send-contact-emails.js` function.

Event submission/editing itself (the actual "Submit a new event" / "Manage my existing events" screens) is **Phase 7**, not this phase. By the end of Phase 6, a bag-man can get from "typing their email" all the way to "verified", but the verified outcome is a placeholder screen until Phase 7 builds the real event form.

## A note on cost

Still free, no new paid services:

- No new Supabase tables — `bag_man` and `verification_token` already exist from [Phase 2](phase2_database_v001.md), unchanged.
- No new Brevo cost — same free-tier sender/API key as Phase 3, just more emails sent through it.
- Two new **Netlify environment variables** (a Supabase secret key, and an admin secret) — both free, just configuration.
- The new admin approval page is a second unlisted page in the same style as the strike-off page planned for Phase 8 — no new hosting cost, and (see Step 6) the **same** admin secret variable is reused for both, rather than creating a new secret per admin feature.

## Goal / Definition of Done

By the end of this phase you will have:

- `add-events.html` asking for an email address first, and branching three ways: **verified** (placeholder — "event submission arrives in Phase 7"), **pending** (already registered, awaiting webmaster vetting), or **unrecognised** (shown the registration form) — with a **banned** bag-man deliberately indistinguishable from "unrecognised" ([plan §9.10](plan_v001.md#910-webmaster-strike-off-banning-a-bag-man-for-misuse)).
- A registration form (side name, email, short message, honeypot field) that emails the webmaster the applicant's details for offline vetting, and silently drops the request with no email sent to anyone if the email is already `banned`.
- An unlisted, admin-secret-protected page (`admin-approve-bagman.html`) the webmaster uses to approve a pending applicant, which sends the applicant a single-use, expiring **verification email**.
- A confirmation landing page (`confirm-registration.html`) that a bag-man reaches by clicking their verification email link, which marks their `bag_man` row `verified = true` and invites them back to Add events.
- Four new Netlify Functions, all talking to Supabase via a **secret key** that bypasses Row-Level Security — never the publishable key used by the browser — and a small shared helper file so they all do this the same way.
- Two new environment variables in Netlify (a Supabase secret key, an admin secret), alongside the existing `BREVO_API_KEY` / `WEBMASTER_EMAIL` from Phase 3.
- Confirmation that the whole loop works end-to-end on the live deployed site: register → webmaster approves → bag-man confirms → email now shows as verified.

## Quick concepts (skip if familiar)

- **Why the browser never talks to `bag_man` directly**: Phase 2's Row-Level Security policies deliberately grant the public **no** access at all to `bag_man` — not even read access — so the browser can't be trusted to check "is this email verified?" itself. Instead, every check in this phase goes through a **Netlify Function** (server-side code), which uses Supabase's **secret key** (the old `service_role` equivalent) to read/write `bag_man` and `verification_token` directly, bypassing RLS entirely. This key must never appear in any file served to the browser, only as a Netlify environment variable read inside function code.
- **Why raw `fetch` calls to Supabase's REST API, not the `supabase-js` library, inside functions**: exactly as Phase 3 noted for Brevo, this project has no `package.json`/npm install step and deliberately avoids one — Netlify builds straight from the repo with nothing to bundle. Supabase's REST endpoint (PostgREST, the same thing `supabase-js` calls under the hood) is just plain HTTP, so a `fetch` call with the secret key in the headers does the same job with zero dependencies, matching the pattern already used for Brevo.
- **Two separate approvals, not one**: a bag-man only becomes `verified` after **two** independent steps both happen — the webmaster vetting them offline (proves they're a genuine bag-man), *and* that same bag-man clicking a link sent to their own registered inbox (proves the email address itself is really theirs, catching typos or the webmaster mis-reading a submitted address). Neither step alone is enough.
- **Why "banned" and "unrecognised" must look identical**: per [§9.10](plan_v001.md#910-webmaster-strike-off-banning-a-bag-man-for-misuse), a struck-off individual retrying with the same email should see the ordinary registration form, not a "you are banned" message — this avoids inviting argument/harassment and doesn't confirm to a bad actor which address triggered the ban. The **registration submission** handler is where banned emails are actually, silently, dropped — one step later than the initial email check.
- **The admin secret is a header/body value, never a URL query string**: query strings end up in browser history and server access logs. Both admin actions in this project (approving a bag-man here, and striking one off in Phase 8) send the secret in a POST body instead, and both reuse the **same** `ADMIN_SECRET` environment variable — one secret for the webmaster to remember and protect, not one per feature.
- **Constant-time comparison**: when checking the admin secret, use Node's `crypto.timingSafeEqual` rather than `===`. A plain string comparison exits as soon as it finds a mismatched character, which (in principle) leaks a tiny timing signal about how many leading characters were correct — `timingSafeEqual` always takes the same time regardless. Cheap to use correctly, so there's no reason not to.

---

## Step 1 — Add two new Netlify environment variables

In the Netlify dashboard: **Project configuration → Environment variables** (same place `BREVO_API_KEY` and `WEBMASTER_EMAIL` were added in Phase 3). Netlify has an optional **"Contains secret values"** checkbox per variable, which turns on build-time secret scanning (fails the build if that exact value is later found anywhere in the published output). Only check it for values that should **never** appear in any committed/published file — get this wrong per variable below and the build will fail:

1. **`SUPABASE_URL`** — the same bare project URL already used client-side in `find-events-data.js` (e.g. `https://fdhnogpsvkfwmmshxymc.supabase.co`). Functions need their own copy since they run server-side and can't read the front-end's JS file. **Leave "Contains secret values" unchecked** — it's the same trust level as the publishable key (safe in client code, protected by RLS, not by secrecy), and it's *deliberately* hardcoded in `find-events-data.js`; checking the box makes Netlify flag that intentional occurrence as a leak and refuse to build.
2. **`SUPABASE_SECRET_KEY`** — from Supabase: **Project Settings → API Keys → Secret keys** (the key Phase 2 Step 6 told you *not* to use yet). Copy it here. **Check "Contains secret values"** — this bypasses Row-Level Security entirely and must never appear in any committed file, so scanning for it is meaningful.
3. **`ADMIN_SECRET`** — a long random string only the webmaster knows (e.g. generate one with `openssl rand -hex 32`, or any password manager's "generate password" feature — 32+ random characters). **Check "Contains secret values"**. This gates both `admin-approve-bagman.html` in this phase and the strike-off page in Phase 8. Save a copy in your password manager — Netlify won't show it again after you navigate away.
4. **`SITE_URL`** — your site's live URL with no trailing slash (e.g. `https://wheretoseemorrisdancing.netlify.app`), used to build the confirmation links that go out in emails. **Leave "Contains secret values" unchecked** — it's a public URL, not sensitive.

After saving, trigger a new deploy (Deploys tab → Trigger deploy) so the functions can see the new variables — same "settings don't apply retroactively" behaviour already seen with Netlify Forms detection in Phase 3.

> **If you already checked "Contains secret values" for `SUPABASE_URL` (or `SITE_URL`) and the build is now failing with a secrets-scanning error**: some versions of the Netlify UI don't let you uncheck that box on an existing variable. Delete the variable and re-create it with the same key/value, leaving the box unchecked this time, then trigger a fresh deploy.

## Step 2 — A shared Supabase helper for functions

Create `netlify/functions/_supabase.js`. Every function below imports this rather than repeating the same `fetch` boilerplate, so there's one place that builds requests correctly (an underscore prefix keeps Netlify from treating it as its own callable function endpoint):

```js
// Shared helper: every function in this folder that needs to read/write
// bag_man or verification_token calls supabaseRequest() from here, using
// the SECRET key (bypasses Row-Level Security). Never import this
// pattern into any browser-facing file — see docs/phase6_bagman_registration_v001.md.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function supabaseRequest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
}

module.exports = { supabaseRequest };
```

## Step 3 — The email-check function

Create `netlify/functions/check-bagman-email.js`. This is the first thing `add-events.html` calls once a bag-man types their email:

```js
// Called when a bag-man types their email on Add events (plan §6.2 point 2).
// Deliberately returns the SAME 'unrecognised' status for both "no such
// row" and "banned" — see plan §9.10 and docs/phase6_bagman_registration_v001.md.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: 'Missing or invalid email' };
  }

  const res = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=verified,banned`
  );
  if (!res.ok) {
    console.error('Supabase error', await res.text());
    return { statusCode: 502, body: 'Database error' };
  }

  const rows = await res.json();
  const bagMan = rows[0];

  if (!bagMan || bagMan.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'unrecognised' }) };
  }
  if (!bagMan.verified) {
    return { statusCode: 200, body: JSON.stringify({ status: 'pending' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ status: 'verified' }) };
};
```

(`retired` bag-men aren't handled specially here yet — retirement/handover is built in Phase 7 per [§9.9](plan_v001.md#99-bag-man-retirement--handover); no row can be `retired` until that exists.)

## Step 4 — The registration-submission function

Create `netlify/functions/submit-bagman-registration.js`. This runs when the registration form (Step 5's UI) is submitted:

```js
// Handles registration submissions from Add events (plan §6.2 point 1).
// - A banned email is silently dropped: no bag_man row is touched, no
//   email sent to anyone (plan §9.10) — the applicant sees an ordinary
//   "thanks, forwarded for vetting" message regardless, so a struck-off
//   individual gets no signal that anything different happened.
// - An already-registered (pending or verified) email isn't re-submitted
//   to the webmaster a second time.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;
  if (!BREVO_API_KEY || !WEBMASTER_EMAIL) {
    console.error('Missing BREVO_API_KEY or WEBMASTER_EMAIL');
    return { statusCode: 500, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  // Honeypot: real visitors never fill this in (hidden via CSS, same
  // pattern as contact-us.html). A filled-in value means a bot — pretend
  // success and do nothing further.
  if (payload.botField) {
    return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  const sideName = (payload.sideName || '').trim();
  const message = (payload.message || '').trim();

  if (!email || !email.includes('@') || !sideName || sideName.length > 200 || message.length > 500) {
    return { statusCode: 400, body: 'Missing or invalid fields' };
  }

  const lookupRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,banned`
  );
  if (!lookupRes.ok) {
    console.error('Supabase lookup error', await lookupRes.text());
    return { statusCode: 502, body: 'Database error' };
  }
  const existing = (await lookupRes.json())[0];

  // Banned: silently drop. Always report success to the caller regardless.
  if (existing && existing.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
  }

  // Already registered (pending or verified): don't create a duplicate
  // row or spam the webmaster a second time.
  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-registered' }) };
  }

  const insertRes = await supabaseRequest('bag_man', {
    method: 'POST',
    body: JSON.stringify({ side_name: sideName, email, verified: false }),
  });
  if (!insertRes.ok) {
    console.error('Supabase insert error', await insertRes.text());
    return { statusCode: 502, body: 'Database error' };
  }

  const sendEmail = (body) =>
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

  await sendEmail({
    sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
    to: [{ email: WEBMASTER_EMAIL }],
    replyTo: { email },
    subject: `New bag-man registration: ${sideName}`,
    textContent:
      `Side: ${sideName}\nEmail: ${email}\n\nMessage:\n${message}\n\n` +
      `To approve, open admin-approve-bagman.html, enter the admin secret and this email address.`,
  });

  await sendEmail({
    sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
    to: [{ email }],
    subject: 'Your registration has been received',
    textContent:
      `Thanks for registering as a bag-man for ${sideName}. This site is run by ` +
      `volunteers, so please bear with us while your details are checked — you'll ` +
      `receive a verification email once approved.`,
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
};
```

## Step 5 — Build the real Add events page

Create `add-events.js` and replace `add-events.html`'s body content. This handles both the email check and, if unrecognised, the registration form — mirroring the tab-switching pattern already used by `find-events-tabs.js`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add events – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Add events</h1>

    <section id="email-check-section">
      <p>Enter your registered email address to submit or manage your side's events.</p>
      <form id="email-check-form">
        <p>
          <label for="check-email">Your email address</label><br>
          <input type="email" id="check-email" name="email" required>
        </p>
        <button type="submit">Continue</button>
      </form>
      <p id="email-check-message" role="status"></p>
    </section>

    <section id="registration-section" hidden>
      <h2>Register as a bag-man</h2>
      <p>
        We don't recognise that email yet. Tell us a little about yourself below and
        we'll check it against our records — this is a manual step done by a volunteer,
        so please allow a few days.
      </p>
      <form id="registration-form">
        <input type="hidden" id="registration-email" name="email">

        <p class="honeypot-field">
          <label>Don't fill this in if you're human: <input name="bot-field" id="registration-bot-field"></label>
        </p>

        <p>
          <label for="side-name">Your Morris side's name</label><br>
          <input type="text" id="side-name" name="sideName" maxlength="200" required>
        </p>

        <p>
          <label for="registration-message">A short message (e.g. your role, how long you've danced) — max 500 characters</label><br>
          <textarea id="registration-message" name="message" maxlength="500" rows="4"></textarea>
        </p>

        <button type="submit">Submit registration</button>
      </form>
      <p id="registration-message-status" role="status"></p>
    </section>

    <section id="verified-section" hidden>
      <p>Welcome back! Submitting and managing events arrives in Phase 7 — check back soon.</p>
    </section>
  </main>
  <script src="add-events.js"></script>
</body>
</html>
```

```js
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
  } catch {
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
    const data = await res.json();

    if (data.status === 'already-registered') {
      registrationMessageStatus.textContent = 'That email is already registered — check your inbox, or wait for approval.';
    } else {
      form.hidden = true;
      registrationMessageStatus.textContent =
        "Thanks — your registration has been forwarded to a volunteer for checking. You'll hear back by email.";
    }
  } catch {
    registrationMessageStatus.textContent = 'Something went wrong — please try again.';
  }
});
```

Add the same honeypot CSS rule already in `styles.css` (from Phase 3) — no changes needed there, it already hides `.honeypot-field` regardless of which page it's on.

## Step 6 — The webmaster approval page

Create `netlify/functions/approve-bagman-registration.js`:

```js
// Unlisted, admin-secret-protected: the webmaster's one manual step per
// pending registration (plan §6.2 point 1, "the webmaster vetting step").
// The same ADMIN_SECRET also gates the Phase 8 strike-off page.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

function secretMatches(provided) {
  const expected = process.env.ADMIN_SECRET || '';
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (!secretMatches(payload.adminSecret)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;
  const SITE_URL = process.env.SITE_URL;
  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    return { statusCode: 400, body: 'Missing email' };
  }

  const lookupRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,banned`
  );
  const bagMan = (await lookupRes.json())[0];

  if (!bagMan) {
    return { statusCode: 200, body: JSON.stringify({ status: 'not-found' }) };
  }
  if (bagMan.banned) {
    return { statusCode: 200, body: JSON.stringify({ status: 'banned' }) };
  }
  if (bagMan.verified) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-verified' }) };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const tokenRes = await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({
      type: 'bagman_registration',
      token,
      related_id: bagMan.id,
      expires_at: expiresAt,
    }),
  });
  if (!tokenRes.ok) {
    console.error('Supabase token insert error', await tokenRes.text());
    return { statusCode: 502, body: 'Database error' };
  }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email }],
      subject: 'Please confirm your bag-man registration',
      textContent:
        `Thanks for registering with Where to See Morris Dancing. Please confirm ` +
        `this is really your email address by clicking the link below (valid for 48 hours):\n\n` +
        `${SITE_URL}/confirm-registration.html?token=${token}\n\n` +
        `Once confirmed, head back to Add events to submit your side's first event.`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent' }) };
};
```

Create `admin-approve-bagman.html` at the repository root — deliberately **not** linked from `nav.js`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin: approve bag-man – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <main>
    <h1>Approve a bag-man registration</h1>
    <form id="approve-form">
      <p>
        <label for="admin-secret">Admin secret</label><br>
        <input type="password" id="admin-secret" required>
      </p>
      <p>
        <label for="applicant-email">Applicant's email address</label><br>
        <input type="email" id="applicant-email" required>
      </p>
      <button type="submit">Send verification email</button>
    </form>
    <p id="approve-status" role="status"></p>
  </main>
  <script src="admin-approve-bagman.js"></script>
</body>
</html>
```

Create `admin-approve-bagman.js`:

```js
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
```

`meta name="robots" content="noindex, nofollow"` keeps search engines from indexing the page — it's not a security control by itself (the admin secret is what actually protects it), just tidiness, since the page is otherwise reachable by anyone who guesses/finds the URL.

## Step 7 — The confirmation landing page

Create `netlify/functions/confirm-bagman-registration.js`:

```js
// Reached when a bag-man clicks the link in their verification email
// (Step 6). A GET request with the token as a query parameter, matching
// how the link is a plain URL, not a form submission.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };
  }

  const tokenRes = await supabaseRequest(
    `verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_registration&select=*`
  );
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const updateBagMan = await supabaseRequest(`bag_man?id=eq.${tokenRow.related_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ verified: true }),
  });
  if (!updateBagMan.ok) {
    console.error('Supabase update error', await updateBagMan.text());
    return { statusCode: 502, body: JSON.stringify({ status: 'error' }) };
  }

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
```

Create `confirm-registration.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm registration – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Confirming your registration…</h1>
    <p id="confirm-status">Please wait.</p>
  </main>
  <script src="confirm-registration.js"></script>
</body>
</html>
```

Create `confirm-registration.js`:

```js
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
        statusEl.textContent =
          'This link has expired or already been used. Ask a volunteer to resend it via the approval step, or re-register.';
      } else {
        statusEl.textContent = 'Something went wrong — please try again later.';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Something went wrong — please try again later.';
    });
}
```

## Step 8 — Test the whole loop on the live site

Netlify Functions aren't easily testable via a plain local `python -m http.server`, so test this phase after pushing and deploying (same "push, then test on the live site" approach Phase 3 used):

1. Go to `add-events.html`, enter an email that has **no** `bag_man` row yet → confirm the registration form appears.
2. Submit the registration form → confirm you receive **two** emails: the webmaster notification (at `WEBMASTER_EMAIL`, reply-to set to the applicant) and the applicant's "received" acknowledgement.
3. Re-check the same email on `add-events.html` → confirm it now says **"awaiting approval"** rather than showing the registration form again.
4. Go to `admin-approve-bagman.html`, enter the wrong admin secret → confirm you get "Incorrect admin secret." Enter the correct secret and the applicant's email → confirm "Verification email sent."
5. Open the verification email, click the link → confirm `confirm-registration.html` shows "You're verified!"
6. Click the link a **second** time → confirm it now says the link has expired/been used (proves the single-use check works).
7. Re-check the same email on `add-events.html` a final time → confirm it now shows the **verified** placeholder screen.
8. In the Supabase Table Editor, manually set `banned = true` on a test `bag_man` row, then check that email on `add-events.html` → confirm it shows the **registration form**, identical to a genuinely unrecognised email, and that submitting it does **not** trigger a webmaster email (check the Netlify Function logs — Functions tab in Netlify — to confirm no Brevo call was made for that submission).

## Step 9 — Security review recap

- `SUPABASE_SECRET_KEY` and `ADMIN_SECRET` exist only as Netlify environment variables, never committed to Git — check `netlify/functions/_supabase.js` and the two admin-guarded functions don't hardcode them.
- The admin secret is sent as a POST body field, never a URL query string.
- `check-bagman-email.js` returns the same `unrecognised` status for "no row" and "banned" — never a distinct status that would let someone probe which emails are banned.
- `submit-bagman-registration.js` checks `banned` **before** doing anything else, and returns the same success-looking response either way.
- No email address is ever returned to the browser in any of these responses — only a status string.

## Checklist — Phase 6 Definition of Done

- [ ] `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_SECRET`, `SITE_URL` added as Netlify environment variables, and a fresh deploy triggered.
- [ ] `netlify/functions/_supabase.js` shared helper created.
- [ ] `check-bagman-email.js`, `submit-bagman-registration.js`, `approve-bagman-registration.js`, `confirm-bagman-registration.js` all created and deployed.
- [ ] `add-events.html` + `add-events.js` rebuilt with the email-check gate and registration form.
- [ ] `admin-approve-bagman.html` + `admin-approve-bagman.js` created, unlisted from `nav.js`.
- [ ] `confirm-registration.html` + `confirm-registration.js` created.
- [ ] All eight checks in Step 8 pass on the live deployed site, including the banned-email and expired-token cases.
- [ ] Step 9's security recap re-checked against the actual committed code.

Phase 6 is complete once a real bag-man can register, be vetted, confirm their own email, and see themselves recognised as verified on return. Phase 7 (event submission & editing) will be expanded into its own document once this phase is confirmed working — it builds the real screens behind today's "verified" and "pending" placeholders.
