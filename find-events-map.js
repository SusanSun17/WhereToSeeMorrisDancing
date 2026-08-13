// Loads events + locations from Supabase and draws them on the Leaflet map
// on find-events.html. Colour-coding is computed live against "now" every
// time this runs — see plan_v001.md §9.1: there is no stored "is this
// event in the future" flag anywhere, and nothing to update as time passes.

const SUPABASE_URL = 'https://fdhnogpsvkfwmmshxymc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aGICltfJUIFKQkVmi4MeIw_e2Zx9AWU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Oxfordshire-centred starting view.
const OXFORDSHIRE_CENTER = [51.77, -1.25];
const OXFORDSHIRE_ZOOM = 10;

const FUTURE_COLOR = '#ff0000';
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
      radius: 6,
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
