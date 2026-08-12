# Phase 4 – Find Events: Map View (Leaflet.js + OpenStreetMap + Supabase)

This document expands **Phase 4** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps, continuing on from [phase1_foundations_v001.md](phase1_foundations_v001.md), [phase2_database_v001.md](phase2_database_v001.md), and [phase3_static_content_v001.md](phase3_static_content_v001.md).

This phase replaces the "under construction" placeholder on `find-events.html` with a real, interactive map: every published `location` row from Supabase appears as a colour-coded marker, and clicking one shows the event's details — including any sibling locations for the same day, per [plan_v001.md §9.2](plan_v001.md#92-events-that-move-location-recommended-model). The calendar view (Phase 5) will share this same page and data source, added alongside the map in the next phase.

## A note on cost

Everything in this phase is free, no API key, no billing account, and no credit card required:

- **Leaflet.js** is an open-source JS library, loaded straight from a CDN — nothing to install.
- **OpenStreetMap** tiles are free to use for a low-traffic site like this, under their [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) — no API key needed, unlike Google Maps.
- **Supabase**'s free tier is already set up from Phase 2 — this phase only *reads* from it, using the public **Publishable key**, which is safe to embed in a plain HTML page (see the callout in Step 2).

## Goal / Definition of Done

By the end of this phase you will have:

- A working map on `find-events.html`, centred on Oxfordshire, showing a marker for every `location` row from Supabase dated within the last 2 months or in the future (the same "don't show ancient events" rule from [plan_v001.md §9.1](plan_v001.md#91-past-vs-future-marker-colours--archiving)).
- Markers colour-coded: one colour for **future/current** events, another for **past** ones — computed live in the browser by comparing each location's date/time to "now", with **no scheduled job, cron task, or manual step** (exactly as §9.1 describes).
- Clicking a marker opens a popup with that location's address, date, start–end time, the Morris side(s) performing, the optional description, and — if the event has more than one location — a list of the event's other locations that day (the "itinerary" view called for in [plan_v001.md §6.1](plan_v001.md#61-spectator) point 3).
- A small colour-key legend under the map so Spectators know what the colours mean.
- Confirmation that it all works against your real (currently test) Supabase data, live on the deployed site.

Nothing changes in Supabase itself this phase (no new tables, no schema changes) — this is purely a front-end read against the `event` and `location` tables already made public-readable in Phase 2.

## Quick concepts (skip if familiar)

- **Leaflet.js**: a small, free JavaScript library for interactive maps — you give it a `<div>`, a starting position/zoom, a tile layer (the map imagery), and then add markers to it in code.
- **Tile layer**: the map imagery itself (roads, place names, etc.), served as small square images ("tiles") from a provider — here, OpenStreetMap's free tile server.
- **`circleMarker` vs `marker`**: Leaflet's default `marker` uses a pin-shaped icon image, which needs its own icon files set up correctly to display (a common source of "broken image" map bugs when loading Leaflet from a CDN). This guide uses `L.circleMarker` instead — a simple coloured dot drawn directly by Leaflet with no external image files — which sidesteps that problem entirely and makes colour-coding trivial (just set its `fillColor`).
- **Why the Supabase keys are safe to put directly in `find-events.html`**: the **Publishable key** (Phase 2, Step 6) is designed to be embedded in browser-side code — it grants no special access by itself. What actually controls access is Row-Level Security (Phase 2, Step 4), which only allows public reads on `event` and `location`. This is different from the Brevo API key or Supabase **Secret key**, which must only ever live in a Netlify environment variable, never in a committed file.

---

## Step 1 — Add Leaflet via CDN and the map container

Replace the contents of `find-events.html` with the following starting point (Step 2 below adds the actual data-loading script):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find events – Where to See Morris Dancing</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
</head>
<body>
  <nav id="site-nav"></nav>
  <script src="nav.js"></script>
  <main>
    <h1>Find events</h1>
    <p>Browse Morris dancing events across Oxfordshire on the map below.</p>

    <div id="map"></div>

    <ul class="map-legend">
      <li><span class="legend-dot legend-dot--future"></span> Upcoming / today</li>
      <li><span class="legend-dot legend-dot--past"></span> Recently finished</li>
    </ul>

    <p id="map-status"></p>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="find-events-map.js"></script>
</body>
</html>
```

The `integrity`/`crossorigin` attributes are Leaflet's own official CDN snippet (from their "Quick Start" guide) — they let the browser verify the downloaded file hasn't been tampered with. Leave them exactly as shown.

## Step 2 — Add the map styling

Add this to `styles.css`:

```css
#map {
  height: 500px;
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 1rem;
}

.map-legend {
  list-style: none;
  display: flex;
  gap: 1.5rem;
  padding: 0;
  margin: 0.75rem 0 0 0;
  font-size: 0.9rem;
}

.legend-dot {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.legend-dot--future {
  background: #2f5d3a;
}

.legend-dot--past {
  background: #888;
}
```

The colours match the site's existing green (`#2f5d3a`, already used for the nav bar and buttons) for future/current events, and a neutral grey for past ones.

## Step 3 — Write the script that loads events and draws markers

Create a new file `find-events-map.js` at the repository root:

```js
// Loads events + locations from Supabase and draws them on the Leaflet map
// on find-events.html. Colour-coding is computed live against "now" every
// time this runs — see plan_v001.md §9.1: there is no stored "is this
// event in the future" flag anywhere, and nothing to update as time passes.

const SUPABASE_URL = 'https://fdhnogpsvkfwmmshxymc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aGICltfJUIFKQkVmi4MeIw_e2Zx9AWU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Oxfordshire-centred starting view.
const OXFORDSHIRE_CENTER = [51.82, -1.25];
const OXFORDSHIRE_ZOOM = 10;

const FUTURE_COLOR = '#2f5d3a';
const PAST_COLOR = '#888888';

// Matches plan_v001.md §9.1's public-query filter: never show events older
// than 2 months, without ever deleting the underlying rows.
function twoMonthsAgoISODate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// A location's own "finish moment" — end_time if given, otherwise
// start_time — compared against "now" to decide its marker colour.
function locationFinishDate(location) {
  const time = location.end_time || location.start_time;
  return new Date(`${location.event_date}T${time}`);
}

function formatDateTime(location) {
  const date = new Date(`${location.event_date}T00:00:00`);
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = location.end_time
    ? `${location.start_time.slice(0, 5)}–${location.end_time.slice(0, 5)}`
    : location.start_time.slice(0, 5);
  return `${dateStr}, ${timeStr}`;
}

function buildPopupHtml(location, siblingLocations) {
  const event = location.event;
  const parts = [];

  parts.push(`<strong>${event.morris_sides.join(', ')}</strong>`);
  parts.push(`<div>${location.address_text || 'Location details not given'}</div>`);
  parts.push(`<div>${formatDateTime(location)}</div>`);

  if (event.description) {
    parts.push(`<p>${event.description}</p>`);
  }

  const others = siblingLocations.filter((l) => l.id !== location.id);
  if (others.length > 0) {
    parts.push('<div><em>Also dancing today at:</em><ul>');
    for (const other of others) {
      parts.push(`<li>${other.address_text || 'Location details not given'} (${formatDateTime(other)})</li>`);
    }
    parts.push('</ul></div>');
  }

  return parts.join('');
}

async function loadAndRenderMap() {
  const statusEl = document.getElementById('map-status');
  const map = L.map('map').setView(OXFORDSHIRE_CENTER, OXFORDSHIRE_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const { data: locations, error } = await supabaseClient
    .from('location')
    .select('*, event(id, morris_sides, description)')
    .gte('event_date', twoMonthsAgoISODate())
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Failed to load events from Supabase', error);
    statusEl.textContent = 'Sorry, events could not be loaded right now. Please try again later.';
    return;
  }

  if (!locations || locations.length === 0) {
    statusEl.textContent = 'No events to show yet — check back soon!';
    return;
  }

  // Group locations by event, so a popup can list "also dancing today at..."
  // per plan_v001.md §9.2, without a second round-trip to Supabase.
  const locationsByEventId = new Map();
  for (const location of locations) {
    const eventId = location.event.id;
    if (!locationsByEventId.has(eventId)) {
      locationsByEventId.set(eventId, []);
    }
    locationsByEventId.get(eventId).push(location);
  }

  const now = new Date();
  for (const location of locations) {
    const isPast = locationFinishDate(location) < now;
    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 9,
      color: '#ffffff',
      weight: 2,
      fillColor: isPast ? PAST_COLOR : FUTURE_COLOR,
      fillOpacity: 0.9,
    }).addTo(map);

    const siblings = locationsByEventId.get(location.event.id);
    marker.bindPopup(buildPopupHtml(location, siblings));
  }

  statusEl.textContent = '';
}

loadAndRenderMap();
```

A few deliberate choices worth understanding:

- **Colour-coding needs no stored flag or scheduled job.** `locationFinishDate()` is computed against `new Date()` (the visitor's own browser clock) every time the page loads — exactly the read-time comparison described in plan §9.1.
- **The 2-month cutoff is a query filter, not a delete.** `.gte('event_date', twoMonthsAgoISODate())` only affects what this page asks Supabase for — the underlying rows are untouched, which is what keeps the future "archive" nice-to-have ([plan §10](plan_v001.md#10-nice-to-have--future-enhancements)) essentially free to add later.
- **Grouping by event client-side**, rather than a more complex nested-filter Supabase query, keeps the query simple and works well at Oxfordshire's small scale — a single query returns every location due for display, and the sibling-lookup is just an in-memory `Map`.
- Times are stored and compared as plain local values (no timezone column in the `location` table) — fine for a single-county, UK-only audience; not something to over-engineer at this stage.

## Step 4 — Test locally

Serve the site over a local server rather than double-clicking the file, same as Phase 2's `db-test.html` (pages that call `fetch`/`supabase-js` should be served over `http://`, not opened as `file://`):

1. Open a terminal in the repository root and run `python -m http.server 8000` (or `npx serve` if you don't have Python).
2. Visit `http://localhost:8000/find-events.html`.
3. You should see the Oxfordshire map appear, with one green marker (the test event inserted in Phase 2, "Radcliffe Camera, Oxford") if its date is still in the future relative to today; if that test event's date has since passed, its marker should appear grey instead — a good way to confirm the colour logic actually works.
4. Click the marker — a popup should show "Test Morris Men", the address, date/time, and the test description. Since that test event has only one location, no "Also dancing today at" section should appear.
5. Open the browser console (F12) — there should be no errors. A `favicon.ico 404` is unrelated browser noise, same as in Phase 2.

### Optional: add a second test location to prove the "itinerary" popup works

If you want to see the multi-location popup in action before real bag-man data exists, run this in Supabase's SQL Editor (reusing the same event created in Phase 2 — adjust the `where` clause if you've since added other events):

```sql
insert into location (event_id, latitude, longitude, address_text, event_date, start_time, end_time)
select id, 51.7565, -1.2483, 'The Turf Tavern, Oxford', '2026-09-01', '20:30', '21:30'
from event
where description = 'A test event created in Phase 2 to prove the database works.';
```

Reload the map — both markers should now show "Also dancing today at:" linking to each other. Feel free to delete this second test row afterwards (`delete from location where address_text = 'The Turf Tavern, Oxford';`) once you've confirmed it — it's not required for later phases.

### Troubleshooting

- **Map area is blank/grey with no tiles**: usually a missing `#map` height in CSS (Leaflet needs the container to have a real size before it renders) — double check Step 2's CSS was added.
- **No markers, no error**: check the Supabase query filter — if your test event's `event_date` is more than 2 months in the past, it's correctly being excluded; insert a fresh test row with a current/future date instead.
- **"Invalid API key" or a 401 in the console**: double check `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `find-events-map.js` match Phase 2 Step 6 exactly, and that you copied the **Publishable** key, not a Secret key.
- **Marker icon looks broken (missing pin image)**: shouldn't happen with this guide's `circleMarker` approach — if you see it, double check you didn't accidentally use `L.marker(...)` somewhere instead.

## Step 5 — Commit, push, and verify live

```powershell
cd c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing
git add .
git commit -m "Phase 4: Find events map view (Leaflet + OpenStreetMap + Supabase)"
git push
```

Wait for Netlify to build and publish (Deploys tab — remember a successful build still needs to be the *published* deploy, per the Phase 1 gotcha). Visit your live site's Find events page and repeat Step 4's checks there.

If the live map fails to load data but the local test worked, double-check your Supabase project hasn't paused itself from inactivity (Phase 2's note on the free tier pausing after about a week of zero traffic) — visiting the Supabase dashboard yourself is enough to wake it back up.

## Checklist — Phase 4 Definition of Done

- [ ] `find-events.html` updated with a Leaflet map container, legend, and CDN script tags for Leaflet and supabase-js.
- [ ] `styles.css` updated with `#map` sizing and legend styles.
- [ ] `find-events-map.js` created, querying `location` (joined to `event`) from Supabase, filtered to the last 2 months onward.
- [ ] Markers colour-coded live (future/current vs past) by comparing each location's date/time to "now" — no stored flag, no scheduled job.
- [ ] Clicking a marker shows a popup with side(s), address, date/time, description, and any sibling locations for the same event.
- [ ] Tested locally over `http://localhost`, confirmed against real Supabase test data (including the optional second-location test).
- [ ] Committed, pushed, and confirmed working on the live Netlify deploy.

Phase 4 is complete. Phase 5 (Find events — calendar view, integrating FullCalendar on the same page and data source) will be expanded into its own document once this phase is confirmed working.
