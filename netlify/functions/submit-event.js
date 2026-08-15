// Handles both new submissions and edits (plan §6.2 point 3-5). Never
// writes to event/location/event_co_editor directly — always stages the
// proposed data as a verification_token.payload and emails a confirmation
// link (Step 5 actually creates/updates rows). See "Nothing goes live
// until the email is clicked" in docs/phase7_event_submission_v001.md.
const crypto = require('crypto');
const { supabaseRequest } = require('./_supabase');
const { formatEventDetailsText } = require('./_event-details');

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
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number' || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      return validationError('Every location needs a map position.');
    }
    if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) {
      return validationError('Location has an invalid map position.');
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
        `${SITE_URL}/confirm-event.html?token=${token}\n\n` +
        `Event details:\n${formatEventDetailsText({ morrisSides, description, locations })}`,
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ status: 'confirmation-sent' }) };

  function validationError(message) {
    return { statusCode: 200, body: JSON.stringify({ status: 'validation-error', message }) };
  }
};
