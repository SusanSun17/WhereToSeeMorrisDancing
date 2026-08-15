# 04 — Submitting, editing, managing, and deleting events

Covers everything a bag-man does to their own events after they're verified (see
[03-bagman-registration](03-bagman-registration_v001.md)). Retirement/handover to a successor
is split out into [05](05-bagman-retirement-handover_v001.md) since it's a fairly separate
concern with its own two-sided confirmation.

## The shared shape

Every action here is a **`request-*`** step (validates input, writes a `verification_token`
row + emails a link, changes nothing else) followed by a **`confirm-*`** step (reached by
clicking that link; looks the token up, does the real database write, marks it used). This is
why so many small files exist — it's the same pattern repeated for new events, edits, and
deletes.

## File map

| Flow | Browser page (`.html`) | Browser script (`.js`, root) | Netlify function(s) |
|---|---|---|---|
| Submit a **new** event | `add-events.html` → `event-form-section` | `event-form.js` (shared), `add-events.js` | `submit-event.js` |
| Confirm new/edited event | `confirm-event.html` | `confirm-event.js` | `confirm-event.js` (function) |
| Request fresh edit/delete links | `add-events.html` → `manage-events-section` | `add-events.js` | `request-manage-events.js` |
| **Edit** an existing event | `edit-event.html` | `edit-event.js`, `event-form.js` (shared) | `get-event-for-edit.js`, then `submit-event.js`, then `confirm-event.js` |
| Request event deletion | (button inside the edit form) | `event-form.js` (shared) | `request-event-delete.js` |
| Confirm event deletion | `delete-event.html` | `delete-event.js` | `confirm-event-delete.js` |

`event-form.js` is the one file shared by two rows above — it renders the exact same
locations/sides/co-editors form whether it's blank (new event) or prefilled (edit), so the two
screens can never quietly drift apart from each other.

## Flow 1 — Submitting (or editing) an event

```mermaid
sequenceDiagram
    participant Browser as add-events.html / edit-event.html<br/>(event-form.js)
    participant Submit as submit-event.js
    participant DB as Supabase
    participant Brevo
    participant Confirm as confirm-event.html<br/>+ confirm-event.js (function)

    Browser->>Submit: POST bag-man email + proposed event
    Submit->>DB: validate bag_man (verified/not retired/not banned)
    Submit->>DB: duplicate check (§9.7, dry run)
    alt duplicate found & not overridden
        Submit-->>Browser: status: duplicate-warning (nothing written)
        Browser->>Submit: POST again, overrideDuplicateWarning: true
    end
    Submit->>DB: INSERT verification_token<br/>(type=event_publish or event_edit, payload = proposed event)
    Note over DB: event/location/event_co_editor untouched so far
    Submit->>Brevo: send confirmation email with link
    Submit-->>Browser: status: confirmation-sent

    Note over Brevo: bag-man clicks the link later
    Brevo->>Confirm: GET confirm-event.html?token=...
    Confirm->>Confirm: fetch /.netlify/functions/confirm-event?token=...
    Confirm->>DB: look up token, read payload
    alt type = event_publish
        Confirm->>DB: INSERT event row
    else type = event_edit (has payload)
        Confirm->>DB: UPDATE event, DELETE old location + event_co_editor rows
    end
    Confirm->>DB: INSERT new location row(s) + event_co_editor row(s)
    Confirm->>DB: mark token used_at
    Confirm-->>Brevo: "Your event is now live!"
```

## Flow 2 — "Manage my existing events" → edit → delete

```mermaid
sequenceDiagram
    participant Browser as add-events.html
    participant Req as request-manage-events.js
    participant DB as Supabase
    participant Brevo
    participant Edit as edit-event.html<br/>+ get-event-for-edit.js
    participant Del as request-event-delete.js
    participant DelConfirm as delete-event.html<br/>+ confirm-event-delete.js

    Browser->>Req: POST { email }
    Req->>DB: rate-limit check (bag_man.last_manage_request_at)
    Req->>DB: find owned events + co-edited events (future/current only)
    loop each owned event
        Req->>DB: INSERT event_edit token (payload=null, "access" token)
        Req->>DB: INSERT event_delete token
    end
    loop each co-edited event
        Req->>DB: INSERT event_edit token (payload=null)
    end
    Req->>Brevo: one email listing all edit + delete links
    Req-->>Browser: status: sent-if-applicable

    Note over Brevo: bag-man clicks an EDIT link
    Brevo->>Edit: GET edit-event.html?token=...
    Edit->>Edit: fetch get-event-for-edit?token=...
    Edit->>DB: validate event_edit token WHERE payload IS NULL
    Edit->>DB: mark token used_at, return event + isOwner + email
    Edit->>Edit: renderEventForm(..., existingEvent) [event-form.js]
    Note over Edit: prefilled form now follows Flow 1 (submit-event.js → confirm-event.js)<br/>when the bag-man saves changes

    Note over Edit: owner clicks "Delete this event" inside the form
    Edit->>Del: POST { accessToken } (re-uses the already-used access token, just to prove identity)
    Del->>DB: confirm recipient_bag_man_id === event.bag_man_id (owner only)
    Del->>DB: INSERT brand-new event_delete token
    Del->>Brevo: "this is PERMANENT" email
    Del-->>Edit: status: sent

    Note over Brevo: bag-man clicks the DELETE link (from either email)
    Brevo->>DelConfirm: GET delete-event.html?token=...
    DelConfirm->>DelConfirm: fetch confirm-event-delete?token=...
    DelConfirm->>DB: validate event_delete token
    DelConfirm->>DB: DELETE event row (cascades to location + event_co_editor)
    DelConfirm-->>Brevo: "permanently deleted"
```

## The relevant `verification_token` types

(See [00-overview](00-overview_v001.md) for the table's full schema, and
[05-bagman-retirement-handover](05-bagman-retirement-handover_v001.md) for the other two types.)

| `type` | `payload`? | Created by | Consumed by | Expiry | Notes |
|---|---|---|---|---|---|
| `event_publish` | yes (whole new event) | `submit-event.js` | `confirm-event.js` | 48h | `related_id` is null until confirmed — the event doesn't exist yet |
| `event_edit` (**access**) | **null** | `request-manage-events.js` | `get-event-for-edit.js` | 48h | Just proves "this email may open this event's form" |
| `event_edit` (**confirmation**) | yes (proposed edit) | `submit-event.js` | `confirm-event.js` | 48h | Same `type` as above, told apart by payload |
| `event_delete` | null | `request-manage-events.js` **or** `request-event-delete.js` | `confirm-event-delete.js` | 48h | Two different senders, same job |

## Two authorisation checks worth remembering

- **Owner vs co-editor** (`isOwner` in `get-event-for-edit.js`'s response, and the
  `existingEvent.bag_man_id === bagMan.id` check inside `submit-event.js`): decides whether
  `event-form.js` shows the co-editor list and "Delete this event" button at all, *and* is
  re-checked server-side on every submit — never trust the client's copy of `isOwner`.
- **A used access token can still answer "whose event is this?"** — `request-event-delete.js`
  looks up the (already-used) `event_edit` access token purely to read `recipient_bag_man_id`,
  not to re-authorise loading the form. This is why that lookup doesn't filter on `used_at`.
