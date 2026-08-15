# Phase 7 – Event Submission & Editing

This document expands **Phase 7** from [plan_v001.md](plan_v001.md) (§12 point 7) into exact, no-assumptions steps, continuing on from [phase6_bagman_registration_v001.md](phase6_bagman_registration_v001.md). It replaces the "Welcome back! Submitting and managing events arrives in Phase 7" placeholder in `add-events.html`'s verified-section with the real screens: **submitting a new event** ([plan §6.2](plan_v001.md#62-morris-bag-man) point 3, multi-location/multi-side/co-editor fields per [§9.2](plan_v001.md#92-events-that-move-location-recommended-model)/[§9.6](plan_v001.md#96-nominating-co-editors)), the **duplicate-event warning check** ([§9.7](plan_v001.md#97-duplicate-event-detection)), the **publish/edit confirmation email** step, **"Manage my existing events"** (re-issuing fresh edit/delete links), **event deletion** ([§9.8](plan_v001.md#98-deleting-an-event)), and **bag-man retirement/handover** ([§9.9](plan_v001.md#99-bag-man-retirement--handover)).

This is the largest phase in the plan. It's broken into six parts (B–H below), each independently testable, so you don't have to hold the whole thing in your head at once — get Part B–E (submit → confirm → live on the map) working and tested before starting Part F (manage/edit/delete), and get that working before Part H (retirement, the least-used feature).

## A note on cost

Still free, no new paid services:

- No new tables — the six from [Phase 2](phase2_database_v001.md) already cover everything (`event_co_editor` and `bag_man_transfer_request` have sat empty since Phase 2, waiting for this phase).
- Three small column additions to existing tables (Step 1) — free, just schema.
- Nominatim (OpenStreetMap's free address-search API) and Leaflet (already loaded for the map view in Phase 4) need no new API key or billing.
- More Brevo emails through the same free-tier sender as every previous phase.
- Six new Netlify Functions — free, same as the four from Phase 6.

## Goal / Definition of Done

By the end of this phase you will have:

- A real event submission form reachable from `add-events.html`'s verified screen, with repeatable locations (≤20), repeatable Morris sides (≤50), and up to 3 co-editors, address type-ahead + draggable map pin per location, and a 300-character description field.
- Server-side validation, the §9.7 duplicate-warning check, and co-editor validation (§9.6) — all in one new Netlify Function, `submit-event.js` — followed by a confirmation email before anything goes live.
- A confirmation landing page that actually creates (or updates) the `event`/`location`/`event_co_editor` rows only once the bag-man clicks the emailed link — nothing is ever publicly queryable before that click.
- "Manage my existing events" — a rate-limited button that emails a bag-man (or co-editor) a fresh, single-use edit link per event they can act on, plus a delete link for events they own.
- An edit form (prefilled from an emailed link) that reuses the same submission form, duplicate check, and confirmation-email step.
- A "Delete this event" flow reachable both from the manage-events email and from inside the edit form, gated to the event's owner only, with a plain-language "this is permanent" warning before the final click.
- The bag-man retirement/handover flow (§9.9): a two-sided email confirmation that only transfers an event's ownership once **both** the retiring bag-man and the named successor have clicked their own link.
- Confirmation that a submitted event, once confirmed, actually appears correctly on both the map (Phase 4) and calendar (Phase 5) views, with no extra code needed there — they already just query `event`/`location`.

## Quick concepts (skip if familiar)

- **Nothing goes live until the email is clicked — not even in the database.** Rather than inserting a `draft`/`published` row and flipping a flag on confirm, this phase stores the *entire proposed event* (description, sides, locations, resolved co-editor IDs) as JSON in a new `verification_token.payload` column. The `event`/`location`/`event_co_editor` rows themselves are only created (or, for an edit, replaced) inside the confirmation function, at the moment the link is clicked. This means there is never a half-submitted row for the public map/calendar query to accidentally pick up — it's the same "don't trust anything until it's confirmed" idea Phase 6 used for `bag_man.verified`, just applied to a whole event instead of one boolean.
- **The same `event_edit` token type does two different jobs, told apart by `payload`.** The plan calls for two different kinds of emailed link around editing: (a) an **access link** from "Manage my existing events" that just opens the prefilled edit form, and (b) a **confirmation link** sent after the form is submitted, which is the actual "review before it goes live" safety net (mirroring the new-event flow). Rather than adding a seventh `verification_token.type`, both reuse `event_edit`: an access token has `payload = null` (it doesn't need to carry anything, it just proves "this email address may open this event's form"), while a confirmation token has the full proposed edit in `payload`. `confirm-event.js` (Step 5) only ever acts on tokens that *have* a payload — an access token being replayed there does nothing.
- **Who's asking, without a login system**: a new `verification_token.recipient_bag_man_id` column records which bag-man a given link was actually emailed to. This is how the edit form knows whether the person who clicked the link is the event's **owner** (`event.bag_man_id`) or just a **co-editor** — which controls whether the "Delete this event" and co-editor-list fields are shown at all, enforcing the owner-only rules from [§9.6](plan_v001.md#96-nominating-co-editors)/[§9.8](plan_v001.md#98-deleting-an-event) server-side, not just by hiding buttons in the UI.
- **A used access token can still prove identity for one follow-up action.** The "Delete this event instead" button inside the edit form (§9.8) doesn't require re-typing an email address — it re-uses the *same* access token that opened the form (even though that token was already marked single-use/"used" for the purpose of loading the form) purely to look up who it was issued to, then issues a **brand new** `event_delete` token/email from scratch. The token's job as "prove which bag-man this browser tab belongs to for the next few minutes" is separate from its single-use "open the form" job.
- **Duplicate check is a dry run first.** `submit-event.js` is called once with `overrideDuplicateWarning: false`. If §9.7's distance/time check finds a close match, it returns the match details and does **nothing else** — no token, no email. The form shows the match and a "Submit anyway" button, which re-calls the same function with `overrideDuplicateWarning: true`, skipping straight to staging + email. Nothing is written to the database on the dry-run call.
- **Rate limiting without a queue/cache service**: "Manage my existing events" only needs to remember *one* timestamp per bag-man — a new `bag_man.last_manage_request_at` column, checked and updated by `request-manage-events.js`. No new infrastructure needed.
- **Cascading deletes already exist** — every `location` and `event_co_editor` row was created in [Phase 2](phase2_database_v001.md) with `references event(id) on delete cascade`. Deleting the `event` row (Step 7) is genuinely one SQL `DELETE`; Postgres removes the children automatically.

---

## Step 1 — Three small schema changes

In Supabase's **SQL Editor**, run:

```sql
-- payload: holds the full proposed event (new OR edited) until the
-- bag-man confirms by email — see "Nothing goes live until the email is
-- clicked" above. Null for every token type except a staged event_publish
-- or event_edit confirmation.
-- recipient_bag_man_id: who this link was actually emailed to — lets
-- later steps tell an owner apart from a co-editor without a login system.
-- related_id was NOT NULL before; a brand-new event_publish token has
-- nothing to point at yet (the event doesn't exist until confirmed), so
-- this constraint is relaxed.
alter table verification_token
  add column payload jsonb,
  add column recipient_bag_man_id uuid references bag_man(id),
  alter column related_id drop not null;

-- Rate-limits "Manage my existing events" (plan §8) to once every few
-- minutes per bag-man, without needing a separate table or cache.
alter table bag_man
  add column last_manage_request_at timestamptz;
```

No RLS changes needed — `verification_token` and `bag_man` already have zero public policies/grants from Phase 2; only `service_role` (used by Netlify Functions) can touch them.

## Step 2 — Replace the verified placeholder with three real options

Update `add-events.html`'s `verified-section` (from Phase 6) to offer the three options from [plan §6.2](plan_v001.md#62-morris-bag-man) point 2:

```html
<section id="verified-section" hidden>
  <p>Welcome back! What would you like to do?</p>
  <button type="button" id="show-new-event-btn">Submit a new event</button>
  <button type="button" id="show-manage-events-btn">Manage my existing events</button>
  <button type="button" id="show-retire-btn">Retiring? Hand over your events to someone else</button>

  <div id="event-form-section" hidden></div>

  <section id="manage-events-section" hidden>
    <p>We'll email you a fresh link for each of your current/upcoming events.</p>
    <button type="button" id="request-manage-events-btn">Email me my event links</button>
    <p id="manage-events-status" role="status"></p>
  </section>

  <section id="retire-section" hidden>
    <form id="retire-form">
      <p>
        <label for="successor-email">Successor's registered email address</label><br>
        <input type="email" id="successor-email" required>
      </p>
      <button type="submit">Send handover request</button>
    </form>
    <p id="retire-status" role="status"></p>
  </section>
</section>
```

`add-events.js` (extended from Phase 6) keeps the checked email in a module-level variable once step 1's check returns `verified` (never in `localStorage` — it only needs to survive this page view), and wires the three buttons to show/hide the three sub-sections. `event-form-section` starts empty and is filled in by `event-form.js` (Step 3) when "Submit a new event" is clicked, with no `eventId`/prefill data (a blank form).

```js
// Added to add-events.js after the existing email-check logic.
let checkedEmail = null; // set below when status === 'verified'

document.getElementById('show-new-event-btn').addEventListener('click', () => {
  document.getElementById('manage-events-section').hidden = true;
  document.getElementById('retire-section').hidden = true;
  renderEventForm(document.getElementById('event-form-section'), { bagManEmail: checkedEmail });
});

document.getElementById('show-manage-events-btn').addEventListener('click', () => {
  document.getElementById('event-form-section').hidden = true;
  document.getElementById('retire-section').hidden = true;
  document.getElementById('manage-events-section').hidden = false;
});

document.getElementById('show-retire-btn').addEventListener('click', () => {
  document.getElementById('event-form-section').hidden = true;
  document.getElementById('manage-events-section').hidden = true;
  document.getElementById('retire-section').hidden = false;
});
```

(`renderEventForm` comes from the new shared `event-form.js`, Step 3 — include it via `<script src="event-form.js"></script>` before `add-events.js` in `add-events.html`.)

## Step 3 — The shared event form (`event-form.js`)

One shared module renders the form used by **both** "Submit a new event" (blank) and the edit page (Step 6, prefilled), so the two never drift apart. It's given a container element and an options object (`{ bagManEmail, existingEvent }` — `existingEvent` omitted for a new submission):

```js
// event-form.js — shared by add-events.html (new event) and
// edit-event.html (existing event). Renders repeatable locations, sides,
// and co-editors; handles Nominatim search + a draggable Leaflet pin per
// location; and posts to submit-event.js, showing the duplicate-warning
// step (§9.7) inline before handing off to the confirmation-email step.

const OXFORDSHIRE_BOUNDS = { minLat: 51.5, maxLat: 52.15, minLng: -1.75, maxLng: -0.85 };
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
        <label>Search for an address
          <input type="text" data-address-search="${i}" placeholder="Start typing an address…">
        </label>
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
      const map = L.map(mapEl).setView([loc.lat || 51.84, loc.lng || -1.25], loc.lat ? 15 : 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
      const marker = L.marker([loc.lat || 51.84, loc.lng || -1.25], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        locations[i].lat = pos.lat;
        locations[i].lng = pos.lng;
      });

      let searchTimeout;
      locationsList.querySelector(`[data-address-search="${i}"]`).addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 4) return;
        // Debounced to respect Nominatim's usage policy (max ~1 request/sec).
        searchTimeout = setTimeout(async () => {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&viewbox=${OXFORDSHIRE_BOUNDS.minLng},${OXFORDSHIRE_BOUNDS.maxLat},${OXFORDSHIRE_BOUNDS.maxLng},${OXFORDSHIRE_BOUNDS.minLat}&bounded=1&q=${encodeURIComponent(query)}`
          );
          const results = await res.json();
          if (results[0]) {
            const { lat, lon, display_name } = results[0];
            map.setView([lat, lon], 15);
            marker.setLatLng([lat, lon]);
            locations[i].lat = parseFloat(lat);
            locations[i].lng = parseFloat(lon);
            locations[i].addressText = display_name;
          }
        }, 600);
      });
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
```

Load Leaflet's CSS/JS (already used by Phase 4's map view) in both `add-events.html` and the new `edit-event.html`:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

## Step 4 — `submit-event.js`: validate, check duplicates, stage

```js
// Handles both new submissions and edits (plan §6.2 point 3-5). Never
// writes to event/location/event_co_editor directly — always stages the
// proposed data as a verification_token.payload and emails a confirmation
// link (Step 5 actually creates/updates rows). See "Nothing goes live
// until the email is clicked" in docs/phase7_event_submission_v001.md.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

const OXFORDSHIRE_BOUNDS = { minLat: 51.5, maxLat: 52.15, minLng: -1.75, maxLng: -0.85 };

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minutesBetween(date, time1, time2) {
  const t1 = new Date(`${date}T${time1}`);
  const t2 = new Date(`${date}T${time2}`);
  return Math.abs(t1 - t2) / 60000;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid payload' }; }

  const email = (body.bagManEmail || '').trim().toLowerCase();
  const bagManRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,retired,banned`);
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan || !bagMan.verified || bagMan.retired || bagMan.banned) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  // --- Validation ---
  const description = (body.description || '').trim();
  const morrisSides = Array.isArray(body.morrisSides) ? body.morrisSides.map((s) => String(s).trim()).filter(Boolean) : [];
  const locations = Array.isArray(body.locations) ? body.locations : [];

  if (description.length > 300) return validationError('Description is too long.');
  if (morrisSides.length < 1 || morrisSides.length > 50) return validationError('Give between 1 and 50 Morris sides.');
  if (locations.length < 1 || locations.length > 20) return validationError('Give between 1 and 20 locations.');
  for (const loc of locations) {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return validationError('Every location needs a map position.');
    if (loc.lat < OXFORDSHIRE_BOUNDS.minLat || loc.lat > OXFORDSHIRE_BOUNDS.maxLat || loc.lng < OXFORDSHIRE_BOUNDS.minLng || loc.lng > OXFORDSHIRE_BOUNDS.maxLng) {
      return validationError('Locations must be within Oxfordshire.');
    }
    if (!loc.eventDate || !loc.startTime) return validationError('Every location needs a date and start time.');
  }

  // --- Owner vs co-editor: figure out which event (if any) is being edited ---
  let existingEvent = null;
  if (body.eventId) {
    const evRes = await supabaseRequest(`event?id=eq.${body.eventId}&select=id,bag_man_id`);
    existingEvent = (await evRes.json())[0];
    if (!existingEvent) return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message: 'This event no longer exists.' }) };

    const isOwner = existingEvent.bag_man_id === bagMan.id;
    if (!isOwner) {
      const coEditorRes = await supabaseRequest(`event_co_editor?event_id=eq.${body.eventId}&bag_man_id=eq.${bagMan.id}&select=id`);
      if ((await coEditorRes.json()).length === 0) return { statusCode: 403, body: 'Forbidden' };
    }
  }
  const isOwnerOrNew = !existingEvent || existingEvent.bag_man_id === bagMan.id;

  // --- Co-editors: only the owner may change this list (§9.6); a
  // co-editor's submission always keeps the event's existing list. ---
  let coEditorIds = [];
  if (isOwnerOrNew) {
    const coEditorEmails = Array.isArray(body.coEditorEmails) ? body.coEditorEmails.slice(0, 3) : [];
    for (const ceEmail of coEditorEmails) {
      const ceRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(ceEmail.trim().toLowerCase())}&select=id,verified,retired,banned`);
      const ce = (await ceRes.json())[0];
      if (!ce || !ce.verified || ce.retired || ce.banned) {
        return validationError(`${ceEmail} isn't a registered bag-man yet — ask them to register via Add events first.`);
      }
      coEditorIds.push(ce.id);
    }
  } else if (existingEvent) {
    const existingRes = await supabaseRequest(`event_co_editor?event_id=eq.${existingEvent.id}&select=bag_man_id`);
    coEditorIds = (await existingRes.json()).map((r) => r.bag_man_id);
  }

  // --- Duplicate check (§9.7), skipped if already overridden ---
  if (!body.overrideDuplicateWarning) {
    const matches = [];
    for (const loc of locations) {
      const dayRes = await supabaseRequest(
        `location?event_date=eq.${loc.eventDate}&select=id,event_id,address_text,start_time,latitude,longitude,event:event_id(morris_sides,description)`
      );
      const dayLocations = await dayRes.json();
      for (const other of dayLocations) {
        if (existingEvent && other.event_id === existingEvent.id) continue;
        if (haversineMetres(loc.lat, loc.lng, other.latitude, other.longitude) <= 50 &&
            minutesBetween(loc.eventDate, loc.startTime, other.start_time) <= 30) {
          matches.push({ morrisSides: other.event.morris_sides, addressText: other.address_text, eventDate: loc.eventDate, startTime: other.start_time });
        }
      }
    }
    if (matches.length > 0) {
      return { statusCode: 200, body: JSON.stringify({ status: 'duplicate-warning', matches }) };
    }
  }

  // --- Stage the proposed event and email a confirmation link ---
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const payload = { description, morrisSides, coEditorIds, locations };

  const tokenRes = await supabaseRequest('verification_token', {
    method: 'POST',
    body: JSON.stringify({
      type: existingEvent ? 'event_edit' : 'event_publish',
      token,
      related_id: existingEvent ? existingEvent.id : null,
      recipient_bag_man_id: bagMan.id,
      payload,
      expires_at: expiresAt,
    }),
  });
  if (!tokenRes.ok) {
    console.error('Supabase token insert error', await tokenRes.text());
    return { statusCode: 502, body: 'Database error' };
  }

  const SITE_URL = process.env.SITE_URL;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
      to: [{ email }],
      subject: existingEvent ? 'Confirm your event changes' : 'Confirm your new event',
      textContent:
        `Please confirm this is really you by clicking the link below (valid for 48 hours) — ` +
        `this makes ${existingEvent ? 'your changes' : 'the event'} visible to the public:\n\n` +
        `${SITE_URL}/confirm-event.html?token=${token}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmation-sent' }) };

  function validationError(message) {
    return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message }) };
  }
};
```

## Step 5 — Confirming a publish or an edit

Create `netlify/functions/confirm-event.js`:

```js
// Reached when a bag-man clicks the confirmation link from submit-event.js.
// Only ever acts on a token that HAS a payload — an event_edit "access"
// token (payload null, from request-manage-events.js) is a different job
// and is handled by get-event-for-edit.js instead. See "The same
// event_edit token type does two different jobs" in
// docs/phase7_event_submission_v001.md.
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ status: 'invalid' }) };

  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=in.(event_publish,event_edit)&select=*`);
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || !tokenRow.payload || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }

  const { description, morrisSides, coEditorIds, locations } = tokenRow.payload;
  let eventId = tokenRow.related_id;

  if (tokenRow.type === 'event_publish') {
    const insertRes = await supabaseRequest('event', {
      method: 'POST',
      body: JSON.stringify({ bag_man_id: tokenRow.recipient_bag_man_id, morris_sides: morrisSides, description: description || null }),
    });
    if (!insertRes.ok) { console.error(await insertRes.text()); return { statusCode: 502, body: JSON.stringify({ status: 'error' }) }; }
    eventId = (await insertRes.json())[0].id;
  } else {
    // Event no longer exists (e.g. deleted between submitting and confirming).
    const existsRes = await supabaseRequest(`event?id=eq.${eventId}&select=id`);
    if ((await existsRes.json()).length === 0) {
      return { statusCode: 200, body: JSON.stringify({ status: 'event-gone' }) };
    }
    await supabaseRequest(`event?id=eq.${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ morris_sides: morrisSides, description: description || null }),
    });
    await supabaseRequest(`location?event_id=eq.${eventId}`, { method: 'DELETE' });
    await supabaseRequest(`event_co_editor?event_id=eq.${eventId}`, { method: 'DELETE' });
  }

  for (const loc of locations) {
    await supabaseRequest('location', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId, latitude: loc.lat, longitude: loc.lng, address_text: loc.addressText,
        event_date: loc.eventDate, start_time: loc.startTime, end_time: loc.endTime || null,
      }),
    });
  }
  for (const coEditorId of coEditorIds) {
    await supabaseRequest('event_co_editor', { method: 'POST', body: JSON.stringify({ event_id: eventId, bag_man_id: coEditorId }) });
  }

  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmed' }) };
};
```

Create `confirm-event.html` + `confirm-event.js`, following the same pattern as Phase 6's `confirm-registration.html`/`.js` (fetch the token from the query string, call the function, show a friendly status message — "Your event is now live on the map and calendar!" / "This link has expired or already been used." / "This event no longer exists.").

## Step 6 — "Manage my existing events"

Create `netlify/functions/request-manage-events.js`:

```js
// plan §6.2 point 2, rate-limited per plan §8. Emails one message
// listing every current/upcoming event the bag-man owns (with a fresh
// edit link AND delete link each) or co-edits (edit link only — §9.6/§9.8
// reserve delete/co-editor changes for the owner).
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');

const RATE_LIMIT_MS = 5 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { email: rawEmail } = JSON.parse(event.body || '{}');
  const email = (rawEmail || '').trim().toLowerCase();

  const bagManRes = await supabaseRequest(`bag_man?email=eq.${encodeURIComponent(email)}&select=id,verified,retired,banned,last_manage_request_at`);
  const bagMan = (await bagManRes.json())[0];
  if (!bagMan || !bagMan.verified || bagMan.retired || bagMan.banned) {
    // Same "don't reveal anything" principle as check-bagman-email.js.
    return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };
  }
  if (bagMan.last_manage_request_at && Date.now() - new Date(bagMan.last_manage_request_at).getTime() < RATE_LIMIT_MS) {
    return { statusCode: 200, body: JSON.stringify({ status: 'rate-limited' }) };
  }
  await supabaseRequest(`bag_man?id=eq.${bagMan.id}`, { method: 'PATCH', body: JSON.stringify({ last_manage_request_at: new Date().toISOString() }) });

  const now = new Date().toISOString();
  const ownedRes = await supabaseRequest(
    `event?bag_man_id=eq.${bagMan.id}&select=id,morris_sides,location(event_date,start_time,end_time)`
  );
  const coEditedRes = await supabaseRequest(
    `event_co_editor?bag_man_id=eq.${bagMan.id}&select=event:event_id(id,morris_sides,location(event_date,start_time,end_time))`
  );
  const owned = (await ownedRes.json()).filter(hasFutureLocation);
  const coEdited = (await coEditedRes.json()).map((r) => r.event).filter(hasFutureLocation);

  const lines = [];
  for (const ev of owned) {
    const editToken = await issueAccessToken(ev.id, bagMan.id);
    const deleteToken = await issueDeleteToken(ev.id, bagMan.id);
    lines.push(`${ev.morris_sides.join(', ')}:\n  Edit: ${siteUrl()}/edit-event.html?token=${editToken}\n  Delete: ${siteUrl()}/delete-event.html?token=${deleteToken}`);
  }
  for (const ev of coEdited) {
    const editToken = await issueAccessToken(ev.id, bagMan.id);
    lines.push(`${ev.morris_sides.join(', ')} (you're a co-editor):\n  Edit: ${siteUrl()}/edit-event.html?token=${editToken}`);
  }

  if (lines.length === 0) {
    lines.push('You have no current or upcoming events.');
  }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL },
      to: [{ email }],
      subject: 'Your Where to See Morris Dancing events',
      textContent: `Here are fresh links for your events (each valid for 48 hours):\n\n${lines.join('\n\n')}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'sent-if-applicable' }) };

  function hasFutureLocation(ev) {
    return ev.location.some((l) => new Date(`${l.event_date}T${l.end_time || l.start_time}`) >= new Date(now));
  }
  function siteUrl() { return process.env.SITE_URL; }
  async function issueAccessToken(eventId, recipientId) {
    const token = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_edit', token, related_id: eventId, recipient_bag_man_id: recipientId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    return token;
  }
  async function issueDeleteToken(eventId, recipientId) {
    const token = crypto.randomUUID();
    await supabaseRequest('verification_token', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_delete', token, related_id: eventId, recipient_bag_man_id: recipientId, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
    });
    return token;
  }
};
```

Wire `manage-events-section`'s button in `add-events.js` to `POST` `{ email: checkedEmail }` to this function and show `data.status` as a friendly message (`sent-if-applicable` → "If that email is registered, check your inbox shortly."; `rate-limited` → "Please wait a few minutes before requesting this again.").

## Step 7 — Opening the edit form, and deleting an event

Create `netlify/functions/get-event-for-edit.js` (GET, `?token=`) — validates an `event_edit` token with `payload IS NULL` (an access token, not a staged confirmation — see Quick Concepts), marks it used, and returns the full event (locations, sides, description, co-editor emails) plus `isOwner` (`recipient_bag_man_id === event.bag_man_id`) and the bag-man's own email (needed by `event-form.js` to submit further actions, since it's this person's *own* identity being handed back to their own emailed session — not a public exposure).

Create `edit-event.html` + `edit-event.js`: reads `?token=` from the URL, calls `get-event-for-edit`, then calls `renderEventForm(container, { bagManEmail: data.email, existingEvent: { ...data, accessToken: token } })` from the shared `event-form.js` (Step 3) — the same form Step 3 already renders for new submissions, just prefilled, with the co-editor fields and "Delete this event" button only shown if `isOwner`.

Create `netlify/functions/request-event-delete.js` (POST, `{ accessToken }`) — looks up the `event_edit` token (used or not — see "A used access token can still prove identity" in Quick Concepts), confirms `recipient_bag_man_id === event.bag_man_id` (owner only, per [§9.8](plan_v001.md#98-deleting-an-event)), issues a fresh `event_delete` token, and emails the confirmation link with **explicit wording that this is permanent and cannot be undone**, per plan §9.8.

Create `netlify/functions/confirm-event-delete.js` (GET, `?token=`):

```js
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=eq.event_delete&select=*`);
  const tokenRow = (await tokenRes.json())[0];

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }
  const existsRes = await supabaseRequest(`event?id=eq.${tokenRow.related_id}&select=id`);
  if ((await existsRes.json()).length === 0) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-gone' }) };
  }

  // Cascades to location and event_co_editor automatically (Phase 2 FKs).
  await supabaseRequest(`event?id=eq.${tokenRow.related_id}`, { method: 'DELETE' });
  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  return { statusCode: 200, body: JSON.stringify({ status: 'deleted' }) };
};
```

Create `delete-event.html` + `delete-event.js` — same fetch-and-show-status pattern as `confirm-event.html`, with a plain "This event has been permanently deleted." success message.

## Step 8 — Bag-man retirement / handover (§9.9)

Create `netlify/functions/request-bagman-transfer.js` (POST, `{ email, successorEmail }`): looks up both bag-men (retiring must be `verified && !retired && !banned`; successor the same, and not the same person); inserts one `bag_man_transfer_request` row; creates **two** `bagman_retirement_transfer` tokens (`related_id` = the transfer request's id, `recipient_bag_man_id` = each party respectively, expiry **7 days** per [§9.9](plan_v001.md#99-bag-man-retirement--handover)); emails each party their own confirmation link, worded per their role (retiring vs successor, per plan §9.9's two example subject lines).

Create `netlify/functions/confirm-bagman-transfer.js` (GET, `?token=`):

```js
const { supabaseRequest } = require('./_supabase');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  const tokenRes = await supabaseRequest(`verification_token?token=eq.${encodeURIComponent(token)}&type=eq.bagman_retirement_transfer&select=*`);
  const tokenRow = (await tokenRes.json())[0];
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 200, body: JSON.stringify({ status: 'invalid-or-expired' }) };
  }
  await supabaseRequest(`verification_token?id=eq.${tokenRow.id}`, { method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString() }) });

  // Is the OTHER party's token (same transfer request) already used too?
  const otherRes = await supabaseRequest(
    `verification_token?type=eq.bagman_retirement_transfer&related_id=eq.${tokenRow.related_id}&id=neq.${tokenRow.id}&select=used_at`
  );
  const other = (await otherRes.json())[0];
  if (!other || !other.used_at) {
    return { statusCode: 200, body: JSON.stringify({ status: 'waiting-for-other-party' }) };
  }

  // Both confirmed — enact the transfer atomically.
  const transferRes = await supabaseRequest(`bag_man_transfer_request?id=eq.${tokenRow.related_id}&select=*`);
  const transfer = (await transferRes.json())[0];
  if (!transfer || transfer.completed_at) {
    return { statusCode: 200, body: JSON.stringify({ status: 'already-completed' }) };
  }

  const now = new Date().toISOString();
  // Only reassign events with at least one future/current location — past
  // events keep their original owner for accurate historical attribution.
  const eventsRes = await supabaseRequest(
    `event?bag_man_id=eq.${transfer.retiring_bag_man_id}&select=id,location(event_date,start_time,end_time)`
  );
  const events = (await eventsRes.json()).filter((ev) =>
    ev.location.some((l) => new Date(`${l.event_date}T${l.end_time || l.start_time}`) >= new Date())
  );
  for (const ev of events) {
    await supabaseRequest(`event?id=eq.${ev.id}`, { method: 'PATCH', body: JSON.stringify({ bag_man_id: transfer.successor_bag_man_id }) });
  }
  await supabaseRequest(`bag_man?id=eq.${transfer.retiring_bag_man_id}`, { method: 'PATCH', body: JSON.stringify({ retired: true }) });
  await supabaseRequest(`bag_man_transfer_request?id=eq.${transfer.id}`, { method: 'PATCH', body: JSON.stringify({ completed_at: now }) });

  // Completion emails to both parties (fetch their addresses to send to).
  const bothRes = await supabaseRequest(`bag_man?id=in.(${transfer.retiring_bag_man_id},${transfer.successor_bag_man_id})&select=id,email,side_name`);
  const both = await bothRes.json();
  const retiring = both.find((b) => b.id === transfer.retiring_bag_man_id);
  const successor = both.find((b) => b.id === transfer.successor_bag_man_id);
  const sendEmail = (to, subject, textContent) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Where to See Morris Dancing', email: process.env.WEBMASTER_EMAIL }, to: [{ email: to }], subject, textContent }),
  });
  await sendEmail(retiring.email, 'Handover complete', `Your events have been handed over to ${successor.side_name}. Thanks for your time as bag-man!`);
  await sendEmail(successor.email, 'You now own these events', `${events.length} event(s) from ${retiring.side_name} are now yours to manage — use "Manage my existing events" on Add events any time.`);

  return { statusCode: 200, body: JSON.stringify({ status: 'transfer-complete' }) };
};
```

Create `confirm-transfer.html` + `confirm-transfer.js` — same fetch-and-show-status pattern, with three distinct messages: `waiting-for-other-party` ("Thanks — we're waiting for the other person to confirm too."), `transfer-complete`, `invalid-or-expired`.

Wire `retire-form` in `add-events.js` to `POST` `{ email: checkedEmail, successorEmail }` to `request-bagman-transfer.js`.

## Step 9 — Test the whole loop on the live site

1. **New event**: submit a fresh event with 2 locations, 2 sides, 1 co-editor (use a second already-verified test bag-man's email) → confirm you get a confirmation email, and that the event does **not** yet appear on the map/calendar. Click the link → confirm it now appears on both, with both locations linked ("Also dancing at…") and the co-editor able to see it via their own "Manage my existing events".
2. **Duplicate check**: submit a new event within 50m/30min of the one just created → confirm the warning appears with the existing event's details, and that clicking "Submit anyway" proceeds normally.
3. **Edit via "Manage my existing events"**: request your links, open the edit link, change a location's time, save → confirm a *second* confirmation email arrives, and the map/calendar only update after clicking it.
4. **Co-editor rights**: open a co-editor's edit link for the same event → confirm the co-editor list and "Delete this event" button are **not** shown, but they can still edit sides/locations/description.
5. **Rate limiting**: click "Manage my existing events" twice within a few minutes → confirm the second attempt is refused.
6. **Delete**: from the owner's edit form, click "Delete this event" → confirm the email arrives with clear "permanent" wording, and clicking it removes the event (and its locations/co-editor rows) from the site entirely. Confirm a co-editor's still-outstanding edit link for that event now shows "this event no longer exists" if used afterwards.
7. **Retirement/handover**: submit a handover request → confirm **both** parties receive an email, that clicking only one shows "waiting for the other party", and that clicking both (in either order) completes the transfer, reassigns only future/current events, and sends both completion emails. Confirm the retired bag-man can no longer submit new events (`submit-event.js` returns 403) and no longer appears as a valid co-editor/successor option.

## Step 10 — Security review recap

- No `event`/`location`/`event_co_editor` row is ever created or changed except inside `confirm-event.js`/`confirm-event-delete.js`/`confirm-bagman-transfer.js` — never directly from `submit-event.js` or any other browser-facing call.
- `submit-event.js` re-validates the bag-man's `verified`/`retired`/`banned` status server-side on every call, never trusting the client's earlier "verified" check from Phase 6.
- Co-editor emails are only ever looked up and stored as internal bag-man IDs, never trusted as free text from the client into any table.
- A co-editor's submission always keeps the event's *existing* co-editor list and can never trigger deletion or a handover — enforced in `submit-event.js`/`request-event-delete.js`, not just hidden in the UI.
- Locations are bounds-checked against Oxfordshire server-side (plan §8), not just accepted from the client.
- The retirement/handover confirmation email always goes to each party's own registered address — never cross-sent — and the transfer only enacts once both are used.

## Checklist — Phase 7 Definition of Done

- [ ] Schema updated: `verification_token.payload`, `verification_token.recipient_bag_man_id`, `related_id` now nullable, `bag_man.last_manage_request_at`.
- [ ] `event-form.js` shared module built and used by both the new-event and edit-event screens.
- [ ] `submit-event.js`, `confirm-event.js`, `request-manage-events.js`, `get-event-for-edit.js`, `request-event-delete.js`, `confirm-event-delete.js`, `request-bagman-transfer.js`, `confirm-bagman-transfer.js` all created and deployed.
- [ ] `confirm-event.html`, `edit-event.html`, `delete-event.html`, `confirm-transfer.html` (+ their `.js` files) created.
- [ ] `add-events.html`'s verified-section rebuilt with the three real options.
- [ ] All seven checks in Step 9 pass on the live deployed site.
- [ ] Step 10's security recap re-checked against the actual committed code.

Phase 7 is complete once a real bag-man can submit, confirm, edit, delete, and hand over events end-to-end, with everything showing up correctly on the existing map (Phase 4) and calendar (Phase 5) views with no changes needed there. Phase 8 (Security hardening — rate limiting elsewhere, honeypot/CAPTCHA everywhere, the webmaster strike-off page) will be expanded into its own document once this phase is confirmed working.
