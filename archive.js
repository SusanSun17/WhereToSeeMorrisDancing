// Past-events browse view (plan §10 / §12 phase 9) — the one place that
// queries event/location WITHOUT the 2-month .gte() filter used
// everywhere else (find-events-data.js's fetchUpcomingLocations()). No
// RLS/schema change needed: the public read policies were never
// date-restricted at the database level (phase2 Step 4) — the 2-month
// cutoff has only ever been an application-level query filter.
async function fetchPastLocations() {
  return supabaseClient
    .from('location')
    .select('*, event(id, morris_sides, description)')
    .lt('event_date', twoMonthsAgoISODate())
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
document.getElementById('event-modal').addEventListener('click', (e) => {
  if (e.target.id === 'event-modal') document.getElementById('event-modal').hidden = true;
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
    console.error('Failed to load archive from Supabase', error);
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
