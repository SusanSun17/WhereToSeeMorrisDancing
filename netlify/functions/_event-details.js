// Shared plain-text formatting for event details in bag-man emails, used
// by every function that emails someone about a specific event, so the
// wording (and the delete-link warning) can't drift between them —
// plan §6.2/§9.8 want every such email to show what event it's about and
// to spell out that deleting is irreversible.
function formatLocationLine(loc) {
  const time = loc.endTime ? `${loc.startTime}–${loc.endTime}` : loc.startTime;
  return `  - ${loc.eventDate} ${time}${loc.addressText ? ` @ ${loc.addressText}` : ''}`;
}

function formatEventDetailsText({ morrisSides, description, locations }) {
  const lines = [`Morris side(s): ${morrisSides.join(', ')}`];
  if (description) lines.push(`Description: ${description}`);
  lines.push('Location(s):', ...locations.map(formatLocationLine));
  return lines.join('\n');
}

// Supabase rows use snake_case columns; the rest of this codebase (the
// submit-event.js payload, event-form.js) uses camelCase — this converts
// DB rows to the shape formatEventDetailsText() expects.
function mapDbLocations(locations) {
  return locations.map((l) => ({
    eventDate: l.event_date,
    startTime: l.start_time,
    endTime: l.end_time,
    addressText: l.address_text,
  }));
}

const DELETE_WARNING = 'Clicking this link PERMANENTLY deletes the event and all its locations — this cannot be undone.';

module.exports = { formatEventDetailsText, mapDbLocations, DELETE_WARNING };
