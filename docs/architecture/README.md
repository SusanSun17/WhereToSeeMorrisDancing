# Architecture documentation

This folder explains **how the finished site actually works** — it's a reference for
understanding the current codebase, not a step-by-step build log. For that (the order things
were originally built in, with exact commands/SQL to run), see the numbered `phaseN_*_v001.md`
docs one level up in [docs/](../).

Read these roughly in order the first time; after that, jump to whichever one covers the part
you're touching.

| Doc | Covers |
|---|---|
| [00-overview_v001.md](00-overview_v001.md) | Whole-site tech stack, hosting, all six database tables, every environment variable, and how the pieces talk to each other |
| [01-static-content-and-contact_v001.md](01-static-content-and-contact_v001.md) | Home/Links pages and the Netlify Forms + Brevo contact form |
| [02-map-and-calendar_v001.md](02-map-and-calendar_v001.md) | The public "Find events" map (Leaflet) and calendar (FullCalendar) views |
| [03-bagman-registration_v001.md](03-bagman-registration_v001.md) | How a bag-man registers, gets approved by the webmaster, and gets verified |
| [04-event-submission-and-editing_v001.md](04-event-submission-and-editing_v001.md) | Submitting, confirming, editing, "manage my events", and deleting events |
| [05-bagman-retirement-handover_v001.md](05-bagman-retirement-handover_v001.md) | The two-sided retirement/handover flow between a retiring bag-man and their successor |
| [06-webmaster-strike-off_v001.md](06-webmaster-strike-off_v001.md) | The one-sided, admin-secret-gated flow for banning a bag-man for misuse |

## The one idea that repeats everywhere

Almost every write in this site — registering, publishing an event, editing one, deleting one,
handing over to a successor, striking one off — follows the same shape: a **`request-*`**
Netlify Function validates input and writes a row to the single `verification_token` table
plus emails a link; nothing else changes until a **`confirm-*`** step (reached by clicking
that link) looks the token up, checks it's real/unused/unexpired, does the actual database
write, and marks the token used. Docs 03–06 each show this pattern for their own flow;
[00-overview](00-overview_v001.md) explains why the site is built this way at all.
