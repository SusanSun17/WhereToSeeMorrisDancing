# Phase 3 – Static Content Pages: Home, Links & Contact Us (Netlify Forms + Resend)

This document expands **Phase 3** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps, continuing on from [phase1_foundations_v001.md](phase1_foundations_v001.md) and [phase2_database_v001.md](phase2_database_v001.md). It still assumes no prior web design/hosting experience.

This phase has two kinds of work, and it's worth doing them in this order:

1. **Things only you can do** — create the webmaster email account, and gather the real content (Oxfordshire Morris side links, Home page wording). Steps 1–2 below.
2. **Things this guide builds with you** — the real Home and Links pages, and a working Contact form that emails the webmaster and sends the sender an acknowledgement, via a free Netlify Function calling Resend. Steps 3–13 below.

## A note on cost

Everything in this phase is free, no credit card required:

- **Resend**'s free tier (3,000 emails/month) is used for sending — plenty for a volunteer contact form and, later, verification emails.
- Resend also lets you send from its shared `onboarding@resend.dev` address **without verifying your own domain first** — perfect for this phase, since you don't have a custom domain (§10 of the plan marks that as optional). You can switch the "from" address to something like `noreply@wheretoseemorrisdancing.co.uk` later, for free, if you ever buy a domain — nothing here depends on that happening.
- **Netlify Forms**' free tier includes **100 form submissions per month** — worth knowing about, but not something a low-traffic volunteer contact form is likely to hit. If it ever does, Netlify just stops accepting new submissions until the next month rather than charging you, so there's no risk of a surprise bill.
- A free Gmail account is all you need for the webmaster mailbox.

## A correction to Phase 1's assumption about Node.js

[Phase 1](phase1_foundations_v001.md#step-2--software-nothing-left-to-install-for-this-phase) said Node.js would be needed "when the Contact form needs a Netlify Function." That's still true in spirit, but it turns out **you don't need to install Node.js on your PC at all** for this: the function code below uses only the built-in `fetch` (no npm packages to install or bundle), and Netlify runs and builds functions in the cloud when you push, the same way it already builds your static pages. Node.js is only worth installing locally if you want to test functions on your own PC before deploying (covered as an optional Step 13) — the main path in this guide is "push, then test on the live site," matching how Phases 1–2 already worked.

## Goal / Definition of Done

By the end of this phase you will have:

- A dedicated **webmaster Gmail account**, not your personal one.
- Real content on **Home** (introducing the site) and **Links** (Oxfordshire Morris sides, alphabetically, plus the Morris Federation and other useful sites).
- A real **Contact us** form: sender's email + a message (max 500 characters), protected by a honeypot field and Netlify's built-in spam filtering.
- A **Netlify Function** that, on every genuine submission, sends an email to the webmaster (with the sender's address set as reply-to) **and** a separate acknowledgement email back to the sender — both via Resend.
- A **Resend account and API key**, and a Netlify **environment variable** holding that key and the webmaster address — nothing secret committed to GitHub.

---

## Step 1 — Create the webmaster email account

Do this once, it's reused for the rest of the project (bag-man vetting emails in later phases will also come from this address):

1. Go to https://accounts.google.com/signup.
2. Create a new, impersonal address —  `wheretoseemorrisdancing.admin@gmail.com`. Don't use your personal Gmail.
3. Use a strong, unique password and save it in a password manager. Turn on 2-step verification (Google will prompt you) — this mailbox will later hold bag-man contact details, so it's worth protecting properly.
4. Note the final address down somewhere — you'll paste it into a Netlify environment variable in Step 10, and it's the address you'll personally check for contact-form messages and (in later phases) bag-man registration requests.

## Step 2 — Gather the content you'll need

You need two things before Steps 3–4 can be filled in for real, rather than left as placeholders:

**a. Home page wording.** A short paragraph or two introducing the site to a first-time visitor. A draft is provided in Step 3 below that you're welcome to use as-is, or edit to your own voice.

**b. Links page content** — an alphabetical list of Oxfordshire Morris sides' websites, plus the Morris Federation and any other useful sites (e.g. the Morris Ring, Open Morris, if relevant). Suggested approach, since I shouldn't guess specific side names or URLs on your behalf:

- Search "Morris Federation" to find their official site, which has a "find a side" map/directory you can cross-reference against Oxfordshire.
- Add any sides you or your contacts already know of directly.
- For each one, fill in a row of this table as you go (keep it somewhere handy, e.g. a new scratch note, or straight into `links.html` in Step 4):

| Side name | Town/area | Website URL |
| --- | --- | --- |
| | | |

- Double-check each URL actually loads before adding it — a dead link on the Links page is exactly the kind of small maintenance annoyance the plan is trying to avoid elsewhere.
- You don't need every side before deploying — the plan (§6.3 point 4, §12 Phase 10) already expects this list to grow over time as you do bag-man outreach. Start with whatever you have now; adding more rows to the table later is trivial.

---

## Step 3 — Build the real Home page

Replace the placeholder paragraph in `index.html` with real copy. Here's a suggested draft — edit the wording to taste, but keep the structure (heading, intro paragraph, a sentence pointing at Find events):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Where to See Morris Dancing</h1>
    <p>
      Morris sides across Oxfordshire dance out all year round — outside pubs on a
      summer evening, at village fêtes, on Boxing Day, and at festivals large and
      small. Until now, there's been nowhere to see all of it in one place: each side
      posts its own dates on its own website, if at all.
    </p>
    <p>
      This site brings Oxfordshire's Morris dancing events together on a single map
      and calendar, so you can find out what's happening near you and go and watch.
      Head to <a href="find-events.html">Find events</a> to get started, or browse
      the <a href="links.html">Links</a> page to see the sides taking part.
    </p>
    <p>
      Are you a Morris <strong>bag-man</strong>, responsible for organising your
      side's events? Go to <a href="add-events.html">Add events</a> to register and
      start submitting your side's dates.
    </p>
  </main>
</body>
</html>
```

## Step 4 — Build the Links page

Replace the placeholder in `links.html` with a real alphabetical list, using the content you gathered in Step 2b. Structure it as a list of links, Oxfordshire sides first (alphabetical), then the Morris Federation and other sites in their own section:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Links – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Links</h1>

    <h2>Oxfordshire Morris sides</h2>
    <ul>
      <li><a href="https://example-side-one.org" target="_blank" rel="noopener">Example Morris Men</a></li>
      <li><a href="https://example-side-two.org" target="_blank" rel="noopener">Example Morris Women</a></li>
      <!-- Add one <li> per side from your Step 2b table, in alphabetical order. -->
    </ul>

    <h2>Other useful sites</h2>
    <ul>
      <li><a href="https://themorrisfederation.co.uk" target="_blank" rel="noopener">The Morris Federation</a></li>
      <!-- Add any other sites you found useful, e.g. the Morris Ring, Open Morris. -->
    </ul>
  </main>
</body>
</html>
```

> Replace every placeholder `<li>` with a real one from your Step 2 table, and double-check the Morris Federation's actual current URL yourself before publishing it (search for "Morris Federation" and copy the address bar) — don't trust a hardcoded guess, including the placeholder one above, without checking it first.

`target="_blank" rel="noopener"` opens each external link in a new tab and is a small, standard security precaution (prevents the opened page from being able to control the tab it was opened from).

---

## Step 5 — Sign up for Resend and get an API key

1. Go to https://resend.com and sign up (GitHub sign-in keeps everything linked to one login, same as Netlify/Supabase).
2. You'll land on a dashboard. You do **not** need to add/verify a domain yet — skip that step for now. Resend lets you send test/live emails from `onboarding@resend.dev` to any address without domain verification, which is exactly enough for this phase.
3. Go to **API Keys** in the sidebar → **Create API Key**. Give it a name like `wheretoseemorrisdancing-contact-form`, leave permissions as full access (or "Sending access" if offered — that's all this needs), and click Create.
4. Copy the key (starts `re_...`) somewhere safe immediately — like Supabase's secret keys, Resend only shows it once. You'll paste it into a Netlify environment variable in Step 10, never into a file that gets committed to GitHub.

## Step 6 — Update the Contact us page with a real form

Netlify Forms works by scanning your HTML for a `<form>` tag with `data-netlify="true"` at deploy time — no JavaScript or backend code needed just to *capture* a submission. Replace `contact-us.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact us – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Contact us</h1>
    <p>
      Got a question, a suggestion, or spotted a problem with the site? Send a
      message below — this site is run by volunteers, so please be patient
      waiting for a reply.
    </p>
    <form name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" action="/contact-thanks.html">
      <input type="hidden" name="form-name" value="contact" />

      <p class="honeypot-field">
        <label>Don't fill this in if you're human: <input name="bot-field" /></label>
      </p>

      <p>
        <label for="email">Your email address</label><br>
        <input type="email" id="email" name="email" required>
      </p>

      <p>
        <label for="message">Your message (max 500 characters)</label><br>
        <textarea id="message" name="message" maxlength="500" rows="6" required></textarea>
      </p>

      <button type="submit">Send message</button>
    </form>
  </main>
</body>
</html>
```

- `data-netlify="true"` tells Netlify to capture submissions to this form.
- `data-netlify-honeypot="bot-field"` marks `bot-field` as the honeypot: real visitors never see or fill it in (hidden with CSS below), but simple spam bots that fill in every field will — Netlify silently discards any submission where it's filled in, plus runs its own additional spam filtering automatically. This is the "spam protection" called for in the plan for this phase; a full CAPTCHA (Cloudflare Turnstile) is deliberately left for Phase 8, per the plan's phasing.
- The hidden `form-name` field is required boilerplate Netlify needs to match the submission to the right form.

Add this to `styles.css` to visually hide the honeypot field from real visitors (screen readers are also steered away via the label text itself, which is fine for this low-stakes case):

```css
.honeypot-field {
  position: absolute;
  left: -9999px;
}

form label {
  font-weight: bold;
}

form input[type="email"],
form textarea {
  width: 100%;
  max-width: 400px;
  font-family: inherit;
  font-size: 1rem;
  padding: 0.5rem;
  box-sizing: border-box;
}

form button {
  margin-top: 0.5rem;
  padding: 0.5rem 1.5rem;
  background: #2f5d3a;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

form button:hover {
  background: #24492d;
}
```

## Step 7 — Create the "thank you" page

The form's `action="/contact-thanks.html"` means the browser is sent here after a successful submission. Create `contact-thanks.html` at the repository root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Message sent – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Thanks for your message</h1>
    <p>
      Your message has been sent, and you should also receive a short
      acknowledgement email shortly. This site is run by volunteers, so please
      bear with us while we get back to you.
    </p>
    <p><a href="index.html">Back to Home</a></p>
  </main>
</body>
</html>
```

## Step 8 — Create the Netlify Function that sends the emails

Netlify Functions live in a `netlify/functions/` folder at the repository root, and Netlify deploys any `.js` file there as a small serverless endpoint automatically — no separate server to run or maintain.

Create `netlify/functions/send-contact-emails.js`:

```js
// Triggered by a Netlify Forms "outgoing webhook" notification (set up in
// Step 11) every time someone submits the Contact form. Sends two emails via
// Resend: one to the webmaster (reply-to set to the sender, so you can just
// hit "reply"), and a short acknowledgement back to the sender.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const WEBMASTER_EMAIL = process.env.WEBMASTER_EMAIL;

  if (!RESEND_API_KEY || !WEBMASTER_EMAIL) {
    console.error('Missing RESEND_API_KEY or WEBMASTER_EMAIL environment variable');
    return { statusCode: 500, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  // Netlify's outgoing webhook wraps the submitted fields under payload.data.
  const senderEmail = payload?.data?.email;
  const message = payload?.data?.message;

  if (!senderEmail || !message) {
    return { statusCode: 400, body: 'Missing email or message' };
  }

  const sendEmail = (body) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  try {
    const webmasterResult = await sendEmail({
      from: 'Where to See Morris Dancing <onboarding@resend.dev>',
      to: WEBMASTER_EMAIL,
      reply_to: senderEmail,
      subject: 'New contact form message',
      text: `From: ${senderEmail}\n\n${message}`,
    });

    const senderResult = await sendEmail({
      from: 'Where to See Morris Dancing <onboarding@resend.dev>',
      to: senderEmail,
      subject: "We've received your message",
      text: 'Thanks for getting in touch with Where to See Morris Dancing. This site is run by volunteers, so please bear with us — we\'ll get back to you as soon as we can.',
    });

    if (!webmasterResult.ok || !senderResult.ok) {
      console.error('Resend error', await webmasterResult.text(), await senderResult.text());
      return { statusCode: 502, body: 'Failed to send one or both emails' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error sending emails', err);
    return { statusCode: 500, body: 'Error sending emails' };
  }
};
```

Nothing needs installing for this — it only uses the `fetch` function that's already built into Netlify's Node runtime, so there's no `package.json` or `npm install` step required.

## Step 9 — Tell Netlify where your functions live

Create `netlify.toml` at the repository root (if it doesn't already exist) so Netlify knows to look in `netlify/functions/`:

```toml
[build]
  functions = "netlify/functions"
```

This is the one small piece of Netlify configuration this project needs — it doesn't set `base`/`publish` (kept blank deliberately, per Phase 1), just points at the functions folder.

## Step 10 — Add environment variables in Netlify

Your Resend API key must never be committed to GitHub — it lives only in Netlify's environment variable store, which injects it into the function at runtime.

1. Go to your site in the Netlify dashboard → **Project configuration → Environment variables**.
2. Add two variables:
   - `RESEND_API_KEY` → the `re_...` key from Step 5.
   - `WEBMASTER_EMAIL` → the Gmail address you created in Step 1.
3. Save. Existing deploys don't pick up new environment variables automatically — after adding them, go to **Deploys → Trigger deploy → Deploy site** once (same "changing settings doesn't redeploy automatically" rule as Phase 1).

## Step 11 — Commit, push, and deploy

```powershell
cd c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing
git add .
git commit -m "Phase 3: real Home/Links content, Contact form with Netlify Forms + Resend"
git push
```

Wait for Netlify to build and publish (check the Deploys tab, same as Phase 1 — remember a successful build still needs to be the *published* deploy).

## Step 12 — Wire up the outgoing webhook notification

Netlify Forms captures the submission on its own, but doesn't call your function unless you tell it to:

1. In the Netlify dashboard, go to **Project configuration → Forms → Notifications**.
2. Click **Add notification → Outgoing webhook**.
3. **URL to notify**: `https://<your-site>.netlify.app/.netlify/functions/send-contact-emails` (use your actual site address).
4. **Form**: select `contact` (the name from the form's `name="contact"` attribute).
5. **Event to listen for**: "New form submission".
6. Save.

## Step 13 — Test end-to-end

1. Visit your live site's Contact us page and submit the form using **your own personal email address** as the sender (so you can check both emails land).
2. You should be redirected to the "Thanks for your message" page.
3. Check the webmaster inbox (Step 1's Gmail) — you should receive the message, with **Reply-To** set to the address you submitted (test this by clicking Reply — it should address the sender, not `onboarding@resend.dev`).
4. Check the personal inbox you submitted with — you should receive the short acknowledgement email.
5. In Netlify, check **Project configuration → Forms** — your test submission should be listed there too (this is Netlify's own record, independent of the emails).
6. If emails don't arrive: check **Functions** in the Netlify dashboard for a log entry for `send-contact-emails` and read any error message; also check Resend's own dashboard **Logs** page, which shows every send attempt and why it failed, if it did.

### Optional Step — Test the function locally before deploying (needs Node.js)

Only do this if you want to iterate on the function's code without waiting for a live deploy each time:

1. Install Node.js (LTS) from https://nodejs.org if not already installed — check first with `node -v` in a terminal.
2. Install the Netlify CLI: `npm install -g netlify-cli`.
3. Run `netlify login`, then `netlify link` (from the repository root) to connect this folder to your Netlify site.
4. Run `netlify dev` — this serves your static pages **and** runs your functions locally, pulling in the real environment variables from Step 10 automatically. You can then POST test JSON at `http://localhost:8888/.netlify/functions/send-contact-emails` (e.g. with a tool like `curl` or Postman) without needing an actual form submission or a live deploy.

This is genuinely optional — nothing in Steps 1–12 depends on it.

## Checklist — Phase 3 Definition of Done

- [ ] Webmaster Gmail account created (not your personal address), password saved, 2-step verification on.
- [ ] Home page (`index.html`) has real introductory copy.
- [ ] Links page (`links.html`) lists real Oxfordshire Morris sides alphabetically, plus the Morris Federation and any other useful sites — every URL checked before publishing.
- [ ] Resend account created, API key generated and noted down (not committed anywhere).
- [ ] Contact form (`contact-us.html`) rebuilt with `data-netlify="true"`, honeypot field, email + 500-character message fields, and a `contact-thanks.html` redirect target.
- [ ] `netlify/functions/send-contact-emails.js` and `netlify.toml` added.
- [ ] `RESEND_API_KEY` and `WEBMASTER_EMAIL` set as Netlify environment variables (not in any committed file); a fresh deploy triggered after adding them.
- [ ] Outgoing webhook notification configured under Forms → Notifications, pointing at the function.
- [ ] End-to-end test passed: submission redirects to the thank-you page, webmaster receives the message with correct reply-to, sender receives an acknowledgement, and the submission shows up under Netlify's Forms tab.

Phase 3 is complete. Phase 4 (Find events — map view, integrating Leaflet.js + OpenStreetMap and reading real data from Supabase) will be expanded into its own document once this phase is confirmed working.
