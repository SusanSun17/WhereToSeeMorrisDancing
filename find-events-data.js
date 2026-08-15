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

  const others = siblingLocations
    .filter((l) => l.id !== location.id)
    .sort((a, b) => `${a.event_date}T${a.start_time}`.localeCompare(`${b.event_date}T${b.start_time}`));
  if (others.length > 0) {
    parts.push('<div><em><br>Also dancing at:</em><ul>');
    for (const other of others) {
      parts.push(`<li>${other.address_text || 'Location details not given'} (${formatDateTime(other)})</li>`);
    }
    parts.push('</ul></div>');
  }

  parts.push(`
    <div class="request-access">
      <button type="button" class="request-access-toggle">Is this your event? Request edit access</button>
      <form class="request-access-form" hidden data-event-id="${event.id}">
        <label>Your registered email
          <input type="email" required>
        </label>
        <button type="submit">Email me a link</button>
        <p class="request-access-status" role="status"></p>
      </form>
    </div>
  `);

  return parts.join('');
}

// Wires up the "Request edit access" mini-form inside a freshly-inserted
// details container (a Leaflet popup element, or the calendar's modal
// body) — needed because innerHTML doesn't carry event listeners with
// it, so this has to be called again each time the HTML above is shown.
function wireEventAccessRequest(container) {
  const toggle = container.querySelector('.request-access-toggle');
  const form = container.querySelector('.request-access-form');
  if (!toggle || !form) return;

  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = form.querySelector('.request-access-status');
    const email = form.querySelector('input[type="email"]').value;
    const eventId = form.dataset.eventId;
    statusEl.textContent = 'Sending…';
    try {
      await fetch('/.netlify/functions/request-event-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventId }),
      });
    } catch {
      // Fall through to the same message regardless — never reveal
      // whether the email/event actually matched anything.
    }
    statusEl.textContent = "If that email is registered for this event, we've sent a link to it.";
    form.reset();
  });
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
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });
}
