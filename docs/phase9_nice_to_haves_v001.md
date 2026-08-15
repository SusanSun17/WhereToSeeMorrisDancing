# Phase 9 – Nice-to-haves

This document expands **Phase 9** from [plan_v001.md](plan_v001.md) (§10, §12 point 9) into exact steps, continuing on from [phase8_security_hardening_v001.md](phase8_security_hardening_v001.md). It covers the three nice-to-haves the plan deferred until the core system was working: an `.ics` download / "Add to Google Calendar" link on event details, an archive/browse-history view of past events, and privacy-friendly analytics.

## A note on cost / credits

Unlike Phases 7–8, none of this phase needs a new Netlify Function or a new Supabase table:

- The `.ics` file and the Google Calendar link are both generated **entirely in the browser** from data the site already has — no server round-trip.
- The archive view re-uses the exact same public `event`/`location` read policies from [phase2_database_v001.md](phase2_database_v001.md) Step 4. Those policies were never date-restricted at the database level — the "hide events older than 2 months" rule (plan §9.1) is a plain `.gte()` filter added in application code (`find-events-data.js`'s `fetchUpcomingLocations()`), not an RLS policy. So an archive page just needs a **second query without that filter** — no schema or RLS change at all.
- Analytics is a free third-party account plus one `<script>` tag.

That means this whole phase is safe to do as a **single deploy** — no need to batch it into pieces the way Phase 8 did.

## Goal / Definition of Done

- Every event details popup (map) / modal (calendar) has a "Download as calendar (.ics)" button and an "Add to Google Calendar" link for that location.
- A new `archive.html` page lets Spectators browse events older than the 2-month public cutoff, using the same map-style details rendering as the main Find events page, linked from `find-events.html`.
- A free, cookie-less analytics script is added site-wide and confirmed to be recording pageviews on its dashboard.

## Step 1 — `.ics` download + "Add to Google Calendar"

### 1a. Add generation helpers to `find-events-data.js`

Add these functions anywhere below `groupLocationsByEvent` in [find-events-data.js](../find-events-data.js):

```js
// RFC 5545 wants either a UTC timestamp (trailing "Z") or a TZID — this
// project keeps it simple and emits a "floating" local time instead (no
// Z, no TZID), since every event is a real-world UK time and every
// Spectator downloading it is expected to be in the same timezone as
// their calendar app. Accepted trade-off for a nice-to-have: the one
// edge case this gets wrong is an event falling exactly on the BST/GMT
// changeover night, which is rare enough not to be worth TZID handling.
function formatIcsDateTime(dateStr, timeStr) {
  return `${dateStr.replace(/-/g, '')}T${timeStr.replace(/:/g, '').padEnd(6, '0')}`;
}

// DTSTAMP (when the .ics was generated) genuinely must be UTC per spec.
function icsUtcStamp() {
  return `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

// No end_time is stored for some locations (plan §6.2) — default to a
// one-hour slot so the calendar entry isn't a zero-length event.
function addOneHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function icsEscape(text) {
  return String(text).replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
}

// One VEVENT per sibling location, so downloading from any one stop of a
// multi-location event (§9.2) gives the whole day's itinerary in one file.
function generateIcsContent(siblingLocations, event) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WhereToSeeMorrisDancing//EN', 'CALSCALE:GREGORIAN'];
  for (const loc of siblingLocations) {
    const endTime = loc.end_time || addOneHour(loc.start_time);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${loc.id}@wheretoseemorrisdancing.netlify.app`,
      `DTSTAMP:${icsUtcStamp()}`,
      `DTSTART:${formatIcsDateTime(loc.event_date, loc.start_time)}`,
      `DTEND:${formatIcsDateTime(loc.event_date, endTime)}`,
      `SUMMARY:${icsEscape(event.morris_sides.join(', '))}`,
      `LOCATION:${icsEscape(displayAddress(loc.address_text) || '')}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadIcsFile(content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'morris-dancing-event.ics';
  a.click();
  URL.revokeObjectURL(url);
}

// Google Calendar's "render" URL needs no API key/auth — it just opens a
// pre-filled "add event" page. Only the clicked location is used here
// (not the whole itinerary) since the URL format is one-event-only;
// times are passed as if they were UTC (same floating-time simplification
// as the .ics export above) — good enough for a nice-to-have link.
function buildGoogleCalendarUrl(location, event) {
  const start = formatIcsDateTime(location.event_date, location.start_time);
  const end = formatIcsDateTime(location.event_date, location.end_time || addOneHour(location.start_time));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.morris_sides.join(', '),
    dates: `${start}Z/${end}Z`,
    location: displayAddress(location.address_text) || '',
    details: event.description || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

### 1b. Add the buttons to `buildEventDetailsHtml`

Still in `find-events-data.js`, add a new block to `buildEventDetailsHtml` (right before the existing `request-access` block) and give the wrapping element a `data-location-id` so the click handler can find the right location again:

```js
  parts.push(`
    <div class="add-to-calendar">
      <button type="button" class="ics-download" data-location-id="${location.id}">Download as calendar (.ics)</button>
      <a class="google-calendar-link" href="${buildGoogleCalendarUrl(location, event)}" target="_blank" rel="noopener">Add to Google Calendar</a>
    </div>
  `);
```

### 1c. Wire the `.ics` button

Add this function next to `wireEventAccessRequest` in `find-events-data.js` — it needs the same siblings list already computed by the caller, so pass it straight through:

```js
function wireAddToCalendar(container, siblingLocations, event) {
  const button = container.querySelector('.ics-download');
  if (!button) return;
  button.addEventListener('click', () => {
    downloadIcsFile(generateIcsContent(siblingLocations, event));
  });
}
```

### 1d. Call the new wiring function from both views

In [find-events-map.js](../find-events-map.js), find where `wireEventAccessRequest` is called on `popupopen` and add `wireAddToCalendar` alongside it:

```js
    marker.on('popupopen', () => {
      const popupEl = marker.getPopup().getElement();
      wireEventAccessRequest(popupEl);
      wireAddToCalendar(popupEl, siblings, location.event);
    });
```

In [find-events-calendar.js](../find-events-calendar.js), `openEventModal` already wires `wireEventAccessRequest` internally — give it `siblings`/`event` parameters too, so it can wire `wireAddToCalendar` the same way:

```js
function openEventModal(html, siblings, event) {
  const modalBody = document.getElementById('event-modal-body');
  modalBody.innerHTML = html;
  document.getElementById('event-modal').hidden = false;
  wireEventAccessRequest(modalBody);
  wireAddToCalendar(modalBody, siblings, event);
}
```

and update its one call site (`eventClick`) to pass the extra arguments it already has in scope:

```js
      openEventModal(buildEventDetailsHtml(location, siblings), siblings, location.event);
```

### 1e. Styling

Add to [styles.css](../styles.css), next to the existing `.request-access*` rules:

```css
.add-to-calendar {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.ics-download {
  background: none;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.google-calendar-link {
  align-self: center;
}
```

### 1f. Test locally

Open `find-events.html` via `netlify dev` (or any local static server — see the `file://` gotcha note if you use one), click a marker/calendar entry, click **Download as calendar (.ics)** and confirm a `.ics` file downloads that your OS/calendar app can open and shows the right date/time/location. Click **Add to Google Calendar** and confirm it opens Google Calendar's "add event" screen pre-filled.

## Step 2 — Archive / browse-history view

### 2a. New page: `archive.html`

Create at the project root, alongside `find-events.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Past events archive – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Past events archive</h1>
    <p>Browse Morris dancing events that have already happened. The <a href="find-events.html">Find events</a> map and calendar only show events from the last 2 months — this page has everything on record, oldest first grouping by month.</p>
    <div id="archive-list"></div>
    <p id="archive-status"></p>
  </main>

  <div id="event-modal" class="event-modal" hidden>
    <div class="event-modal-content">
      <button type="button" id="event-modal-close" class="event-modal-close" aria-label="Close">&times;</button>
      <div id="event-modal-body"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="find-events-data.js"></script>
  <script src="archive.js"></script>
</body>
</html>
```

### 2b. `archive.js`

Reuses `buildEventDetailsHtml`/`groupLocationsByEvent`/`wireEventAccessRequest`/`wireAddToCalendar` from `find-events-data.js`, so the archive can never show different wording to the same event than the main page. The modal open/close logic is copied from `find-events-calendar.js`'s existing pattern.

```js
// Past-events browse view (plan §10 / §12 phase 9) — the one place that
// queries event/location WITHOUT the 2-month .gte() filter used
// everywhere else (find-events-data.js's fetchUpcomingLocations()). No
// RLS/schema change needed: the public read policies were never
// date-restricted at the database level (phase2 Step 4) — the 2-month
// cutoff has only ever been an application-level query filter.
async function fetchPastLocations() {
  const cutoff = twoMonthsAgoISODate();
  return supabaseClient
    .from('location')
    .select('*, event(id, morris_sides, description)')
    .lt('event_date', cutoff)
    .order('event_date', { ascending: false })
    .order('start_time', { ascending: false });
}

function openEventModal(html, siblings, event) {
  const modalBody = document.getElementById('event-modal-body');
  modalBody.innerHTML = html;
  document.getElementById('event-modal').hidden = false;
  wireEventAccessRequest(modalBody);
  wireAddToCalendar(modalBody, siblings, event);
}

document.getElementById('event-modal-close').addEventListener('click', () => {
  document.getElementById('event-modal').hidden = true;
});

function monthHeading(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

async function loadArchive() {
  const statusEl = document.getElementById('archive-status');
  const listEl = document.getElementById('archive-list');
  statusEl.textContent = 'Loading…';

  const { data: locations, error } = await fetchPastLocations();
  if (error) {
    statusEl.textContent = 'Sorry, something went wrong loading the archive.';
    return;
  }
  if (!locations || locations.length === 0) {
    statusEl.textContent = 'No past events on record yet.';
    return;
  }

  const locationsByEventId = groupLocationsByEvent(locations);
  let currentMonth = null;
  for (const location of locations) {
    const month = monthHeading(location.event_date);
    if (month !== currentMonth) {
      currentMonth = month;
      const heading = document.createElement('h2');
      heading.textContent = month;
      listEl.appendChild(heading);
    }

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'archive-item';
    item.textContent = `${formatDateTime(location)} — ${displayAddress(location.address_text) || 'Location details not given'}`;
    item.addEventListener('click', () => {
      const siblings = locationsByEventId.get(location.event.id) || [location];
      openEventModal(buildEventDetailsHtml(location, siblings), siblings, location.event);
    });
    listEl.appendChild(item);
  }
  statusEl.textContent = '';
}

loadArchive();
```

### 2c. Styling

Add to `styles.css`:

```css
#archive-list h2 {
  margin-top: 1.5rem;
  font-size: 1.1rem;
}

.archive-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid #eee;
  padding: 0.5rem 0;
  cursor: pointer;
  font: inherit;
}

.archive-item:hover {
  background: #f7f7f7;
}
```

### 2d. Link to it from Find events

In [find-events.html](../find-events.html), add a line under the `events-status` paragraph:

```html
    <p id="events-status"></p>
    <p><a href="archive.html">Looking for events that have already happened? Browse the archive.</a></p>
```

`archive.html` is deliberately **not** added to `nav.js`'s main navigation — it keeps the plan's original 5-page site map (plan §4) intact, and Spectators reach it via this one contextual link instead, exactly where they'd look for it.

### 2e. Test locally

Serve the site locally, open `archive.html` directly, and confirm past events (older than 2 months) appear grouped by month, newest-first, and clicking one opens the same details modal used on the main page (including its "Request edit access" and new "Add to calendar" controls).

## Step 3 — Privacy-friendly analytics

**Recommendation: Cloudflare Web Analytics**, not Plausible — Plausible's hosted version isn't free (Cloudflare's is), and self-hosting Plausible would mean running and paying for a server, which conflicts with this project's "free, low-maintenance" constraint (plan §3). Cloudflare Web Analytics needs no cookies, no consent banner, and — importantly — **does not require moving your domain's DNS to Cloudflare**; it offers a plain JavaScript "beacon" snippet that works on any site.

1. Sign up at Cloudflare (free account) and go to **Analytics & Logs → Web Analytics** in the dashboard.
2. Add a new site: enter your Netlify site's hostname (e.g. `wheretoseemorrisdancing.netlify.app`, or your custom domain if you've set one up). Choose the **"I don't have access to my DNS"** / JavaScript snippet option (not the DNS/proxy option) — this gives you a `<script>` tag using `data-cf-beacon`, no nameserver changes needed.
3. Add the snippet to `nav.js` (loaded on every page already), right after the existing `document.getElementById('site-nav').innerHTML = ...` block, so there's exactly one place to add/remove it later — same "edit once, every page picks it up" reasoning the file's own header comment already gives for the nav links:

```js
// Cloudflare Web Analytics (plan §10) — free, cookie-less, no DNS change
// needed. Loaded here (not per-page) so every page is tracked from one
// place, same reasoning as the nav links above.
const analyticsScript = document.createElement('script');
analyticsScript.type = 'module';
analyticsScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
analyticsScript.setAttribute('data-cf-beacon', '{"token": "c9f8953f06b54efcbca6ce5dfd20c0a3"}');
document.head.appendChild(analyticsScript);
```

The token above is the one Cloudflare's dashboard gave for this site — it's not a secret (it's designed to be public client-side code, same as any other analytics beacon), so no environment variable is needed.

4. Deploy, then visit the live site a few times and confirm pageviews start appearing on Cloudflare's Web Analytics dashboard (can take a few minutes to show up).

## Definition of Done checklist

- [ ] Event details popup/modal (map, calendar, and archive) all show a working "Download as calendar (.ics)" button and "Add to Google Calendar" link.
- [ ] `.ics` file downloads and opens correctly in a calendar app, with the right date/time/location/description, and includes every sibling location for a multi-location event.
- [ ] `archive.html` + `archive.js` created; past events (older than the 2-month cutoff) list correctly, grouped by month, newest first; clicking one opens the shared details modal with working "Request edit access" and "Add to calendar" controls.
- [ ] `find-events.html` links to the archive; the main nav (`nav.js`) is left unchanged (still 5 pages, per plan §4).
- [ ] Cloudflare Web Analytics script added to `nav.js`; pageviews confirmed showing on Cloudflare's dashboard after a live visit.
- [ ] Everything committed and pushed in a single deploy (Step 0's cost note).

## What's left after this phase

Only [plan §12 point 10](plan_v001.md#12-phased-implementation-plan) remains: bootstrapping the real verified bag-man list from gathered contacts, fully populating the Links page, inviting real bag-men to start submitting events, and monitoring the live site — the "soft launch", not more building.
