# Phase 5 – Find Events: Calendar View (FullCalendar + Supabase)

This document expands **Phase 5** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps, continuing on from [phase4_map_view_v001.md](phase4_map_view_v001.md), which added the Leaflet map view to `find-events.html`.

This phase adds a **calendar view** to the same `find-events.html` page, using [FullCalendar](https://fullcalendar.io/) (open-source, MIT licence) — a month grid, today highlighted, with the same events already loaded for the map. A pair of tabs ("Map view" / "Calendar view") lets a Spectator switch between the two, per [plan_v001.md §6.1](plan_v001.md#61-spectator) point 2. Clicking a day's event opens the same kind of details popup as the map's marker popup — address, date/time, side(s), description, and any sibling locations for the same event ([plan_v001.md §9.2](plan_v001.md#92-events-that-move-location-recommended-model)).

## A note on cost

Everything in this phase is free, no API key, no billing account, no credit card:

- **FullCalendar**'s core + day-grid plugin are open-source, loaded from a CDN — nothing to install, no licence key needed for the plain month-view features this phase uses.
- No new Supabase queries are introduced — the calendar reads the **same** `location`/`event` rows already fetched for the map, just rendered a second way.

## Goal / Definition of Done

By the end of this phase you will have:

- Two tabs at the top of `find-events.html`: **Map view** (the existing Phase 4 map) and **Calendar view** (new), with the map shown by default and the calendar rendered the first time its tab is opened.
- A FullCalendar month grid, today's date highlighted, `prev` / `next` / `today` navigation — Spectators can browse forward up to **12 months ahead** and back to the same 2-month cutoff already used for the map ([plan_v001.md §9.1](plan_v001.md#91-past-vs-future-marker-colours--archiving)), so the two views never disagree about what's visible.
- Every location appears as a calendar entry on its date, coloured the same way as the map (red for future/current, blue for past — matching whatever colours Phase 4 ended up using), computed live against "now" — no stored flag, no scheduled job.
- Clicking a calendar entry opens the same details (address, date/time, side(s), description, sibling locations for the same event) as the map's popup, reusing shared code rather than duplicating it.
- The Supabase query and data-shaping logic used by the map and the calendar are pulled into one shared file, so both views are provably reading from **one** data source, not two independently-written queries that could quietly drift apart.
- Confirmation that both views work locally and on the live deployed site.

Nothing changes in Supabase itself this phase (no new tables, no schema changes) — like Phase 4, this is purely a front-end read against tables already made public-readable in Phase 2.

## Quick concepts (skip if familiar)

- **FullCalendar**: a free, open-source JavaScript calendar UI library (the same family of tool Google/Outlook Calendar's month view resembles). The "global" CDN bundle used below includes the day-grid (month view) plugin already bundled in — no separate CSS file to include, unlike Leaflet.
- **`validRange`**: a FullCalendar option that caps how far a visitor can navigate — used here to enforce "up to 12 months ahead" and to match the map's own 2-months-back cutoff, so `prev`/`next` can't be clicked into a range with no data.
- **Why refactor the Supabase query into a shared file first**: Phase 4's `find-events-map.js` already contains the query, the 2-month cutoff, the past/future colour logic, and the "group locations by event" logic for sibling lookups. The calendar view needs exactly the same data, shaped the same way. Copy-pasting it into a second file risks the two views silently going out of sync (e.g. someone tweaks the cutoff for the map and forgets the calendar) — pulling it into one `find-events-data.js` file, loaded by both `find-events-map.js` and the new `find-events-calendar.js`, removes that risk entirely.
- **Why the calendar is initialised lazily, not on page load**: FullCalendar (like Leaflet) can render at the wrong size if it's built inside a `hidden`/`display: none` container. Rendering it only the first time its tab is actually clicked avoids that problem outright, rather than needing size-recalculation workarounds.

---

## Step 1 — Extract the shared data-loading code

Create a new file `find-events-data.js` at the repository root. This pulls the Supabase connection, the 2-month cutoff, the colour-coding time logic, the date/time formatter, and the details-popup HTML builder out of `find-events-map.js` so both views share one copy:

```js
// Shared Supabase data loading for find-events.html's map AND calendar
// views. Both views call fetchUpcomingLocations() and get back exactly
// the same rows, shaped the same way — see plan_v001.md §12 phase 5.
// Keeping this in one file (rather than copy-pasting the query into a
// second script) guarantees the two views can never quietly disagree
// about what's shown.

const SUPABASE_URL = 'https://fdhnogpsvkfwmmshxymc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aGICltfJUIFKQkVmi4MeIw_e2Zx9AWU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const FUTURE_COLOR = '#ff0000';
const PAST_COLOR = '#8888dd';

// Matches plan_v001.md §9.1's public-query filter: never show events older
// than 2 months, without ever deleting the underlying rows.
function twoMonthsAgoISODate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Matches the "browse up to 12 months ahead" requirement (plan_v001.md
// §12 phase 5) — used by the calendar's validRange.
function twelveMonthsAheadISODate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

// A location's own "finish moment" — end_time if given, otherwise
// start_time — compared against "now" to decide its colour on both views.
function locationFinishDate(location) {
  const time = location.end_time || location.start_time;
  return new Date(`${location.event_date}T${time}`);
}

function isPastLocation(location) {
  return locationFinishDate(location) < new Date();
}

function formatDateTime(location) {
  const date = new Date(`${location.event_date}T00:00:00`);
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = location.end_time
    ? `${location.start_time.slice(0, 5)}–${location.end_time.slice(0, 5)}`
    : location.start_time.slice(0, 5);
  return `${dateStr}, ${timeStr}`;
}

// Shared HTML used by both the map's Leaflet popup and the calendar's
// details modal (Step 4), so the two views can never show different
// wording/fields for the same event.
function buildEventDetailsHtml(location, siblingLocations) {
  const event = location.event;
  const parts = [];

  parts.push(`<strong>${location.address_text || 'Location details not given'}</strong>`);
  parts.push(`<div>${formatDateTime(location)}</div>`);
  parts.push(`<div>${event.morris_sides.join(', ')}</div>`);

  if (event.description) {
    parts.push(`<p>${event.description}</p>`);
  }

  const others = siblingLocations.filter((l) => l.id !== location.id);
  if (others.length > 0) {
    parts.push('<div><em><br>Also dancing at:</em><ul>');
    for (const other of others) {
      parts.push(`<li>${other.address_text || 'Location details not given'} (${formatDateTime(other)})</li>`);
    }
    parts.push('</ul></div>');
  }

  return parts.join('');
}

// Groups a flat location list by event id, so a popup/modal can list
// "also dancing at..." per plan_v001.md §9.2 without a second round-trip
// to Supabase.
function groupLocationsByEvent(locations) {
  const locationsByEventId = new Map();
  for (const location of locations) {
    const eventId = location.event.id;
    if (!locationsByEventId.has(eventId)) {
      locationsByEventId.set(eventId, []);
    }
    locationsByEventId.get(eventId).push(location);
  }
  return locationsByEventId;
}

// The one Supabase query both views read from.
async function fetchUpcomingLocations() {
  return supabaseClient
    .from('location')
    .select('*, event(id, morris_sides, description)')
    .gte('event_date', twoMonthsAgoISODate())
    .order('event_date', { ascending: true });
}
```

## Step 2 — Simplify `find-events-map.js` to use the shared file

Replace `find-events-map.js` with the trimmed-down version below — it now calls the shared functions from Step 1 instead of defining its own copies. Behaviour is unchanged from Phase 4:

```js
// Loads events + locations (via find-events-data.js) and draws them on the
// Leaflet map on find-events.html. Colour-coding is computed live against
// "now" every time this runs — see plan_v001.md §9.1.

const OXFORDSHIRE_CENTER = [51.77, -1.25];
const OXFORDSHIRE_ZOOM = 10;

let map;

function renderMapMarkers(locations) {
  const locationsByEventId = groupLocationsByEvent(locations);

  for (const location of locations) {
    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: isPastLocation(location) ? PAST_COLOR : FUTURE_COLOR,
      fillOpacity: 0.9,
    }).addTo(map);

    const siblings = locationsByEventId.get(location.event.id);
    marker.bindPopup(buildEventDetailsHtml(location, siblings));
  }
}

async function loadAndRenderMap() {
  const statusEl = document.getElementById('events-status');
  map = L.map('map').setView(OXFORDSHIRE_CENTER, OXFORDSHIRE_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const { data: locations, error } = await fetchUpcomingLocations();

  if (error) {
    console.error('Failed to load events from Supabase', error);
    statusEl.textContent = 'Sorry, events could not be loaded right now. Please try again later.';
    return;
  }

  if (!locations || locations.length === 0) {
    statusEl.textContent = 'No events to show yet — check back soon!';
    return;
  }

  renderMapMarkers(locations);
  statusEl.textContent = '';
}

loadAndRenderMap();
```

`find-events-data.js` must be loaded (via a `<script>` tag) **before** `find-events-map.js` in Step 3's HTML, since the map script now relies on its functions.

## Step 3 — Add the view tabs, calendar container, and modal to `find-events.html`

Replace the contents of `find-events.html` with:

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
    <p>Browse Morris dancing events across Oxfordshire below, by map or by calendar.</p>

    <div class="view-tabs" role="tablist">
      <button type="button" id="tab-map" class="view-tab view-tab--active" role="tab" aria-selected="true">Map view</button>
      <button type="button" id="tab-calendar" class="view-tab" role="tab" aria-selected="false">Calendar view</button>
    </div>

    <div id="map-view">
      <div id="map"></div>

      <ul class="map-legend">
        <li><span class="legend-dot legend-dot--future"></span> Upcoming / today</li>
        <li><span class="legend-dot legend-dot--past"></span> Recently finished</li>
      </ul>
    </div>

    <div id="calendar-view" hidden>
      <div id="calendar"></div>
    </div>

    <p id="events-status"></p>
  </main>

  <div id="event-modal" class="event-modal" hidden>
    <div class="event-modal-content">
      <button type="button" id="event-modal-close" class="event-modal-close" aria-label="Close">&times;</button>
      <div id="event-modal-body"></div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="find-events-data.js"></script>
  <script src="find-events-map.js"></script>
  <script src="find-events-calendar.js"></script>
  <script src="find-events-tabs.js"></script>
</body>
</html>
```

Note the script load order: `find-events-data.js` first (both later scripts depend on it), then the map and calendar scripts, then the small tab-switching script from Step 5.

## Step 4 — Add the calendar, tab, and modal styling

Add this to `styles.css` (after the existing `.legend-dot--past` rule from Phase 4):

```css
.view-tabs {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.view-tab {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #eee;
  cursor: pointer;
  font-weight: bold;
}

.view-tab--active {
  background: #fff;
  border-color: #2f5d3a;
  color: #2f5d3a;
}

#calendar {
  background: #fff;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: -1px;
}

.fc-event-location {
  font-weight: bold;
  white-space: normal;
}

.fc-event-sides {
  font-size: 0.8em;
  opacity: 0.9;
  white-space: normal;
}

.event-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* The [hidden] attribute is only display:none via the browser's default
   (user-agent) stylesheet, which our own .event-modal { display: flex; }
   rule above otherwise overrides (author styles beat UA styles regardless
   of the hidden attribute). This higher-specificity rule restores it, so
   hiding/showing the modal via the `hidden` property actually works. */
.event-modal[hidden] {
  display: none;
}

.event-modal-content {
  background: #fff;
  border-radius: 4px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  position: relative;
}

.event-modal-close {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  border: none;
  background: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}
```

`#map` and `.map-legend`/`.legend-dot*` styles from Phase 4 stay exactly as they are.

## Step 5 — Write the calendar script

Create `find-events-calendar.js`:

```js
// Loads events + locations (via find-events-data.js) and draws them on a
// FullCalendar month grid on find-events.html. Uses the same Supabase
// query and colour logic as the map (Step 1), so the two views can never
// disagree about what's shown.

let calendar;
let calendarInitialized = false;

function openEventModal(html) {
  document.getElementById('event-modal-body').innerHTML = html;
  document.getElementById('event-modal').hidden = false;
}

function closeEventModal() {
  document.getElementById('event-modal').hidden = true;
}

async function initCalendar() {
  const statusEl = document.getElementById('events-status');
  const calendarEl = document.getElementById('calendar');

  const { data: locations, error } = await fetchUpcomingLocations();

  if (error) {
    console.error('Failed to load events from Supabase', error);
    statusEl.textContent = 'Sorry, events could not be loaded right now. Please try again later.';
    return;
  }

  const locationsByEventId = groupLocationsByEvent(locations || []);

  const calendarEvents = (locations || []).map((location) => ({
    title: location.address_text || 'Location details not given',
    start: `${location.event_date}T${location.start_time}`,
    end: location.end_time ? `${location.event_date}T${location.end_time}` : undefined,
    backgroundColor: isPastLocation(location) ? PAST_COLOR : FUTURE_COLOR,
    borderColor: isPastLocation(location) ? PAST_COLOR : FUTURE_COLOR,
    // Sides are shown as a smaller second line via eventContent below,
    // rather than being the calendar entry's main title.
    extendedProps: { locationId: location.id, sides: location.event.morris_sides.join(', ') },
  }));

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    // Matches the map's 2-month archiving cutoff and the "browse up to 12
    // months ahead" requirement — plan_v001.md §9.1 and §12 phase 5.
    validRange: {
      start: twoMonthsAgoISODate(),
      end: twelveMonthsAheadISODate(),
    },
    events: calendarEvents,
    // Keeps the location as the main title while still showing which
    // side(s) are performing, as a smaller second line under it.
    eventContent(arg) {
      const titleEl = document.createElement('div');
      titleEl.className = 'fc-event-location';
      titleEl.textContent = arg.event.title;

      const sidesEl = document.createElement('div');
      sidesEl.className = 'fc-event-sides';
      sidesEl.textContent = arg.event.extendedProps.sides;

      const wrapper = document.createElement('div');
      wrapper.append(titleEl, sidesEl);
      return { domNodes: [wrapper] };
    },
    eventClick(info) {
      const locationId = info.event.extendedProps.locationId;
      const location = locations.find((l) => l.id === locationId);
      const siblings = locationsByEventId.get(location.event.id);
      openEventModal(buildEventDetailsHtml(location, siblings));
    },
  });

  calendar.render();

  if (!locations || locations.length === 0) {
    statusEl.textContent = 'No events to show yet — check back soon!';
  } else {
    statusEl.textContent = '';
  }
}

function showCalendarView() {
  if (!calendarInitialized) {
    calendarInitialized = true;
    initCalendar();
  } else {
    calendar.render(); // re-measure size in case it was hidden since last render
  }
}

document.getElementById('event-modal-close').addEventListener('click', closeEventModal);
document.getElementById('event-modal').addEventListener('click', (e) => {
  if (e.target.id === 'event-modal') closeEventModal(); // click on the dark overlay itself
});
```

`showCalendarView()` is called from the tab-switching script (Step 6) the first time the Calendar tab is opened — this is what avoids FullCalendar rendering into a `hidden` container.

## Step 6 — Write the tab-switching script

Create `find-events-tabs.js`:

```js
// Switches between the map and calendar views on find-events.html.
// The map is created on page load (Phase 4); the calendar is created
// lazily, the first time its tab is opened (see find-events-calendar.js).

const tabMap = document.getElementById('tab-map');
const tabCalendar = document.getElementById('tab-calendar');
const mapView = document.getElementById('map-view');
const calendarView = document.getElementById('calendar-view');

function activateTab(activeTab, inactiveTab, activeView, inactiveView) {
  activeTab.classList.add('view-tab--active');
  activeTab.setAttribute('aria-selected', 'true');
  inactiveTab.classList.remove('view-tab--active');
  inactiveTab.setAttribute('aria-selected', 'false');
  activeView.hidden = false;
  inactiveView.hidden = true;
}

tabMap.addEventListener('click', () => {
  activateTab(tabMap, tabCalendar, mapView, calendarView);
  map.invalidateSize(); // Leaflet needs this after its container was hidden
});

tabCalendar.addEventListener('click', () => {
  activateTab(tabCalendar, tabMap, calendarView, mapView);
  showCalendarView();
});
```

`map.invalidateSize()` is Leaflet's documented fix for maps that were sized while their container was `display: none` (or, here, briefly hidden by the tab switch) — without it, tiles can appear cut off or grey until the window is resized.

## Step 7 — Test locally

1. Open a terminal in the repository root and run `python -m http.server 8000` (or `npx serve`).
2. Visit `http://localhost:8000/find-events.html`.
3. The **Map view** tab should be active by default, showing the same map as Phase 4 — confirm nothing broke in the refactor.
4. Click **Calendar view** — a month grid should appear, with today's date highlighted by FullCalendar automatically, and your test event(s) shown on their date, coloured the same way as their map marker.
5. Click a calendar event — the modal should appear with the same details (address, date/time, side(s), description, and "Also dancing at" if the event has more than one location, per the optional second-location test row from Phase 4).
6. Close the modal (✕ button, or click the dark overlay) and confirm it disappears.
7. Click **Map view** again — the map should still render correctly (this is what `invalidateSize()` in Step 6 is for).
8. Use the calendar's `prev`/`next` buttons — confirm you can browse forward up to roughly 12 months ahead and back to roughly 2 months ago, and that navigating further is blocked by `validRange`.
9. Open the browser console (F12) — no errors (a `favicon.ico` 404 is unrelated noise, same as before).

### Troubleshooting

- **Calendar area is blank**: check the browser console for a `FullCalendar is not defined` error — this means the CDN `<script>` tag is missing or came after `find-events-calendar.js` in the HTML; script order matters.
- **Map broke after the refactor**: double check `find-events-data.js` is loaded before `find-events-map.js`, and that `FUTURE_COLOR`/`PAST_COLOR`/`isPastLocation`/`groupLocationsByEvent`/`buildEventDetailsHtml` were removed from `find-events-map.js` (not left duplicated, which could shadow the shared versions with stale copies).
- **Calendar events show but clicking does nothing**: check the console for an error inside `eventClick` — usually means `locationId` wasn't found, which would mean `extendedProps` wasn't set when building `calendarEvents`.
- **Map looks fine on load but grey/cut-off after switching tabs**: confirms `map.invalidateSize()` is missing or not being called — check Step 6's `tabMap` click handler.
- **"Invalid API key" or a 401 in the console**: same as Phase 4 — check `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` in `find-events-data.js`.
- **Whole page looks greyed out behind a small empty white box on load, and the ✕ doesn't close it**: the modal is showing even though it has the `hidden` attribute — check `styles.css` has the `.event-modal[hidden] { display: none; }` rule from Step 4. Without it, `.event-modal { display: flex; }` (an author rule) overrides the browser's default `[hidden] { display: none; }` (a user-agent rule) regardless of whether `hidden` is set, so the modal always renders and toggling `hidden` in JS has no visible effect.

## Step 8 — Commit, push, and verify live

```powershell
cd c:\WhereToSeeMorrisDancing\WhereToSeeMorrisDancing
git add .
git commit -m "Phase 5: Find events calendar view (FullCalendar), shared data source with map"
git push
```

Wait for Netlify to build and publish (remember: a successful build still needs to be the *published* deploy). Visit your live site's Find events page and repeat Step 7's checks there.

## Checklist — Phase 5 Definition of Done

- [ ] `find-events-data.js` created, holding the Supabase client, the 2-month-back / 12-month-ahead date helpers, the past/future colour logic, the date/time formatter, the shared details-HTML builder, and the one shared `fetchUpcomingLocations()` query.
- [ ] `find-events-map.js` simplified to use the shared file — behaviour unchanged from Phase 4.
- [ ] `find-events.html` updated with a Map view / Calendar view tab pair, a `#calendar` container, an event-details modal, and CDN script tags for FullCalendar, in the correct load order.
- [ ] `styles.css` updated with tab, calendar container, and modal styles.
- [ ] `find-events-calendar.js` created — renders a FullCalendar month grid from the shared data source, colour-coded the same way as the map, `validRange` capped to the same 2-months-back / 12-months-ahead window.
- [ ] `find-events-tabs.js` created — switches between views, lazily initialises the calendar on first use, and calls `map.invalidateSize()` when returning to the map tab.
- [ ] Clicking a calendar entry opens a modal with the same details (and sibling locations) as the map's popup.
- [ ] Tested locally over `http://localhost`, confirmed against real Supabase test data, including switching tabs back and forth.
- [ ] Committed, pushed, and confirmed working on the live Netlify deploy.

Phase 6 (Bag-man registration & verification) will be expanded into its own document once this phase is confirmed working.
