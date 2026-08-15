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
    // Leaflet builds the popup's DOM fresh each time it opens, so the
    // access-request form's listeners have to be (re-)attached then too.
    marker.on('popupopen', () => {
      const popupEl = marker.getPopup().getElement();
      wireEventAccessRequest(popupEl);
      wireAddToCalendar(popupEl, siblings, location.event);
    });
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
