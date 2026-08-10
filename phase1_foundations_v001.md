# Phase 1 – Foundations: Dev Environment, Hosting Pipeline & Site Skeleton

This document expands **Phase 1** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps. It assumes you know how to manage a software project but have **never done web design or web hosting before**, so every step spells out exactly what to click, type, or paste. You're working on Windows, in VS Code, in this workspace folder (`c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing`).

## A note on cost

Every tool and account in this plan (and in every later phase) is free, with no credit card required: GitHub, Netlify, Node.js, Git, and — later — Supabase, Resend, Leaflet/OpenStreetMap, and FullCalendar are all free-tier/open-source. Nothing in this project ever requires paid software or a paid subscription. If a future step ever risked introducing a cost, it would be called out explicitly and made optional (as already done for the custom domain in Step 10).

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

> You don't need Supabase or Resend accounts yet — those come in Phase 2 and Phase 3.

## Step 2 — Install the one piece of software you're still missing

Git is already installed on your PC (confirmed: `git version 2.46.0.windows.1`), so there's nothing to do there. The only tool still missing is **Node.js**, which lets you preview the site on your own machine before it goes live. It's completely free.

1. Install Node.js (choose the **LTS** version): download from https://nodejs.org/ and run the installer. Default options are fine throughout.
2. Close and reopen any terminal (or restart VS Code) so the new tool is picked up.
3. Verify it installed correctly. Open a terminal in VS Code (**Terminal → New Terminal**) and run:

   ```powershell
   node --version
   npm --version
   ```

   Each command should print a version number (e.g. `v20.15.0`). If either says "not recognized", restart your computer and try again — this fixes it almost every time, because it lets Windows refresh its list of installed programs.

## Step 3 — Git identity: already done

Your Git identity is already configured on this PC (confirmed: name "Susan Sun", email matching your commits). Nothing to do here.

## Step 4 — Git repository: already done

This workspace folder is already a Git repository, already connected to your GitHub repo, and already on the `main` branch (confirmed via `git status` — "On branch main ... up to date with 'origin/main'"). Nothing to initialise. Skip straight to Step 5, then come back to Step 7 to commit and push the new files this phase adds.

## Step 5 — Create the site skeleton (plain HTML/CSS — no framework needed yet)

A basic website is just plain text files that a browser understands: `.html` files for content/structure, and a `.css` file for appearance. There's no build step or framework required for this phase — just files a browser can open directly.

Create a new folder called `site` in the workspace, containing 5 HTML files and 1 CSS file. Below is the exact content for each — create every file exactly as shown.

**`site/styles.css`** — shared appearance for every page:

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

**`site/index.html`** — the Home page:

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
  <nav>
    <a href="index.html">Home</a>
    <a href="find-events.html">Find events</a>
    <a href="add-events.html">Add events</a>
    <a href="links.html">Links</a>
    <a href="contact.html">Contact us</a>
  </nav>
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

**`site/find-events.html`**:

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
  <nav>
    <a href="index.html">Home</a>
    <a href="find-events.html">Find events</a>
    <a href="add-events.html">Add events</a>
    <a href="links.html">Links</a>
    <a href="contact.html">Contact us</a>
  </nav>
  <main>
    <h1>Find events</h1>
    <p>The map and calendar views will be built here in Phases 4 and 5.</p>
  </main>
</body>
</html>
```

**`site/add-events.html`**:

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
  <nav>
    <a href="index.html">Home</a>
    <a href="find-events.html">Find events</a>
    <a href="add-events.html">Add events</a>
    <a href="links.html">Links</a>
    <a href="contact.html">Contact us</a>
  </nav>
  <main>
    <h1>Add events</h1>
    <p>Morris bag-men will register and submit events here — built in Phases 6 and 7.</p>
  </main>
</body>
</html>
```

**`site/links.html`**:

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
  <nav>
    <a href="index.html">Home</a>
    <a href="find-events.html">Find events</a>
    <a href="add-events.html">Add events</a>
    <a href="links.html">Links</a>
    <a href="contact.html">Contact us</a>
  </nav>
  <main>
    <h1>Links</h1>
    <p>Oxfordshire Morris sides and other useful links will be listed here — built in Phase 3.</p>
  </main>
</body>
</html>
```

**`site/contact.html`**:

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
  <nav>
    <a href="index.html">Home</a>
    <a href="find-events.html">Find events</a>
    <a href="add-events.html">Add events</a>
    <a href="links.html">Links</a>
    <a href="contact.html">Contact us</a>
  </nav>
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

1. Right-click `site/index.html` in the file explorer and choose **"Reveal in File Explorer"**, then double-click `index.html` — it opens in your default browser.
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

Refresh the GitHub repository page in your browser — you should now see `plan_v001.md`, `phase1_foundations_v001.md`, and the `site` folder listed.

## Step 8 — Create a Netlify site from the GitHub repository

1. Go to https://app.netlify.com and log in (you already linked it to GitHub in Step 1).
2. Click **"Add new site" → "Import an existing project"**.
3. Choose **"Deploy with GitHub"**, and if prompted, authorise Netlify to access your repositories.
4. Select your **`WhereToSeeMorrisDancing`** repository from the list.
5. On the build settings screen, set:
   - **Base directory**: leave blank.
   - **Build command**: leave blank (there's nothing to build yet — plain HTML doesn't need one).
   - **Publish directory**: `site`
6. Click **Deploy site**. Netlify will show a deploy log; wait for it to say "Site is live".

## Step 9 — Verify the live deployment

1. Netlify assigns a random URL like `https://chic-narwhal-123abc.netlify.app` — click it (or find it at the top of your site's Netlify dashboard).
2. Confirm:
   - The page loads and looks the same as your local preview in Step 6.
   - All 5 nav links work.
   - The browser address bar shows a padlock icon — this confirms HTTPS is active (Netlify provisions this automatically, for free, with no action needed from you).
3. Optional but recommended: in the Netlify dashboard, go to **Site settings → General → Site details** and click **"Change site name"** to give it a more memorable name than the random one (e.g. `wheretoseemorrisdancing`), giving you a URL like `https://wheretoseemorrisdancing.netlify.app`.

## Step 10 — (Optional) Custom domain

You can stop here and keep using the free `*.netlify.app` address indefinitely — it's perfectly fine for the pilot and costs nothing. If you'd later like a proper domain (e.g. `wheretoseemorrisdancing.co.uk`):

1. Buy the domain from any registrar (e.g. Namecheap, Google Domains successor Squarespace Domains, 123-reg).
2. In Netlify, go to **Site settings → Domain management → Add a domain**, enter it, and follow Netlify's instructions to update your registrar's DNS records.
3. Netlify issues a free HTTPS certificate for the custom domain automatically once DNS is verified — no cost, no manual renewal.

This step has a small ongoing cost (domain registration, typically £5–£15/year) so it's marked optional — nothing later in the plan depends on having a custom domain rather than the free `netlify.app` one.

## Checklist — Phase 1 Definition of Done

- [x] GitHub account created (SusanSun17).
- [x] Repository created and checked out, Git installed and configured locally.
- [ ] Netlify account created and linked to GitHub.
- [ ] Node.js installed and verified locally.
- [ ] `site/` folder with 5 HTML pages + `styles.css` created and previewed locally.
- [ ] New files committed and pushed to the GitHub repository.
- [ ] Netlify site created from that repository, publish directory set to `site`.
- [ ] Live `*.netlify.app` URL confirmed working over HTTPS, all 5 pages reachable via nav links.

Once every box is ticked, Phase 1 is complete. From now on, whenever you `git push` a change to the `main` branch, Netlify will automatically redeploy the live site within a minute or two — this is the automated "no manual maintenance" deployment pipeline the rest of the project relies on.

Phase 2 (Database & data model) will be expanded into its own document once this phase is confirmed working.
