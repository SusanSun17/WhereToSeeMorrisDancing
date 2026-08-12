# Phase 1 – Foundations: Dev Environment, Hosting Pipeline & Site Skeleton

This document expands **Phase 1** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps. It assumes you know how to manage a software project but have **never done web design or web hosting before**, so every step spells out exactly what to click, type, or paste. You're working on Windows, in VS Code, in this workspace folder (`c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing`).

## A note on cost

Every tool and account in this plan (and in every later phase) is free, with no credit card required: GitHub, Netlify, Node.js, Git, and — later — Supabase, Brevo, Leaflet/OpenStreetMap, and FullCalendar are all free-tier/open-source. Nothing in this project ever requires paid software or a paid subscription. If a future step ever risked introducing a cost, it would be called out explicitly and made optional (as already done for the custom domain in Step 10).

## Goal / Definition of Done

By the end of this phase you will have:

- Your existing GitHub account/repository (already done — see below).
- A free Netlify account, connected to that GitHub repository, automatically deploying your site.
- A minimal 5-page site (Home, Find events, Add events, Links, Contact us) live on the internet at a `*.netlify.app` address, served over HTTPS, with just placeholder text on each page — no real functionality yet. That comes in later phases.

This proves the entire "write code → push to GitHub → automatically appears live on the internet, securely" pipeline works, before you build anything complicated on top of it.

---

## Step 1 — Accounts: GitHub already done, Netlify still needed

- **GitHub**: already done — you're using account **SusanSun17**, and this workspace is already the checked-out `WhereToSeeMorrisDancing` repository connected to `https://github.com/SusanSun17/WhereToSeeMorrisDancing.git`. Nothing to do here.
- **Netlify** (hosts the live website, free): go to https://app.netlify.com/signup. Choose **"Sign up with GitHub"** and sign in as SusanSun17 — this links the two accounts immediately and saves a step later. Approve the authorisation prompt from GitHub when asked.

> You don't need Supabase or Brevo accounts yet — those come in Phase 2 and Phase 3.

## Step 2 — Software: nothing left to install for this phase

Git is already installed on your PC (confirmed: `git version 2.46.0.windows.1`), so there's nothing to do here.

You do **not** need Node.js for this phase. Phase 1's site is plain, static HTML/CSS/JS: the browser opens the files directly (Step 6), and Netlify uploads the `site` folder as-is with no build step (Step 8). Node.js is only needed once the project adds **server-side code** or **npm packages** — neither of which exists yet. It'll be added as a step in **Phase 3**, when the Contact form needs a Netlify Function to send email via Brevo without exposing an API key in the browser. It's still completely free when that time comes.

## Step 3 — Git identity: already done

Your Git identity is already configured on this PC (confirmed: name "Susan Sun", email matching your commits). Nothing to do here.

## Step 4 — Git repository: already done

This workspace folder is already a Git repository, already connected to your GitHub repo, and already on the `main` branch (confirmed via `git status` — "On branch main ... up to date with 'origin/main'"). Nothing to initialise. Skip straight to Step 5, then come back to Step 7 to commit and push the new files this phase adds.

## Step 5 — Create the site skeleton (plain HTML/CSS — no framework needed yet)

A basic website is just plain text files that a browser understands: `.html` files for content/structure, and a `.css` file for appearance. There's no build step or framework required for this phase — just files a browser can open directly.

Create 5 HTML files, 1 CSS file, and 1 shared JavaScript file for the navigation bar (see below for why), **directly in the repository root** (`c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing`) — not in a subfolder. Keeping the site at the repo root means Netlify's zero-config default ("publish whatever's at the root") just works, with no Base directory / Publish directory settings to configure at all — see the note at the end of Step 8 for why this matters. Below is the exact content for each — create every file exactly as shown.

**Why a shared `nav.js` instead of pasting the `<nav>` block into every page?** Copy-pasting the same nav markup into all 5 pages means every future change (add a page, rename a link, restyle it) has to be repeated 5 times and is easy to get out of sync. Instead, each page has one empty `<nav id="site-nav"></nav>` placeholder plus `<script src="nav.js"></script>`; the actual links live in `nav.js` **once**, and the browser fills the placeholder in on every page automatically. This still needs no build step or framework — it's just one small JavaScript file — and it fixes the maintenance problem for good: change the links in `nav.js` and every page updates.

**`styles.css`** — shared appearance for every page:

```css
body {
  font-family: Arial, Helvetica, sans-serif;
  margin: 0;
  padding: 0;
  color: #222;
  background: #fafafa;
}

nav {
  background: #2f5d3a;
  padding: 1rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}

nav a {
  color: white;
  text-decoration: none;
  margin-right: 1.5rem;
  font-weight: bold;
}

nav a:hover {
  text-decoration: underline;
}

main {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}
```

**`nav.js`** — the single place all nav links live:

```js
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
```

**`index.html`** — the Home page:

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
      This site helps you find Morris dancing events happening across Oxfordshire —
      on a map or a calendar. This is a placeholder Home page; the full site is being
      built in phases.
    </p>
  </main>
</body>
</html>
```

**`find-events.html`**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find events – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Find events</h1>
    <p>The map and calendar views will be built here in Phases 4 and 5.</p>
  </main>
</body>
</html>
```

**`add-events.html`**:

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
    <p>Morris bag-men will register and submit events here — built in Phases 6 and 7.</p>
  </main>
</body>
</html>
```

**`links.html`**:

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
    <p>Oxfordshire Morris sides and other useful links will be listed here — built in Phase 3.</p>
  </main>
</body>
</html>
```

**`contact-us.html`**:

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
    <p>A working contact form will be added here in Phase 3.</p>
  </main>
</body>
</html>
```

> Ask me and I can create these files for you directly in the workspace if you'd rather not type them out by hand.

## Step 6 — Preview the site on your own PC before publishing it

You don't need a server to view plain HTML files. In VS Code:

1. Right-click `index.html` in the file explorer and choose **"Reveal in File Explorer"**, then double-click `index.html` — it opens in your default browser.
2. Click the navigation links across the top (Home / Find events / Add events / Links / Contact us) to confirm all 5 pages load correctly.

If the pages display with the green nav bar and correct titles, the skeleton is working.

## Step 7 — Commit and push the new files to your existing GitHub repo

Your repository already exists at `https://github.com/SusanSun17/WhereToSeeMorrisDancing.git`, so there's no new repo to create — just commit the files this phase has added/changed and push them:

```powershell
cd c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing
git add .
git commit -m "Phase 1: add site skeleton"
git push
```

Refresh the GitHub repository page in your browser — you should now see `docs/plan_v001.md`, `docs/phase1_foundations_v001.md`, and the 7 site files (`index.html`, `find-events.html`, `add-events.html`, `links.html`, `contact-us.html`, `styles.css`, `nav.js`) all listed at the repository root.

## Step 8 — Create a Netlify site from the GitHub repository

1. Go to https://app.netlify.com and log in (you already linked it to GitHub in Step 1).
2. Click **"Add new site" → "Import an existing project"**.
3. Choose **"Deploy with GitHub"**, and if prompted, authorise Netlify to access your repositories.
4. Select your **`WhereToSeeMorrisDancing`** repository from the list.
5. On the build settings screen, **leave every field blank** — Base directory, Build command, and Publish directory. Because the site files live at the repository root (Step 5), Netlify's zero-config default ("publish whatever's at the root, as-is") is exactly what you want, and it removes an entire category of settings that can silently mismatch and break the deploy.
6. Click **Deploy site**. Netlify will show a deploy log; wait for it to say the build succeeded.
7. **Also click "Publish deploy"** (sometimes shown as a separate button/banner once the build finishes). A successful *build* and an actually *published/live* deploy are two separate steps — Netlify can build a deploy successfully without it becoming the live production site until you (or your settings) publish it. If you skip this, the site keeps showing whatever the last published deploy was (or "Page not found" if there's never been one), even though the build log says success.

## Step 9 — Verify the live deployment

1. Netlify assigns a random URL like `https://chic-narwhal-123abc.netlify.app` — click it (or find it at the top of your site's Netlify dashboard).
3. Confirm:
   - The page loads and looks the same as your local preview in Step 6.
   - All 5 nav links work.
   - The browser address bar shows a padlock icon — this confirms HTTPS is active (Netlify provisions this automatically, for free, with no action needed from you).
4. **Make sure the project is public.** Since 28 July 2026, Netlify makes new team projects **private by default** — only you, logged into Netlify, can view them; every other visitor is redirected to a Netlify login page and blocked. To fix this:
   - Left sidebar → **Project configuration → General → Visitor access → Project visibility**.
   - Set **Project visibility** (production deploys) to **Public**.
   - Save, then reload your live URL in a private/incognito browser window to confirm it's visible to a logged-out visitor.
5. To give it a more memorable name than the random one (e.g. `cerulean-concha-9fd180` → `wheretoseemorrisdancing`), giving you a URL like `https://wheretoseemorrisdancing.netlify.app` — **this is free and does not require registering your own domain**:
   - Open your site in the Netlify dashboard.
   - In the left sidebar, click **Project configuration** (older Netlify UI versions call this **Site settings**).
   - Under **General → Site details**, click **Change site name**.
   - Type the new name (letters, numbers, and hyphens only) and save. The site is immediately reachable at the new `*.netlify.app` address; the old one stops working.

### Troubleshooting: "Page not found", a login prompt, or a blank/error page

Check these, roughly in order of likelihood:

**1. The build succeeded but was never published.** A green/successful build in the Deploys tab is not the same as it being live — look for a separate **"Publish deploy"** action and click it (see Step 8.7). This is the single most confusing part of Netlify's flow for a first-time user, and was the actual cause the first time we hit this.

**2. The project is private (most likely, for teams created since 28 July 2026).** New Netlify projects now default to private, which blocks anyone not logged into your Netlify account — this can look like a broken/blank page, a redirect to a Netlify login screen, or an access-denied message, depending on the browser. Fix: **Project configuration → General → Visitor access → Project visibility** → set to **Public** → Save (see Step 9.4 below).

**3. Base directory / Publish directory got set to something other than blank.** If you ever changed these away from blank (Step 8.5), Netlify may look for `index.html` in the wrong place and show its own genuine "Page not found" message. Fix: **Project configuration → Build & deploy → Continuous deployment → Build settings → Edit settings**, clear both **Base directory** and **Publish directory** completely (blank, not `.` or `/`), save, then **Deploys → Trigger deploy → Deploy site**, and remember to **Publish** the resulting deploy (point 1 above).

**4. Confirm which commit is actually live.** On the Deploys tab, check the top entry's commit message/hash matches your latest `git push`. If an older deploy is still marked as published, publish the newer one instead.

## Step 10 — (Optional) Custom domain

You can stop here and keep using the free `*.netlify.app` address indefinitely — it's perfectly fine for the pilot and costs nothing. If you'd later like a proper domain (e.g. `wheretoseemorrisdancing.co.uk`):

1. Buy the domain from any registrar (e.g. Namecheap, Google Domains successor Squarespace Domains, 123-reg).
2. In Netlify, go to **Project configuration → Domain management → Add a domain**, enter it, and follow Netlify's instructions to update your registrar's DNS records.
3. Netlify issues a free HTTPS certificate for the custom domain automatically once DNS is verified — no cost, no manual renewal.

This step has a small ongoing cost (domain registration, typically £5–£15/year) so it's marked optional — nothing later in the plan depends on having a custom domain rather than the free `netlify.app` one.

## Checklist — Phase 1 Definition of Done

- [x] GitHub account created (SusanSun17).
- [x] Repository created and checked out, Git installed and configured locally.
- [x] Netlify account created and linked to GitHub.
- [x] 5 HTML pages, `styles.css`, and `nav.js` created at the repository root and previewed locally.
- [x] Files committed and pushed to the GitHub repository.
- [x] Netlify site created from that repository, Base/Publish/Build directory all left blank (zero-config).
- [x] Project visibility set to **Public** (not the new private-by-default).
- [x] Latest deploy **published** (not just built) — see Step 8.7.
- [x] Live `*.netlify.app` URL confirmed working over HTTPS, all 5 pages reachable via nav links.

Phase 1 is complete. From now on, whenever you `git push` a change to the `main` branch, Netlify will automatically build **and publish** the live site within a minute or two (publishing only needs a manual click if your team/project has "stop builds" or manual-publish settings enabled — worth double-checking under **Project configuration → Build & deploy** if a future push ever doesn't show up live automatically).

Phase 2 (Database & data model) will be expanded into its own document once this phase is confirmed working.
