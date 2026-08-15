// Loads events + locations (via find-events-data.js) and draws them on a
// FullCalendar month grid on find-events.html. Uses the same Supabase
// query and colour logic as the map (Step 1), so the two views can never
// disagree about what's shown.

let calendar;
let calendarInitialized = false;

function openEventModal(html) {
  document.getElementById('event-modal-body').innerHTML = html;
  document.getElementById('event-modal').hidden = false;
  wireEventAccessRequest(document.getElementById('event-modal-body'));
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
    title: displayAddress(location.address_text) || 'Location details not given',
    start: `${location.event_date}T${location.start_time}`,
    end: location.end_time ? `${location.event_date}T${location.end_time}` : undefined,
    backgroundColor: isPastLocation(location) ? PAST_COLOR : FUTURE_COLOR,
    borderColor: isPastLocation(location) ? PAST_COLOR : FUTURE_COLOR,
    extendedProps: { locationId: location.id },
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
    // Left at FullCalendar's default rendering (time + title, truncated
    // with an ellipsis rather than wrapping/resizing the day cell) —
    // side(s) performing are shown in the details modal on click instead.
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
