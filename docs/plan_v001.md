
# Where to See Morris Dancing – Oxfordshire Pilot

## 1. Background & Problem Statement

There is nowhere online where an enthusiastic spectator of Morris dancing can find where and when Morris dancing events are happening. Numerous websites are maintained by individual Morris sides, but there is no single site where events are collected together and made searchable. The Morris Federation website has a map showing Morris sides' practice locations and lists regular festival dates, but it does not cover irregular, one-off events (e.g. a side turning up to dance outside a pub on a summer evening).

## 2. Goal

Build a website covering the county of Oxfordshire as a pilot study. It should let a **Spectator** find events on a map or a calendar, with event details submitted by **Morris bag-men** (the role within each Morris side responsible for organising events). If the pilot is successful, the approach could later be extended to other counties.

## 3. Constraints

- **Cost**: cheap, ideally free, to host and run.
- **Maintenance effort**: low — the webmaster is a volunteer with a day job. Automate wherever possible; avoid manual, recurring admin tasks.
- **Security**: bag-man email addresses must never be publicly exposed; only vetted bag-men can submit events; submissions and edits must be verified before going live.

## 4. Site Map (Pages)

| Page | Purpose |
| --- | --- |
| Home | Introduces the site, explains its purpose, links to the other pages |
| Find events | Hosts the map and calendar views for Spectators |
| Add events | Bag-man entry point for registering and submitting/editing events |
| Links | Alphabetical list of Oxfordshire Morris sides' websites, plus the Morris Federation and other useful sites |
| Contact us | Simple contact form emailing the webmaster |

## 5. User Roles

- **Spectator** — anonymous, general public visitor. Read-only.
- **Morris bag-man** — a vetted representative of a Morris side, authorised to submit and edit events for their side.
- **Webmaster** — the site owner/administrator (you). Vets bag-men, populates the Links page, handles queries, and keeps the system running.

## 6. Workflows

### 6.1 Spectator

1. Reads introductory info on the **Home** page.
2. Goes to **Find events**, and chooses one of two views:
   - **a. Find events by location** — an interactive map (Google Maps-style), centred on Oxfordshire, with a marker for every event. Markers are colour-coded: one colour for **future** events, another for **past** events (see [§9.1](#91-past-vs-future-marker-colours--archiving) for how this is implemented without any manual/scheduled maintenance).
   - **b. Find events on calendar** — a month view (Google/Outlook Calendar-style) defaulting to the current month with today's date highlighted. Events appear on their date. Spectators can browse forward up to 12 months ahead (and, implicitly, browse back to see recent past events — see archiving rules below).
3. Clicking a map marker or calendar entry opens an **event details** panel/modal: location (with a small embedded map or address), start–end time, the Morris side(s) performing, and the optional **description** entered by the bag-man. If an event has multiple locations (see [§9.2](#92-events-that-move-location-recommended-model)), sibling locations are listed too, so a Spectator can see the whole day's itinerary for that side.
4. **Nice-to-have**: a button to download the event as an `.ics` file (works with Outlook, Google Calendar, Apple Calendar, etc.) or an "Add to Google Calendar" link. This is low effort to add (`.ics` generation is a few lines of templated text) and is recommended as an early "nice-to-have", not a stretch goal.
5. Spectators may browse the **Links** page — Oxfordshire Morris sides listed alphabetically, followed by the Morris Federation and other relevant sites.
6. **Contact us** presents a form with an email address field and a message field (max 500 characters). On submission:
   - An email is sent to the webmaster with the message and reply-to address.
   - A copy/acknowledgement is emailed to the sender, thanking them and asking for patience, as the site is run by volunteers.
   - The form should be protected against spam/abuse (honeypot field or CAPTCHA, and basic rate limiting) — see [§8 Security](#8-security-considerations).

### 6.2 Morris Bag-man

1. Goes to **Add events** and first enters their email address.
2. The address is checked against the internally maintained list of verified bag-men:
   - **If it does not match** → shown a **registration form**: email address + short introductory message (side name, role, etc.). This is emailed to the webmaster for manual vetting (offline, e.g. checked against the list of bag-man contacts gathered at the outset — see [§6.3 Webmaster](#63-webmaster)).
     - If the webmaster approves, the bag-man receives a **verification email** containing a unique, single-use, expiring link.
     - Clicking the link adds their email to the internal verified list and shows a confirmation page inviting them to return to **Add events**.
   - **If it matches** → three options are offered:
     - **Submit a new event** — goes straight to a blank event submission form. No extra proof of identity is needed at this point, since nothing private is shown; identity is confirmed later at the publish step (point 5 below), exactly as for any new event.
     - **Manage my existing events** — a button that emails the bag-man's registered address a list of their current/future events, each as its own secure, single-use, expiring **edit link** (e.g. valid 48 hours) leading straight to that event's pre-filled edit form, plus a separate **delete link** per event (see [§9.8](#98-deleting-an-event)). This list includes both events they created and any events where they've been added as a **co-editor** by someone else (see [§9.6](#96-nominating-co-editors)). This solves the "lost the original edit email" problem: a fresh list can be emailed at any time just by re-entering the email and clicking the button again. (Rate-limit this button — e.g. once every few minutes per email address — so it can't be used to spam a bag-man's or co-editor's inbox.)
     - **Retiring? Hand over your events to someone else** — see [§9.9](#99-bag-man-retirement--handover).
3. The **event form** (whether starting fresh, or opened from an edit link) collects:
   - **Description**: optional free-text field (e.g. up to 300 characters), for anything not captured by the structured fields (parking notes, "look for the maypole", etc.).
   - **Location(s)**: type-ahead address search, then fine-tune by dragging a pin on a map.
   - **Date**: calendar date-picker.
   - **Start time**: 24-hour time picker.
   - **End time**: optional, same picker.
   - **Morris sides performing**: repeatable field — "Add another side?" up to 50, with the ability to remove any entry already added.
   - **Co-editors** (optional, up to 3): repeatable email-address field, letting the submitting bag-man share edit access to this event with up to 3 other registered bag-men — see [§9.6](#96-nominating-co-editors).
   - **Multiple locations/times for one event**: see recommended model in [§9.2](#92-events-that-move-location-recommended-model) — answers the open question raised below.
4. **Before any verification email is sent**, each newly added or moved location is checked for a likely duplicate against existing events already on the map/calendar — see [§9.7](#97-duplicate-event-detection). If a close match is found, the bag-man is shown the existing event's details and must explicitly confirm they want to proceed anyway, or go back and amend their submission.
5. On submission (new event or edit), a **verification email** is sent to the bag-man's registered address with a confirmation link, as a final "review before it goes live" safety net. Clicking it publishes the event (or the edit) to the public map/calendar. (This "submit → confirm by email" step guards against typos, mis-clicks, and confirms the request really came from the registered mailbox.)
6. ~~Open question: often events move from one location to another several times...~~ **Resolved** — see [§9.2](#92-events-that-move-location-recommended-model).
7. Every event therefore has **two independent routes to its edit form**: the edit link in its original publish-confirmation email (point 5), and a freshly emailed edit link obtained any time via "Manage my existing events" (point 2) — available to co-editors as well as the original submitter. Losing one no longer matters, since the other can always be requested again. Saving an edit triggers the same duplicate-check and email-confirmation steps before the live event is updated. Deleting an event (point 2's delete link) is a separate, one-way action — see [§9.8](#98-deleting-an-event).

### 6.3 Webmaster

1. **Bootstrapping**: obtain the email addresses of all Oxfordshire Morris sides' bag-men (starting with your own side's bag-man's contacts) to compile the initial internal verified list.
2. Create an impersonal webmaster email address (e.g. a free Google/Gmail account) rather than using a personal one.
3. Once a prototype is live, inform the gathered contacts of the plan, and reassure them that their email addresses will never be publicly visible or accessible.
4. Populate the **Links** page with Oxfordshire Morris sides, the Morris Federation, and other useful sites.
5. Ongoing duties (kept deliberately minimal):
   - Monitor the webmaster inbox.
   - Vet newly registered bag-men (offline, e.g. cross-checking against the compiled contact list) and approve/reject registration requests.
   - Reply to Spectator queries from the Contact form.
   - **Strike off a bag-man for misuse**, if ever needed — a rare, one-sided action requiring only the webmaster's own confirmation, which deletes all their events and blocks re-registration with the same email — see [§9.10](#910-webmaster-strike-off-banning-a-bag-man-for-misuse).
6. **Everything else should run automatically** — see [§9.1](#91-past-vs-future-marker-colours--archiving), which explains how marker-colour flipping and archiving old events require **no scheduled job or manual step at all**, removing what would otherwise be a recurring maintenance burden.
7. **Nice-to-have**: an archive/browse-history view, storage permitting (see [§10](#10-nice-to-have--future-enhancements)).

## 7. Data Model (High Level)

A relational schema is a natural fit. Rough shape (table → key fields):

- **BagMan**: id, side name, email (unique), verified (bool), retired (bool, default false — see [§9.9](#99-bag-man-retirement--handover)), banned (bool, default false — see [§9.10](#910-webmaster-strike-off-banning-a-bag-man-for-misuse)), created_at
- **VerificationToken**: id, type (`bagman_registration` / `event_publish` / `event_edit` / `event_delete` / `bagman_retirement_transfer` / `bagman_strike_off`), token (random, single-use), related_id, expires_at, used_at — one generic table backs every "click this link to confirm" step, including the "Manage my existing events" request, which simply (re-)issues a fresh `event_edit` (and `event_delete`) token and email per event
- **Event**: id, bag_man_id (the **owner** — can be reassigned by a retirement handover, [§9.9](#99-bag-man-retirement--handover)), morris_sides (array or join table, up to 50), description (optional, free text)
- **EventCoEditor**: id, event_id, bag_man_id (the co-editor, must already be a verified `BagMan`), created_at — join table, capped at 3 rows per event; gives edit access without owner-level rights (see [§9.6](#96-nominating-co-editors))
- **BagManTransferRequest**: id, retiring_bag_man_id, successor_bag_man_id, created_at, completed_at — tracks a pending retirement handover until *both* parties have confirmed (see [§9.9](#99-bag-man-retirement--handover)); two `VerificationToken` rows (one per party) point at one of these via `related_id`
- **Location**: id, event_id, latitude, longitude, address_text, date, start_time, end_time — one Event has one-or-more Locations (see §9.2)
- **ContactMessage** (optional to persist; could just be emailed and not stored): sender_email, message, created_at

Only `Event` + `Location` rows with a future or recent-past date (see §9.1) are ever shown publicly; everything else is filtered out at query time, not deleted. The one deliberate exception is explicit bag-man-requested deletion ([§9.8](#98-deleting-an-event)), which is a genuine, cascading hard delete — distinct from this passive, non-destructive archiving filter.

## 8. Security Considerations

- **Never expose bag-man email addresses** in any public API response, page source, or calendar export — store them server-side only and reference bag-men by internal ID.
- **Verification tokens**: use long, random, single-use, time-limited tokens (e.g. UUID v4 or signed JWT with short expiry) for registration, event publication, and edits — never guessable sequential IDs.
- **Input validation**: sanitise/validate all form input server-side (email format, date/time ranges, string lengths, coordinate bounds within Oxfordshire) — never trust client-side validation alone.
- **Rate limiting & spam protection**: add a honeypot field and a CAPTCHA (agreed — e.g. Cloudflare Turnstile, which is free) to the Contact form and registration form to deter bots; rate-limit submission endpoints.
- **"Manage my existing events" requests**: rate-limit this per email address (e.g. once every few minutes) so it can't be used to spam a bag-man's inbox; it should always email the *registered* address only, never display event details or edit links directly on screen to whoever typed the email.
- **Transport security**: serve the whole site over HTTPS (free via Let's Encrypt — most modern hosts, e.g. Vercel/Netlify, provide this automatically).
- **Least privilege**: the public-facing API should only ever be able to read published events and write pending submissions/messages — it should have no ability to read the bag-man table or alter verified status directly. Use database-level row-level security (RLS) if using a service like Supabase, or enforce this in your server-side code.
- **Secrets**: keep API keys (maps, email provider) in environment variables / hosting-provider secret storage, never committed to source control.
- **Co-editor trust boundary**: nominated co-editor addresses ([§9.6](#96-nominating-co-editors)) must already be verified bag-men — never email or grant edit access to an arbitrary address just because someone typed it into a form; this keeps the "only vetted bag-men" rule from being bypassed via the co-editor feature.
- **Deletion is irreversible**: unlike the passive archiving in §9.1, explicit event deletion ([§9.8](#98-deleting-an-event)) permanently removes data. The confirmation email must say so clearly, and only the event's owner (not a co-editor) can trigger it.
- **Retirement/handover confirmation**: the confirmation link for transferring events ([§9.9](#99-bag-man-retirement--handover)) must be emailed to the *retiring* bag-man's own registered address, never to the successor — this proves the handover request genuinely came from the retiring bag-man's mailbox.
- **Strike-off is the most privileged action in the system** ([§9.10](#910-webmaster-strike-off-banning-a-bag-man-for-misuse)): gated by a static admin secret known only to the webmaster (never committed to source control, sent as a header/bearer token, never a URL query string), and by a confirmation email sent only to the webmaster's own address — never to the bag-man being struck off. Treat the admin secret with the same care as any other API key.

## 9. Answers to Open Questions

### 9.1 Past vs. future marker colours & archiving

You don't need a scheduled job, cron task, or any manual step to "flip" marker colours or to hide old events — this can be computed **at read time** instead of being stored as state:

- When the map/calendar view is rendered, compare each Location's date/time to "now". Colour the marker/entry based on that comparison on the fly. There's nothing to update in the database as time passes.
- For the "remove events older than 2 months from the public map/calendar" rule, simply add a filter to the public query: `WHERE location_date >= now() - interval '2 months'`. The underlying data is **never deleted**, just excluded from the public-facing query — which means the "nice-to-have archive" feature (§10) is essentially free to add later, since the data is already there.

This removes an entire category of ongoing maintenance you were expecting to need.

### 9.2 Events that move location (recommended model)

Model this as **one Event with multiple Locations**, rather than separate linked events. Concretely:

- A bag-man submission form lets them add one or more **locations** to a single event — each with its own place, date, start time, and (optional) end time — using the same repeatable "add another / remove" pattern already planned for "Morris sides performing" (cap it at, say, 20 locations per event).
- Each Location gets its own marker on the map and its own entry on the calendar (so Spectators can find each stop of the day independently), but clicking any one of them shows the full itinerary for that Event — i.e. "also dancing today at: [other locations]" — with the shared list of Morris sides performing and the shared description.
- Editing is done at the Event level: from any emailed edit link — whether the original publish-confirmation one, or a fresh one requested via "Manage my existing events" (§6.2) — the whole event (all its locations) opens pre-filled, and they can add, remove, or amend any location, then re-verify by email as already planned.

This satisfies the "preferably, multiple locations and start times on one event" preference without needing a separate "link these events together" mechanism.

### 9.3 Do you need a database? Yes — and here are free options

Yes — you need somewhere to persist: the verified bag-man list, submitted/published events and their locations, and pending verification tokens. This data is relational, changes constantly, and must be queried in different ways (by date, by side, by location) — a database is the right tool, not flat files or spreadsheets, once you have registration/verification workflows involved.

Recommended, cost-conscious stack for a low-maintenance volunteer project (✅ marks what you've decided so far — all other options are kept below in case you need to revisit them):

| Concern | Recommendation | Why |
| --- | --- | --- |
| Hosting (site + serverless functions) | ✅ **Netlify** (free tier) — comparison in [§9.4](#94-vercel-vs-netlify) | Free HTTPS, generous free bandwidth/build minutes, deploys straight from a Git repo, serverless functions handle form submissions/verification emails without needing a separate server to maintain; built-in Forms feature reduces custom code for this project |
| Hosting alternative | Vercel (free tier) | Kept as a fallback, e.g. if the front end later moves to Next.js, or Netlify's free-tier terms/limits change |
| Database | ✅ **Supabase** (free tier, hosted Postgres) | Real SQL (easy to reason about the Event/Location relationship), Row-Level Security for the "never expose bag-man emails" rule, generous free tier — no login/session system is needed at all, since access is entirely via emailed single-use links (§6.2) |
| Database alternative | Neon (free tier, serverless Postgres) or Firebase/Firestore (free tier) | Kept as a fallback if Supabase's free-tier limits or pausing behaviour become a problem |
| Maps | ✅ **Leaflet.js + OpenStreetMap** tiles | Completely free, no API key or billing account needed at all (avoids any risk of accidentally incurring Google Maps charges); Nominatim (OSM) gives free address search/geocoding for the "start typing an address" flow |
| Maps alternative | Google Maps Platform | Kept as a fallback if Nominatim's autocomplete UX or rate limits prove too limiting |
| Calendar UI | ✅ **FullCalendar** (open-source JS library, MIT licence) | Purpose-built month/day calendar widget, free, handles the "highlight today / browse months ahead" requirement out of the box |
| Transactional email (verification links, contact form) | ✅ **Brevo** (free tier) — comparison in [§9.5](#95-resend-vs-brevo) | Only requires verifying a single sender email address (no domain/DNS needed) to send to arbitrary recipients — Resend was tried first but rejected non-account-owner recipients until a whole domain was verified, which this project doesn't have yet |
| Transactional email alternative | Resend | Kept as a fallback, e.g. if a custom domain is bought later and Resend's simpler developer-focused API becomes preferable |

One practical note on Supabase's (and similar serverless Postgres) free tier: projects can pause after a period of total inactivity (commonly ~1 week with no requests). A real site with any regular traffic won't hit this, but if traffic is very low early on, a trivial free scheduled ping (e.g. a GitHub Actions workflow, also free, calling a health-check endpoint once a day) keeps it awake — a one-time setup task, not ongoing manual effort.

### 9.6 Nominating co-editors

- Modelled as a small join table, `EventCoEditor` (event_id, bag_man_id), rather than storing raw email strings on `Event` — reusing the existing `BagMan` table means every co-editor is subject to the same vetting as any other bag-man, so no new trust boundary is introduced.
- When a bag-man enters up to 3 co-editor email addresses on the event form ([§6.2](#62-morris-bag-man) point 3), each is looked up against `BagMan.email`. Addresses that don't match a **verified**, non-retired bag-man are rejected inline (e.g. "This address isn't registered yet — ask them to register via Add events first, then add them as a co-editor.") — no email is ever sent to an unverified address purely for being nominated.
- Co-editors get full rights to edit event details and locations (via the same `event_edit` token/email flow, and the same "Manage my existing events" listing) but deliberately **cannot** change the co-editor list, delete the event, or trigger an ownership transfer — only the event's owner (`Event.bag_man_id`) can do those. This bounds how much a single nominated co-editor can affect the event.
- The cap of 3 is enforced server-side (reject a 4th with a clear error), not just in the form UI.

### 9.7 Duplicate event detection

- Runs as a validation step in the server-side function handling event submission, **before** any `event_publish` verification email is sent ([§6.2](#62-morris-bag-man) point 4) — never after.
- For each location being added, query existing `Location` rows (excluding other locations belonging to the *same* event being submitted/edited — one event's own stops can legitimately be close together) for any row where:
  - the distance between the two lat/lon pairs is **≤ 50 metres** — cheap to compute with the haversine formula in the function; Oxfordshire's small size means this is accurate enough without needing to enable the PostGIS extension, and
  - the two start times, on the same date, are **within 30 minutes** of each other.
- If a match is found, the submission isn't rejected outright — the bag-man sees the matching event's details (side(s), location, date/time, description) inline with a warning ("This looks similar to an existing event — is this a duplicate?") and a button to confirm they want to proceed anyway. Only on that explicit override, or when no match is found, does the flow continue to the verification email step.
- No new table is needed — this is a read-only query against the existing `Location` table at submission time, in the same spirit as the read-time filtering already used for §9.1.

### 9.8 Deleting an event

- A new `VerificationToken` type, `event_delete`, mirrors `event_edit`: the same single-use, expiring token pattern, pointing at a different action.
- Reachable as a second link per event from "Manage my existing events" ([§6.2](#62-morris-bag-man) point 2), clearly distinct from the edit link (e.g. a red "Delete this event" link vs. the usual "Edit this event" link), and also offered as a "Delete this event instead" button from within the edit form itself — either path emails the same delete-confirmation link.
- The confirmation email states plainly, right next to the link, that clicking it **permanently deletes the event and cannot be undone** — this is a genuine, cascading hard delete (removing its `Location` and `EventCoEditor` rows too), not the passive archiving described in §9.1, which only ever hides old events from public queries and never removes rows. A destructive, bag-man-requested action needs its own unambiguous warning, distinct from that automatic behaviour.
- Only the event's **owner** (`Event.bag_man_id`) can request deletion — not a co-editor ([§9.6](#96-nominating-co-editors)) — since it's irreversible and co-editors are intentionally given a narrower set of permissions.
- If an event is deleted, any other outstanding `event_edit` or `event_delete` tokens referencing it become harmless no-ops: the server-side function checks the event still exists before acting, showing a friendly "this event no longer exists" page if not.

### 9.9 Bag-man retirement / handover

- A new small table, `BagManTransferRequest` (retiring_bag_man_id, successor_bag_man_id, created_at, completed_at), tracks a handover while it's waiting on both parties — a single `VerificationToken` can only record one confirmation, so this table is where the pair and the outcome are recorded. A new `retired` boolean column is also added to `BagMan` (default `false`).
- Reached from **Add events**, alongside "Submit a new event" and "Manage my existing events" ([§6.2](#62-morris-bag-man) point 2), as a third option: "Retiring? Hand over your events to someone else."
- The retiring bag-man enters the successor's email address. It must already match a **verified**, non-retired `BagMan` row (same rule as co-editors, §9.6) — if it doesn't, they're told the successor needs to register via Add events first.
- Submitting creates one `BagManTransferRequest` row and sends **two separate confirmation emails at once**, each with its own single-use expiring `bagman_retirement_transfer` token pointing at that same request:
  - to the **retiring bag-man's own** registered address — "Confirm you want to hand over your events to [successor's side name]";
  - to the **successor's** registered address — "[Retiring bag-man's side name] wants to hand their events over to you — confirm you're willing to take them on".
- Clicking either link records that party's confirmation and shows a "Thanks — waiting for the other person to confirm too" page if the other party hasn't clicked yet. Nothing changes on the site at this point.
- The transfer is only enacted once **both** links have been clicked — whichever confirmation lands second is the one that actually triggers it, atomically:
  - Every `Event` owned by the retiring bag-man that has at least one **future or current** location (same date comparison as §9.1) has its `bag_man_id` updated to the successor. Events that are entirely in the past keep their original owner, preserving accurate historical attribution.
  - The retiring bag-man's row is marked `retired = true` rather than deleted, so past events' `bag_man_id` foreign key stays valid and historical data remains intact.
  - A retired bag-man can no longer submit new events, be added as a co-editor, or be nominated as a transfer successor (the email lookups in §6.2 point 2, §9.6, and this section all treat `retired = true` the same as "not verified"), but their historical events remain visible exactly as before.
  - Both parties get a short completion email once the transfer goes through — the retiring bag-man that it's done, the successor a list of the events now theirs.
- Tokens get a longer expiry than the usual 48 hours (e.g. 7 days), since this now depends on two people acting, not one. If either link isn't clicked in time, the request simply lapses with no changes made, and the retiring bag-man can start again from **Add events**.
- Requiring both confirmations closes the mistyped-/misremembered-email edge case outright, since the named successor always has to actively agree before anything transfers — not just already being a verified bag-man.

### 9.10 Webmaster strike-off (banning a bag-man for misuse)

- A deliberately **one-sided** action, distinct from every other verification flow in this plan: it is entirely the webmaster's decision, and needs no confirmation from the bag-man being struck off, nor from anyone else — only from the webmaster themself (as a safety net against a mis-click, not a second opinion).
- No login/session system exists anywhere else in this design (§9.3), and this shouldn't be the exception that forces one in. Instead, add a single unlisted admin page (e.g. `admin-strike-off.html`, not linked from navigation) that posts to a serverless function guarded by a static **admin secret** (an environment variable known only to the webmaster, sent as a bearer token/header — never a URL query string, which can leak via browser history or server logs). This mirrors the "no accounts, just secrets and single-use links" philosophy already used everywhere else, at the smallest possible cost.
- Flow:
  1. Webmaster enters the admin secret and the target bag-man's email into the admin page.
  2. The function checks the secret, looks up the `BagMan` row and every `Event` they own (with dates, sides, locations), and — as requested — emails this list to the **webmaster's own** address (never the bag-man's) with a single-use, expiring confirmation link (a new `VerificationToken` type, `bagman_strike_off`). This gives the webmaster a last "are you sure, here's what will be deleted" check, exactly like the "review before it goes live" pattern already used for event publish/edit.
  3. Clicking the confirmation link performs the strike-off atomically:
     - Hard-deletes every `Event` owned by the bag-man (cascading their `Location` and `EventCoEditor` rows) — a full, irreversible removal, not the passive archiving of §9.1, since these events are considered tainted rather than simply historical.
     - Removes any `EventCoEditor` rows where the struck-off bag-man is listed as *someone else's* co-editor (they lose edit access to other people's events too, but those events themselves are untouched).
     - Cancels any pending `BagManTransferRequest` involving them (as either retiring bag-man or successor), and invalidates any of their outstanding `VerificationToken` rows.
     - Sets a new `banned` boolean (default `false`) on their `BagMan` row to `true`, rather than deleting the row — the row (and its unique email constraint) must persist precisely so the email can never be reused for a fresh registration.
- Re-registration is blocked at the existing email-lookup step ([§6.2](#62-morris-bag-man) point 2): if the matched row has `banned = true`, show the **same** "email not recognised — here's a registration form" screen a genuinely new bag-man would see (don't reveal they're banned — this avoids inviting argument/harassment and doesn't confirm to a bad actor which email address tripped the ban). The registration-submission handler, however, checks for `banned = true` first and silently drops the request rather than forwarding it to the webmaster for vetting — so a struck-off individual can retry forever and simply never get anywhere, without generating noise in the webmaster's inbox.
- Unlike retirement (§9.9), there is no historical-attribution concern here, since every event owned by a struck-off bag-man is deleted outright — there's nothing left needing a valid `bag_man_id` to point at.
- This is the single most destructive action in the whole system (irreversible, no second party's consent needed), so it deliberately has the highest bar to trigger by accident: a secret only the webmaster holds, plus the webmaster's own follow-up email click.

### 9.4 Vercel vs Netlify

**Decided: Netlify**, for the initial attempt (kept here for reference in case Vercel is worth revisiting later). Both are "Jamstack" hosts built around the same idea: connect a Git repository, get automatic HTTPS, a global CDN, preview deployments per pull request, and serverless functions for form handling — either fully satisfies this project's cost and security constraints, so this is mostly a matter of developer experience.

| | Vercel | Netlify |
| --- | --- | --- |
| Origins / best fit | Made by the creators of Next.js; smoothest, zero-config experience if the front end is built with Next.js | Framework-agnostic from the start; equally happy with any static site generator or plain HTML/JS |
| Built-in extras | Image optimisation, Edge Middleware | **Forms** — submissions from a plain HTML `<form>` are captured automatically without writing a serverless function; could handle the Contact-us form (and possibly bag-man registration) with **less custom code**, which fits the "low effort to maintain" goal well |
| Free tier | Generous bandwidth/build minutes for personal/hobby projects | Similar generous free tier for personal/hobby projects |
| Serverless functions | Vercel Functions (Node/Edge runtimes) | Netlify Functions (Node, on AWS Lambda under the hood) |
| Custom domain + HTTPS | Free | Free |

**Practical takeaway**: if you're not committed to Next.js, Netlify's built-in Forms feature is a genuine low-effort win for two of your five forms (Contact us, and possibly bag-man registration). If you'd rather use Next.js for its developer experience, Vercel is the more natural home. Either is a safe, free choice at this project's scale — worth just picking one, deploying a "hello world", and moving on rather than over-analysing further. (Free-tier terms for both do change periodically, so it's worth a quick check of current limits/terms on their pricing pages before committing.)

### 9.5 Resend vs Brevo

**Decided: Brevo** — reversed from an initial choice of Resend, after a live test in Phase 3 hit a real blocker (kept here for reference in case Resend is worth revisiting later, e.g. if a custom domain is bought). Both can send the transactional emails this project needs (registration approval, magic-link sign-in, event publish/edit confirmation, contact-form copy).

| | Resend | Brevo (formerly Sendinblue) |
| --- | --- | --- |
| Scope | Purpose-built transactional email API/SMTP — does one thing well | All-in-one platform: transactional email **plus** marketing email/SMS/CRM-lite features, which this project doesn't need |
| Developer experience | Simple modern API/SDKs; supports building email templates as React components if using a JS/React stack | Traditional API/SMTP plus a web dashboard for building templates without code and viewing send logs |
| **Sending to arbitrary recipients without a custom domain** | **Blocking issue found in practice:** the shared `onboarding@resend.dev` sender only allows sending to the email address the Resend account itself was signed up with — confirmed by a live 403 `validation_error` in Phase 3. A verified domain (DNS records) is required before it can email anyone else, e.g. the webmaster or a real contact-form sender | Only requires verifying a **single sender email address** (a confirmation link, no DNS/domain setup) before it can send to any recipient — works for this project's "no custom domain yet" situation |
| Free tier | Historically around 3,000 emails/month (~100/day) | Historically a higher daily cap (~300/day), but monthly volume can be lower depending on current plan terms; free tier adds a small "Sent with Brevo" footer to outgoing emails |
| Non-developer visibility | Minimal — logs are mainly for developers via the dashboard/API | Dashboard is more approachable for a non-developer webmaster wanting to glance at what's been sent |

**Practical takeaway**: Resend looked like the simpler, more purpose-fit tool on paper, but its recipient restriction for unverified accounts makes it unusable for this project until a custom domain is bought — a real test in Phase 3 confirmed this with a 403 error emailing both the webmaster and a real sender address. Brevo's single-sender verification (no domain needed) is a better match for a volunteer project without a domain yet. Worth revisiting Resend if a custom domain is ever purchased, since sending is a small, isolated piece of code that can be swapped out without affecting the rest of the architecture.

## 10. Nice-to-have / Future Enhancements

- Add-to-calendar (`.ics` download / "Add to Google Calendar" link) — recommended to build early; it's low effort given §9.1's read-time filtering approach means data is always available.
- Archive/browse-history view of past events beyond the 2-month public window — trivial to add later since nothing is deleted (§9.1), only a matter of building the extra page/query and deciding how far back to allow browsing.
- Expansion beyond Oxfordshire to other counties, if the pilot succeeds.
- Simple analytics (e.g. free-tier privacy-friendly analytics like Plausible or Cloudflare Web Analytics) to see how many Spectators are actually using the site.

## 11. Open Risks / Decisions Still Needed

- **Initial stack chosen**: Netlify + Resend + Supabase + Leaflet/OpenStreetMap + FullCalendar, all on free tiers. Vercel and Brevo remain documented as fallbacks (§9.4, §9.5) in case free-tier limits or terms become a problem later.
- Confirm current free-tier terms for Netlify and Resend just before committing, since limits and conditions do change over time.
- **Data retention**: no decision needed yet — nothing is deleted under the current design (§9.1 only filters old events out of public *views*, it doesn't remove rows), except explicit bag-man-requested event deletion (§9.8), which is a genuine hard delete by design. Monitor actual storage/row growth on Supabase's free tier over the first months of real use, then decide whether further deletion (or a paid tier) is ever needed. This also keeps the "nice-to-have archive" (§10) available by default for as long as the data is kept.
- **Phase 2 schema needs revisiting**: [phase2_database_v001.md](phase2_database_v001.md) was written before the co-editor, delete, retirement/handover, and webmaster strike-off edge cases (§9.6–§9.10) were decided. Before Phases 6–7 are built, that document (and, if already applied, the live Supabase schema) will need the `EventCoEditor` and `BagManTransferRequest` tables, the `retired` and `banned` columns on `bag_man`, and the three new `verification_token` types (`event_delete`, `bagman_retirement_transfer`, `bagman_strike_off`) added.

## 12. Phased Implementation Plan

The build is broken into phases, each ending with something concrete and demonstrably working, so progress is visible and each phase can be tested before moving to the next.

1. **Foundations** — set up the dev environment and accounts (GitHub, Netlify), and deploy a minimal 5-page static site skeleton (Home, Find events, Add events, Links, Contact us — stub content only) to prove the whole hosting pipeline works end-to-end, including free HTTPS. *Fully expanded in [phase1_foundations_v001.md](phase1_foundations_v001.md).*
2. **Database & data model** — create the Supabase project; create the `BagMan`, `VerificationToken`, `Event`, and `Location` tables from §7; apply Row-Level Security policies so the public API can never read bag-man emails; confirm the site can connect and run a test query. *Fully expanded in [phase2_database_v001.md](phase2_database_v001.md).*
3. **Static content pages** — build out the real Home, Links (Oxfordshire sides + Morris Federation), and Contact us pages; wire up the Contact form (Netlify Forms + spam protection) to send a webmaster email and a sender acknowledgement via Resend. *Fully expanded in [phase3_static_content_v001.md](phase3_static_content_v001.md).*
4. **Find events — map view** — integrate Leaflet.js + OpenStreetMap tiles on the Find events page; load events from Supabase; colour-code markers by comparing each Location's date to "now" at read time (§9.1) — no scheduled job needed.
5. **Find events — calendar view** — integrate FullCalendar on the same page; same data source as the map; month navigation, today highlighted, browse up to 12 months ahead.
6. **Bag-man registration & verification** — build the "enter your email" check on Add events, the registration form for unrecognised emails, the webmaster vetting step, and the Resend verification email with a single-use expiring link that adds the bag-man to the verified list. Also implement the `banned` check at this step (§9.10), so struck-off emails are silently refused rather than being offered registration.
7. **Event submission & editing** — build the full event form (description, multi-location, multi-side, and up to-3-co-editor repeatable fields, per §9.2 and §9.6), the duplicate-event warning check (§9.7), the publish-confirmation email step, the "Manage my existing events" flow that (re-)issues fresh single-use edit and delete links, event deletion (§9.8), and bag-man retirement/handover (§9.9).
8. **Security hardening** — add rate limiting to the Contact form and "Manage my existing events" button; add honeypot/CAPTCHA (Cloudflare Turnstile) everywhere user input is accepted; review server-side input validation and RLS policies; audit that no secrets are committed to source control. Build the webmaster-only strike-off admin page and function (§9.10), protected by the admin secret.
9. **Nice-to-haves** — `.ics` download / "Add to Google Calendar" links on event details; an archive/browse-history view of past events; privacy-friendly analytics (Plausible or Cloudflare Web Analytics).
10. **Content population, bag-man outreach & soft launch** — bootstrap the verified bag-man list from gathered contacts, fully populate the Links page, invite real bag-men to start submitting events, and monitor the live site.

Each phase after Phase 1 will be expanded into its own detailed step-by-step document, in the same style as [phase1_foundations_v001.md](phase1_foundations_v001.md), once the preceding phase is complete.
