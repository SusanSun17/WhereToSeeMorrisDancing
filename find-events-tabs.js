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
