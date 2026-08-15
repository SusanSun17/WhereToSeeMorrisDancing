# 05 — Bag-man retirement / handover

The only **two-sided** confirmation in the site — nothing happens until *both* the retiring
bag-man and their named successor have clicked their own link. Split out from
[04-event-submission-and-editing](04-event-submission-and-editing_v001.md) since it's a
fairly separate concern (it touches `bag_man`/`bag_man_transfer_request`, not `event` directly,
until the very last step).

## Files involved

| Step | Browser page | Browser script | Netlify function |
|---|---|---|---|
| Request handover | `add-events.html` → `retire-section` | `add-events.js` | `request-bagman-transfer.js` |
| Confirm handover (either party) | `confirm-transfer.html` | `confirm-transfer.js` | `confirm-bagman-transfer.js` |

## Flow

```mermaid
sequenceDiagram
    participant Browser as add-events.html
    participant Req as request-bagman-transfer.js
    participant DB as Supabase
    participant Brevo
    participant ConfirmA as confirm-transfer.html<br/>(retiring bag-man's link)
    participant ConfirmB as confirm-transfer.html<br/>(successor's link)
    participant Fn as confirm-bagman-transfer.js

    Browser->>Req: POST { email, successorEmail }
    Req->>DB: validate both bag-men (verified, not retired/banned, different people)
    Req->>DB: INSERT bag_man_transfer_request row
    Req->>DB: INSERT 2x bagman_retirement_transfer tokens (7-day expiry),<br/>one per party, both pointing at the same request via related_id
    Req->>Brevo: email retiring bag-man (mentions successor by EMAIL)
    Req->>Brevo: email successor (mentions retiring party by EMAIL)

    Note over Brevo: either party can click first
    Brevo->>ConfirmA: GET ?token=... (party 1)
    ConfirmA->>Fn: confirm-bagman-transfer?token=...
    Fn->>DB: mark party 1's token used_at
    Fn->>DB: check party 2's token — not used yet
    Fn-->>ConfirmA: status: waiting-for-other-party

    Brevo->>ConfirmB: GET ?token=... (party 2)
    ConfirmB->>Fn: confirm-bagman-transfer?token=...
    Fn->>DB: mark party 2's token used_at
    Fn->>DB: check party 1's token — already used!
    Fn->>DB: reassign each future/current event.bag_man_id to successor
    Fn->>DB: mark retiring bag_man.retired = true
    Fn->>DB: mark bag_man_transfer_request.completed_at
    Fn->>Brevo: completion email to both
    Fn-->>ConfirmB: status: transfer-complete
```

## Why by email, not side name

Emails and status messages always refer to the other party by their **email address**, never
`bag_man.side_name` — a retiring bag-man and their successor are very often from the *same*
side, so "your events have been handed over to Abingdon Traditional Morris" would be confusing
or plain wrong when the successor is also Abingdon Traditional Morris. `bag_man` has no
personal name column, only `side_name` and `email`, so email is the only individually-identifying
field available.

## Why only future/current events move

`confirm-bagman-transfer.js` only reassigns `event.bag_man_id` for events with at least one
`location` whose `event_date`/`end_time` (or `start_time` if no end time) is still in the
future — past events keep their original owner, for accurate historical attribution on
whoever actually ran that event.

## The `verification_token` type used here

(Full schema in [00-overview](00-overview_v001.md); the other four types are in
[04-event-submission-and-editing](04-event-submission-and-editing_v001.md).)

| `type` | `payload`? | Created by | Consumed by | Expiry | Notes |
|---|---|---|---|---|---|
| `bagman_retirement_transfer` | null | `request-bagman-transfer.js` | `confirm-bagman-transfer.js` | **7 days** (longer than the 48h event tokens, since it needs two separate people to act) | Issued in pairs — one row in `bag_man_transfer_request`, two tokens, both sharing `related_id` |
