# Phase 8 – Security Hardening

This document expands **Phase 8** from [plan_v001.md](plan_v001.md) (§12 point 8) into exact steps, continuing on from [phase7_event_submission_v001.md](phase7_event_submission_v001.md). It covers: rate limiting + CAPTCHA on the two remaining unprotected public forms (Contact us, bag-man registration), a Row-Level-Security/GRANTs audit, a secrets audit, and the webmaster-only **strike-off** admin page ([plan §9.10](plan_v001.md#910-webmaster-strike-off-banning-a-bag-man-for-misuse)).

## Read this first — you have ~135 Netlify credits left

Every deploy currently costs you ~15 credits, so you have roughly **9 deploys left** before you need to sort out billing. That changes how this phase should be done compared to Phase 7 (where you tested step-by-step, live, after each change):

- **Do all of Steps 1–3 and 6 locally first**, using `netlify dev` (runs your functions and redirects on `localhost` — free, no deploy involved) before pushing anything. Only push once a whole step is working locally.
- **Batch commits into as few deploys as possible.** Suggested grouping:
  - **Deploy A** — Steps 1–3 (SQL migration + rate limiting + Turnstile CAPTCHA + validation review) in one push.
  - **Deploy B** — Step 6 (strike-off admin page + functions) in one push.
  - Steps 4–5 (RLS/GRANTs audit, secrets audit) are **read-only checks** — done in the Supabase SQL editor and your repo/Netlify dashboard. They cost no deploys at all unless they turn something up that needs fixing, in which case fold the fix into whichever of Deploy A/B hasn't gone out yet.
- That's 2 deploys for this whole phase instead of 6+, leaving you ~7 in reserve afterwards.
- Worth 2 minutes before doing anything: open Netlify's **Team/Site → Usage** page to confirm it really is "deploys" (build minutes) eating the credits and not something else (e.g. function invocations, bandwidth) — that confirms batching deploys is the right lever, rather than guessing.
- Longer term, if 9 deploys won't comfortably cover this phase plus the rest of the plan (Phases 9–10), it's worth checking Netlify's current usage-based pricing page for what a small top-up or the next plan tier costs — cheaper than repeatedly running close to zero credits.

## A note on cost

No new paid services. One new tiny Supabase table (free, same tier). Cloudflare Turnstile is free with no request limit that a volunteer site will hit.

## Goal / Definition of Done

- Contact form and bag-man registration form both have a Cloudflare Turnstile CAPTCHA widget, verified server-side before any email is sent.
- Both forms also have a per-email rate limit (a repeat submission from the same address within a cooldown window is silently dropped), matching the pattern already used for "Manage my existing events" in Phase 7.
- A quick audit confirms server-side input validation is consistent across all Netlify Functions, and that Supabase's RLS policies + table GRANTs match the least-privilege rule in [plan §8](plan_v001.md#8-security-considerations).
- A repo-wide check confirms no secrets are hardcoded or committed.
- A new unlisted `admin-strike-off.html` page lets the webmaster ban a bag-man for misuse (§9.10): request → webmaster confirms by email → cascading hard-delete of their events + ban flag set, gated by the same `ADMIN_SECRET` already used by `admin-approve-bagman.html`.

## Step 1 — Schema: one small table for anonymous-form rate limiting

The existing rate-limit pattern (`bag_man.last_manage_request_at`, from Phase 7) only works for people who already have a `bag_man` row. The Contact form and the registration form are filled in by people who may not — so a small standalone table is needed instead:

```sql
-- Rate-limits the Contact form and bag-man registration form (plan §8),
-- keyed by the submitted email address rather than an existing bag_man
-- row, since senders here may not be registered bag-men at all.
create table contact_rate_limit (
  email text primary key,
  last_submitted_at timestamptz not null default now()
);

-- Server-side functions use the SECRET key (bypasses RLS) via the same
-- supabaseRequest() helper as every other table — see supabase.md memory
-- re: service_role needing explicit grants even with the secret key.
grant select, insert, update on contact_rate_limit to service_role;
```

Run this once in Supabase's SQL editor — no deploy needed for this step.

## Step 2 — Shared helpers: rate limiting + Turnstile verification

Add a rate-limit helper to `netlify/functions/_supabase.js`:

```js
// Shared per-email cooldown check for anonymous public forms (Contact
// us, bag-man registration) that have no bag_man row to hang a timestamp
// off — see contact_rate_limit table, Phase 8. Returns false (and does
// NOT update the timestamp) if still within the cooldown.
async function checkAndBumpRateLimit(email, minMs) {
  const res = await supabaseRequest(
    `contact_rate_limit?email=eq.${encodeURIComponent(email)}&select=last_submitted_at`
  );
  const row = (await res.json())[0];
  const now = new Date();
  if (row && now.getTime() - new Date(row.last_submitted_at).getTime() < minMs) {
    return false;
  }
  await supabaseRequest('contact_rate_limit?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ email, last_submitted_at: now.toISOString() }),
  });
  return true;
}

module.exports = { supabaseRequest, checkAndBumpRateLimit };
```

Create `netlify/functions/_turnstile.js`:

```js
// Verifies a Cloudflare Turnstile token server-side — the widget running
// in the browser proves nothing on its own, since a bot can just skip
// calling it and post straight to the endpoint. TURNSTILE_SITE_KEY is
// NOT secret (it's meant to ship to the browser); only
// TURNSTILE_SECRET_KEY is a real secret, kept server-side only.
async function verifyTurnstile(token) {
  if (!token) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('Missing TURNSTILE_SECRET_KEY');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('Turnstile verification error', err);
    return false;
  }
}

module.exports = { verifyTurnstile };
```

Sign up for a free Cloudflare account → Turnstile → add a widget for your site domain → note the **Site Key** (public) and **Secret Key**. Add `TURNSTILE_SECRET_KEY` as a Netlify environment variable (check "contains secret value" — see netlify.md memory), and hardcode the Site Key directly in the two HTML pages below (it's designed to be public).

## Step 3 — Wire CAPTCHA + rate limiting into both forms

**`contact-us.html`** — add the widget inside the existing Netlify Forms `<form>`, and the script tag once in `<head>`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

```html
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY_HERE"></div>
```

The rendered widget adds its own hidden `cf-turnstile-response` input, which Netlify Forms captures like any other field and passes through to the outgoing webhook as `payload.data['cf-turnstile-response']`.

**`netlify/functions/send-contact-emails.js`** — verify before sending either email:

```js
const { checkAndBumpRateLimit } = require('./_supabase');
const { verifyTurnstile } = require('./_turnstile');
// ...inside the handler, after extracting senderEmail/message:

const turnstileOk = await verifyTurnstile(payload?.data?.['cf-turnstile-response']);
if (!turnstileOk) {
  // Silent no-op — don't tell a bot which check it failed.
  return { statusCode: 200, body: 'OK' };
}

const allowed = await checkAndBumpRateLimit(senderEmail, 2 * 60 * 1000);
if (!allowed) {
  return { statusCode: 200, body: 'OK' };
}
```

**`add-events.html`** — same widget markup inside `#registration-form`, plus the script tag in `<head>` (shared with the page if not already present).

**`add-events.js`** — read the token and include it in the POST body:

```js
body: JSON.stringify({
  email: document.getElementById('registration-email').value,
  sideName: document.getElementById('side-name').value.trim(),
  message: document.getElementById('registration-message').value.trim(),
  botField: document.getElementById('registration-bot-field').value,
  turnstileToken: turnstile.getResponse(),
}),
```

**`netlify/functions/submit-bagman-registration.js`** — verify + rate-limit right after the honeypot check:

```js
const { verifyTurnstile } = require('./_turnstile');
const { supabaseRequest, checkAndBumpRateLimit } = require('./_supabase');
// ...after the existing `if (payload.botField) { ... }` block:

if (!(await verifyTurnstile(payload.turnstileToken))) {
  return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
}
if (!(await checkAndBumpRateLimit(email, 2 * 60 * 1000))) {
  return { statusCode: 200, body: JSON.stringify({ status: 'submitted' }) };
}
```

Both failure paths report the same generic success-looking status as a real submission — same "don't reveal what tripped it" principle already used for `banned` in this file.

## Step 4 — RLS + GRANTs audit (no deploy needed)

In Supabase's SQL editor, run:

```sql
select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public';
select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' order by table_name, grantee;
```

Confirm, per [plan §8](plan_v001.md#8-security-considerations):

- Every table has `rowsecurity = true`.
- `anon` has **no** grants on `bag_man` or `verification_token` at all (never even readable).
- `anon`/`authenticated` have at most `select` on `event` and `location` (what the public map/calendar query needs) — no `insert`/`update`/`delete`.
- `service_role` has the grants every function actually uses (per the `supabase.md` memory gotcha: `service_role` bypasses RLS but **not** plain GRANTs) — including the new `contact_rate_limit` table from Step 1.

Fix anything that doesn't match with a one-off `grant`/`revoke` statement — no code or deploy involved.

## Step 5 — Secrets audit (no deploy needed)

- Search the repo for anything that looks like a live key (PowerShell — `|` needs no escaping in .NET regex, unlike Unix `grep`'s basic regex mode):

  ```powershell
  Get-ChildItem -Recurse -Include *.js,*.html | Select-String -Pattern "sk_|SUPABASE_SECRET|BREVO_API_KEY|ADMIN_SECRET|TURNSTILE_SECRET" | Where-Object { $_.Path -notmatch '\\node_modules\\' }
  ```

  every match should be `process.env.X`, never a literal value.
- Confirm `.env`-style files (if any exist locally for `netlify dev`) are in `.gitignore` and were never committed.
- In Netlify's dashboard (Environment variables), confirm `SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `ADMIN_SECRET`, and `TURNSTILE_SECRET_KEY` are all marked **"Contains secret values"**, and that only genuinely public values (e.g. `SUPABASE_URL`, `SITE_URL`) are left unchecked — see the netlify.md memory note on why checking the wrong ones breaks builds and leaving secret ones unchecked risks a scan miss.

## Step 6 — Webmaster strike-off (§9.10)

`bag_man.banned` and the `bagman_strike_off` token type already exist (from Phase 2's schema and Phase 6/7's consumer-side checks in `check-bagman-email.js` / `submit-bagman-registration.js`) — this step only adds the **trigger** for it: a new unlisted admin page and two functions, mirroring `admin-approve-bagman.html` / `confirm-bagman-registration.js` exactly.

**`admin-strike-off.html`** (new, unlisted — not linked from `nav.js`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin: strike off a bag-man – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <main>
    <h1>Strike off a bag-man</h1>
    <p>This permanently deletes every event they own and bans their email from re-registering. Cannot be undone.</p>
    <form id="strike-off-form">
      <p>
        <label for="admin-secret">Admin secret</label><br>
        <input type="password" id="admin-secret" required>
      </p>
      <p>
        <label for="target-email">Bag-man's email address</label><br>
        <input type="email" id="target-email" required>
      </p>
      <button type="submit">Email me a summary + confirmation link</button>
    </form>
    <p id="strike-off-status" role="status"></p>
  </main>
  <script src="admin-strike-off.js"></script>
</body>
</html>
```

**`admin-strike-off.js`** (new, project root):

```js
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
```

**`netlify/functions/request-strike-off.js`** (new — mirrors `approve-bagman-registration.js`'s secret check):

```js
// Webmaster-only, admin-secret-protected (plan §9.10). Emails a
// last-chance "are you sure, here's what will be deleted" summary to the
// WEBMASTER's own address, never the bag-man's — never a two-sided
// confirmation like retirement (§9.9), since this is deliberately
// one-sided.
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

  const bagManRes = await supabaseRequest(
    `bag_man?email=eq.${encodeURIComponent(email)}&select=id,side_name,email`
  );
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan) {
    return { statusCode: 200, body: JSON.stringify({ status: 'not-found' }) };
  }

  const eventsRes = await supabaseRequest(
    `event?bag_man_id=eq.${bagMan.id}&select=id,description,morris_sides,location(address_text,date,start_time)`
  );
  const events = await eventsRes.json();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({ type: 'bagman_strike_off', token, related_id: bagMan.id, expires_at: expiresAt }),
  });

  const summary = events
    .map((ev) => `- ${ev.location?.map((l) => `${l.address_text} on ${l.date} ${l.start_time}`).join(' / ')} (${ev.morris_sides?.join(', ')})`)
    .join('\n') || '(no events)';

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: WEBMASTER_EMAIL },
      to: [{ email: WEBMASTER_EMAIL }],
      subject: `Confirm strike-off: ${bagMan.side_name} <${bagMan.email}>`,
      textContent:
        `This will PERMANENTLY delete every event below and ban ${bagMan.email} from re-registering. This cannot be undone.\n\n` +
        `Events to be deleted:\n${summary}\n\n` +
        `To confirm, click: ${SITE_URL}/confirm-strike-off.html?token=${token}\n\n` +
        `If you didn't request this, ignore this email — nothing happens until the link is clicked.`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent' }) };
};
```

**`confirm-strike-off.html`** (new, mirrors `confirm-registration.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm strike-off – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <main>
    <h1>Confirm strike-off</h1>
    <p id="confirm-status" role="status">Processing…</p>
  </main>
  <script src="confirm-strike-off.js"></script>
</body>
</html>
```

**`confirm-strike-off.js`** (new, project root — mirrors `confirm-registration.js`):

```js
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
```

**`netlify/functions/confirm-strike-off.js`** (new — GET with token, mirrors `confirm-bagman-registration.js`):

```js
// Reached when the WEBMASTER clicks the link from their own inbox
// (plan §9.10) — never sent to or clickable by the bag-man being struck
// off. Performs the whole strike-off atomically-enough for this scale:
// delete owned events (cascades location/event_co_editor), remove them
// as someone else's co-editor, cancel pending transfers, invalidate
// their other tokens, then ban.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };
  }

  const tokenRes = await supabaseRequest(
    `verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_strike_off&select=*`
  );
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const bagManId = tokenRow.related_id;

  // Cascades to location + event_co_editor for events they OWN.
  await supabaseRequest(`event?bag_man_id=eq.${bagManId}`, { method: 'DELETE' });

  // Co-editor rows on OTHER people's events — those events are untouched.
  await supabaseRequest(`event_co_editor?bag_man_id=eq.${bagManId}`, { method: 'DELETE' });

  // Pending (unfinished) retirement handovers involving them, either side.
  await supabaseRequest(
    `bag_man_transfer_request?completed_at=is.null&or=(retiring_bag_man_id.eq.${bagManId},successor_bag_man_id.eq.${bagManId})`,
    { method: 'DELETE' }
  );

  // Any other outstanding links emailed directly to them (registration,
  // retirement) become no-ops. Event-scoped tokens need no action here —
  // their events no longer exist, and confirm-event.js / confirm-event-delete.js
  // already handle a missing event gracefully (Phase 7).
  await supabaseRequest(
    `verification_token?recipient_bag_man_id=eq.${bagManId}&used_at=is.null`,
    { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) }
  );

  await supabaseRequest(`bag_man?id=eq.${bagManId}`, {
    method: 'PATCH',
    body: JSON.stringify({ banned: true }),
  });

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
```

## Testing checklist (do this locally with `netlify dev` before deploying)

1. Contact form: submit once normally (email arrives); submit again immediately with the same email → second one silently does nothing (no email sent) — confirms rate limiting.
2. Contact form: temporarily break the Turnstile token (e.g. inspect and clear the hidden field) → confirm no email is sent.
3. Registration form: same two checks (rate limit + broken Turnstile token) using an email that isn't already a `bag_man` row.
4. Run the Step 4 SQL queries and eyeball the output against the bullet list.
5. Run the Step 5 grep and dashboard check.
6. Strike-off: register a throwaway test bag-man, verify them, submit a test event for them, then run the full strike-off flow end-to-end — confirm their event disappears from the map/calendar, and that re-entering their email on Add events shows the ordinary "not recognised" registration screen (not a "banned" message).

## Completion checklist

- [ ] `contact_rate_limit` table created + granted to `service_role`.
- [ ] `checkAndBumpRateLimit` added to `_supabase.js`; `_turnstile.js` created.
- [ ] Turnstile widget + verification wired into Contact us and bag-man registration.
- [ ] RLS/GRANTs audit run, any gaps fixed.
- [ ] Secrets audit run, nothing hardcoded, Netlify env vars correctly flagged.
- [ ] `admin-strike-off.html`/`.js`, `confirm-strike-off.html`/`.js`, `request-strike-off.js`, `confirm-strike-off.js` (function) added and tested end-to-end.
- [ ] Everything above tested locally via `netlify dev`; pushed as 2 batched deploys (or fewer), per the credits note at the top of this document.

Phase 8 is complete once both remaining public forms are CAPTCHA-protected and rate-limited, the RLS/secrets audits are done, and the webmaster can strike off a bag-man end-to-end. Phase 9 (nice-to-haves) and Phase 10 (content population & soft launch) remain per [plan_v001.md](plan_v001.md#12-phased-implementation-plan).
