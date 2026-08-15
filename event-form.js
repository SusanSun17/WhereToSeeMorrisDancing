// event-form.js — shared by add-events.html (new event) and
// edit-event.html (existing event). Renders repeatable locations, sides,
// and co-editors; handles Nominatim search + a draggable Leaflet pin per
// location; and posts to submit-event.js, showing the duplicate-warning
// step (§9.7) inline before handing off to the confirmation-email step.

// Default map view before a location is picked — centred on the UK, not a hard restriction.
const DEFAULT_MAP_CENTER = { lat: 54.0, lng: -2.5 };
const MAX_LOCATIONS = 20;
const MAX_SIDES = 50;
const MAX_CO_EDITORS = 3;

function renderEventForm(container, { bagManEmail, existingEvent }) {
  const isEdit = !!existingEvent;
  let locations = isEdit
    ? existingEvent.locations.map((l) => ({ ...l }))
    : [{ addressText: '', lat: null, lng: null, eventDate: '', startTime: '', endTime: '' }];
  let sides = isEdit ? [...existingEvent.morrisSides] : [''];
  let coEditors = isEdit ? [...existingEvent.coEditorEmails] : [];
  const canEditCoEditorsAndDelete = !isEdit || existingEvent.isOwner;

  container.hidden = false;
  container.innerHTML = `
    <h2>${isEdit ? 'Edit event' : 'Submit a new event'}</h2>
    <form id="event-form">
      <p>
        <label for="event-description">Description (optional, max 300 characters)</label><br>
        <textarea id="event-description" maxlength="300" rows="3">${isEdit ? existingEvent.description || '' : ''}</textarea>
      </p>
      <div id="sides-list"></div>
      <button type="button" id="add-side-btn">Add another side</button>
      <div id="locations-list"></div>
      <button type="button" id="add-location-btn">Add another location</button>
      ${canEditCoEditorsAndDelete ? '<div id="co-editors-list"></div><button type="button" id="add-co-editor-btn">Add a co-editor</button>' : ''}
      <p><button type="submit">${isEdit ? 'Save changes' : 'Submit for confirmation'}</button></p>
    </form>
    <div id="duplicate-warning" hidden></div>
    ${canEditCoEditorsAndDelete && isEdit ? '<button type="button" id="delete-event-btn">Delete this event</button>' : ''}
    <p id="event-form-status" role="status"></p>
  `;

  const sidesList = container.querySelector('#sides-list');
  const locationsList = container.querySelector('#locations-list');
  const coEditorsList = container.querySelector('#co-editors-list');

  function renderSides() {
    sidesList.innerHTML = sides.map((v, i) => `
      <p><label>Morris side ${i + 1}
        <input type="text" data-side-index="${i}" value="${v}" maxlength="200" required>
      </label>
      ${sides.length > 1 ? `<button type="button" data-remove-side="${i}">Remove</button>` : ''}</p>
    `).join('');
  }

  function renderLocations() {
    locationsList.innerHTML = locations.map((loc, i) => `
      <fieldset data-location-index="${i}">
        <legend>Location ${i + 1}</legend>
        <div class="address-search-wrap">
          <label>Search for an address
            <input type="text" data-address-search="${i}" placeholder="Start typing an address…" autocomplete="off">
          </label>
          <ul class="address-suggestions" data-suggestions="${i}" hidden></ul>
        </div>
        <div data-map="${i}" style="height:200px"></div>
        <label>Date <input type="date" data-field="eventDate" data-index="${i}" value="${loc.eventDate}" required></label>
        <label>Start time <input type="time" data-field="startTime" data-index="${i}" value="${loc.startTime}" required></label>
        <label>End time (optional) <input type="time" data-field="endTime" data-index="${i}" value="${loc.endTime || ''}"></label>
        ${locations.length > 1 ? `<button type="button" data-remove-location="${i}">Remove this location</button>` : ''}
      </fieldset>
    `).join('');

    // One small Leaflet map per location, pin draggable to fine-tune the
    // Nominatim search result (plan §6.2 point 3).
    locations.forEach((loc, i) => {
      const mapEl = locationsList.querySelector(`[data-map="${i}"]`);
      const map = L.map(mapEl).setView([loc.lat || DEFAULT_MAP_CENTER.lat, loc.lng || DEFAULT_MAP_CENTER.lng], loc.lat ? 15 : 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
      const marker = L.marker([loc.lat || DEFAULT_MAP_CENTER.lat, loc.lng || DEFAULT_MAP_CENTER.lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        locations[i].lat = pos.lat;
        locations[i].lng = pos.lng;
      });

      const searchInput = locationsList.querySelector(`[data-address-search="${i}"]`);
      const suggestionsEl = locationsList.querySelector(`[data-suggestions="${i}"]`);
      let searchTimeout;
      let currentResults = [];

      function hideSuggestions() {
        suggestionsEl.hidden = true;
        suggestionsEl.innerHTML = '';
        currentResults = [];
      }

      function pickResult(result) {
        const { lat, lon, display_name } = result;
        map.setView([lat, lon], 15);
        marker.setLatLng([lat, lon]);
        locations[i].lat = parseFloat(lat);
        locations[i].lng = parseFloat(lon);
        locations[i].addressText = display_name;
        searchInput.value = display_name;
        hideSuggestions();
      }

      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 4) { hideSuggestions(); return; }
        // Debounced to respect Nominatim's usage policy (max ~1 request/sec).
        // Shows a pick-list rather than jumping to a guessed match, since
        // Nominatim's "best guess" for a still-incomplete address is
        // frequently wrong and there was no way to correct it before.
        searchTimeout = setTimeout(async () => {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&limit=5&q=${encodeURIComponent(query)}`
          );
          currentResults = await res.json();
          if (currentResults.length === 0) { hideSuggestions(); return; }
          suggestionsEl.innerHTML = currentResults
            .map((r, ri) => `<li data-result-index="${ri}">${r.display_name}</li>`)
            .join('');
          suggestionsEl.hidden = false;
        }, 600);
      });

      // mousedown (fires before the input's blur) so a click on a
      // suggestion registers before hideSuggestions() would otherwise run.
      suggestionsEl.addEventListener('mousedown', (e) => {
        const li = e.target.closest('[data-result-index]');
        if (!li) return;
        e.preventDefault();
        pickResult(currentResults[li.dataset.resultIndex]);
      });
      searchInput.addEventListener('blur', () => hideSuggestions());
    });
  }

  function renderCoEditors() {
    if (!coEditorsList) return;
    coEditorsList.innerHTML = coEditors.map((v, i) => `
      <p><label>Co-editor ${i + 1} email
        <input type="email" data-co-editor-index="${i}" value="${v}">
      </label>
      <button type="button" data-remove-co-editor="${i}">Remove</button></p>
    `).join('');
  }

  renderSides();
  renderLocations();
  renderCoEditors();

  container.querySelector('#add-side-btn').addEventListener('click', () => {
    if (sides.length >= MAX_SIDES) return;
    sides.push('');
    renderSides();
  });
  container.querySelector('#add-location-btn').addEventListener('click', () => {
    if (locations.length >= MAX_LOCATIONS) return;
    locations.push({ addressText: '', lat: null, lng: null, eventDate: '', startTime: '', endTime: '' });
    renderLocations();
  });
  if (coEditorsList) {
    container.querySelector('#add-co-editor-btn').addEventListener('click', () => {
      if (coEditors.length >= MAX_CO_EDITORS) return;
      coEditors.push('');
      renderCoEditors();
    });
  }

  container.addEventListener('input', (e) => {
    if (e.target.dataset.sideIndex !== undefined) sides[e.target.dataset.sideIndex] = e.target.value;
    if (e.target.dataset.field !== undefined) locations[e.target.dataset.index][e.target.dataset.field] = e.target.value;
    if (e.target.dataset.coEditorIndex !== undefined) coEditors[e.target.dataset.coEditorIndex] = e.target.value;
  });
  container.addEventListener('click', (e) => {
    if (e.target.dataset.removeSide !== undefined) { sides.splice(e.target.dataset.removeSide, 1); renderSides(); }
    if (e.target.dataset.removeLocation !== undefined) { locations.splice(e.target.dataset.removeLocation, 1); renderLocations(); }
    if (e.target.dataset.removeCoEditor !== undefined) { coEditors.splice(e.target.dataset.removeCoEditor, 1); renderCoEditors(); }
  });

  async function doSubmit(overrideDuplicateWarning) {
    const status = container.querySelector('#event-form-status');
    status.textContent = 'Submitting…';
    const body = {
      bagManEmail,
      eventId: isEdit ? existingEvent.id : null,
      accessToken: isEdit ? existingEvent.accessToken : null,
      description: container.querySelector('#event-description').value.trim(),
      morrisSides: sides.map((s) => s.trim()).filter(Boolean),
      coEditorEmails: canEditCoEditorsAndDelete ? coEditors.map((c) => c.trim()).filter(Boolean) : null,
      locations: locations.map(({ addressText, lat, lng, eventDate, startTime, endTime }) => ({
        addressText, lat, lng, eventDate, startTime, endTime: endTime || null,
      })),
      overrideDuplicateWarning,
    };

    const res = await fetch('/.netlify/functions/submit-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.status === 'duplicate-warning') {
      const warningEl = container.querySelector('#duplicate-warning');
      warningEl.hidden = false;
      warningEl.innerHTML = `
        <p><strong>This looks similar to an existing event:</strong></p>
        <ul>${data.matches.map((m) => `<li>${m.morrisSides.join(', ')} — ${m.addressText} (${m.eventDate} ${m.startTime})</li>`).join('')}</ul>
        <button type="button" id="submit-anyway-btn">Submit anyway</button>
      `;
      warningEl.querySelector('#submit-anyway-btn').addEventListener('click', () => doSubmit(true));
      status.textContent = '';
    } else if (data.status === 'confirmation-sent') {
      status.textContent = "Check your email — click the confirmation link to make this event live.";
      container.querySelector('#event-form').hidden = true;
    } else if (data.status === 'validation-error') {
      status.textContent = data.message || 'Please check the form and try again.';
    } else {
      status.textContent = 'Something went wrong — please try again.';
    }
  }

  container.querySelector('#event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doSubmit(false);
  });

  if (canEditCoEditorsAndDelete && isEdit) {
    container.querySelector('#delete-event-btn').addEventListener('click', async () => {
      const status = container.querySelector('#event-form-status');
      status.textContent = 'Sending delete confirmation email…';
      const res = await fetch('/.netlify/functions/request-event-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: existingEvent.accessToken }),
      });
      const data = await res.json();
      status.textContent = data.status === 'sent'
        ? 'Check your email — the link permanently deletes this event once clicked.'
        : 'Something went wrong — please try again.';
    });
  }
}