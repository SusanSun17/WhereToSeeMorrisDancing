# Phase 2 – Database & Data Model: Supabase, Tables & Row-Level Security

This document expands **Phase 2** from [plan_v001.md](plan_v001.md) (§12) into exact, no-assumptions steps, continuing on from [phase1_foundations_v001.md](phase1_foundations_v001.md). It still assumes **no web design or database experience** — every SQL command and every click is spelled out, and a few core concepts are explained in plain English before you use them.

## A note on cost

Supabase's free tier is used throughout, no credit card required (as already noted in [plan_v001.md §9.3](plan_v001.md#93-do-you-need-a-database-yes--and-here-are-free-options)). One quirk worth knowing up front: a free Supabase project can **pause itself after about a week of zero activity**. While you're actively working through this phase that won't happen. Once the site is live and gets any regular traffic later it also won't happen. A tiny free "keep it awake" scheduled ping (a GitHub Actions workflow) is a good idea eventually, but that's deferred to Phase 8 (Security hardening) — not needed yet.

## Goal / Definition of Done

By the end of this phase you will have:

- A free Supabase account and project, in a UK/EU region.
- The six tables from [plan_v001.md §7](plan_v001.md#7-data-model-high-level) created: `bag_man`, `verification_token`, `event`, `event_co_editor`, `bag_man_transfer_request`, `location` — the last two are new additions covering the co-editor ([plan §9.6](plan_v001.md#96-nominating-co-editors)) and retirement/handover ([plan §9.9](plan_v001.md#99-bag-man-retirement--handover)) edge cases decided after this document was first written.
- `bag_man` also has a `banned` column, and `verification_token` accepts a `bagman_strike_off` type — added after this document was first written, covering the webmaster strike-off flow ([plan §9.10](plan_v001.md#910-webmaster-strike-off-banning-a-bag-man-for-misuse)).
- Row-Level Security (RLS) turned on for all six tables, with policies that let anyone read `event` and `location` data, but **nobody** — not even a logged-out visitor using the public API key — can read `bag_man`, `verification_token`, `event_co_editor`, or `bag_man_transfer_request`. With "Automatically expose new tables" turned off at project creation, those four tables also have **no Data API privileges granted at all**, a second, independent lock alongside RLS. This is the technical implementation of the "never expose bag-man email addresses" rule from [plan_v001.md §8](plan_v001.md#8-security-considerations) — it extends naturally to the two new tables since both reference `bag_man` rows.
- Proof that it all actually works: some test data inserted, and a small throwaway test page that connects from a real browser and confirms events can be read while bag-man data is blocked.

No web pages change yet, and nothing is wired into the real site pages — that starts in Phase 3 (static content pages) and Phase 4 (map view). This phase is purely about getting the database itself built and proven, safely, before anything depends on it.

## Quick concepts (skip if familiar)

- **Database / table / row / column**: a database is a collection of tables, like tabs in a spreadsheet. Each table has fixed **columns** (e.g. `email`, `verified`) and any number of **rows** (one row = one bag-man, one event, etc.).
- **SQL**: the language used to create tables and query/insert data. You'll paste ready-made SQL commands into a box in Supabase — you don't need to already know SQL, just follow along.
- **Primary key**: a unique ID for every row, so it can be referred to unambiguously (e.g. from another table). We use `id` columns that Postgres fills in automatically with a random unique value (a "UUID").
- **Foreign key**: a column in one table that points at the primary key of a row in another table — e.g. every `event` row points at the `bag_man` row that submitted it, via `bag_man_id`.
- **Row-Level Security (RLS)**: a Postgres feature where, once switched on for a table, **no row is readable or writable by anyone unless you explicitly write a policy allowing it**. This is exactly the safety net the plan calls for: turn it on for every table, then only add a "the public can read this" policy for the two tables that are meant to be public (`event`, `location`). `bag_man` and `verification_token` get RLS turned on and **no policies at all**, which means the public API key can never read them, full stop.

## Step 1 — Create your Supabase account and project

1. Go to https://supabase.com and click **"Start your project"**. Sign up with GitHub (same account as Netlify — SusanSun17) to keep everything linked to one login.
2. Click **"New project"**.
3. If asked to create an **organisation** first, give it any name (e.g. "Where to See Morris Dancing") and keep it on the free plan.
4. Fill in the new project form:
   - **Name**: `wheretoseemorrisdancing` (or similar).
   - **Database password**: click "Generate a password" or set your own strong one. **Save it immediately somewhere safe (a password manager) — you will need it later if you ever connect a different tool directly to the database, and Supabase won't show it to you again.** You won't need to type it during this phase itself, since everything is done through the web dashboard.
   - **Region**: choose the option closest to the UK — usually **"West EU (London)"**; if not offered, **"EU West (Ireland)"** is the next best choice. This keeps the database physically close to your Oxfordshire users.
   - **Pricing plan**: leave on **Free**.
   - If offered these three toggles:
     - **Enable Data API** (ticked by default) — **leave it on.** This is the auto-generated REST endpoint (`supabase-js` uses it); without it the site has no way to read `event`/`location` at all.
     - **Automatically expose new tables** (ticked by default — Supabase's own hint text next to it says "we recommend disabling this to control access manually") — **turn it off**, matching the "least privilege" rule in [plan §8](plan_v001.md#8-security-considerations). With it off, a newly created table gets **no** Data API privileges until explicitly granted, so Step 4 below adds an explicit `grant select` for just `event` and `location`; the other four tables are left with no privileges at all, as a second, independent lock alongside RLS.
     - **Enable automatic RLS** (off by default — it installs a database event trigger that auto-runs `enable row level security` on every new table) — **turn it on.** Step 4 below already enables RLS on all six tables explicitly, so this is redundant today, but it's a free safety net for any table added later and forgotten, fitting this project's "automate security, don't rely on remembering" approach.
5. Click **"Create new project"**. It takes a minute or two to provision — wait for the dashboard to finish loading.

## Step 2 — A 30-second tour of the dashboard

You'll only use two sections in this phase, both in the left sidebar:

- **Table Editor** — a spreadsheet-like view of your tables, useful for glancing at data later.
- **SQL Editor** — a box where you paste SQL commands and click "Run". This is where Steps 3–5 happen.

(You'll visit **Project Settings → API** in Step 6 for the connection details.)

## Step 3 — Create the six tables

Click **SQL Editor** in the sidebar → **"New query"**. Paste in the following, exactly as shown, then click **Run**:

```sql
-- Bag-men: the vetted Morris side representatives who submit events.
-- Never readable by the public API — see the RLS policies in Step 4.
-- `retired` supports the retirement/handover flow (plan §9.9): a retired
-- bag-man can no longer submit events, be a co-editor, or be nominated as
-- a transfer successor, but their past events keep their bag_man_id intact.
create table bag_man (
  id uuid primary key default gen_random_uuid(),
  side_name text not null,
  email text not null unique,
  verified boolean not null default false,
  retired boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

-- One generic table backs every "click this link to confirm" step:
-- bag-man registration, publishing a new event, editing an existing one,
-- deleting an event (plan §9.8), and the two-sided retirement handover
-- (plan §9.9, one token per party, both pointing at the same
-- bag_man_transfer_request row via related_id).
-- Never readable by the public API either.
create table verification_token (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bagman_registration', 'event_publish', 'event_edit', 'event_delete', 'bagman_retirement_transfer', 'bagman_strike_off')),
  token text not null unique,
  related_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- An Event is one day/itinerary submitted by a bag-man (the owner). It can
-- have several Locations (see below) if the side moves around during the
-- day. Ownership (bag_man_id) can be reassigned by a retirement handover.
create table event (
  id uuid primary key default gen_random_uuid(),
  bag_man_id uuid not null references bag_man(id) on delete cascade,
  morris_sides text[] not null,
  description text check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);

-- Up to 3 co-editors per event (plan §9.6): other verified bag-men who can
-- edit this event's details/locations, but can't change this list, delete
-- the event, or trigger a handover — only the owner can do those.
-- Never readable by the public API.
create table event_co_editor (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  bag_man_id uuid not null references bag_man(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, bag_man_id)
);

-- Tracks a pending retirement handover (plan §9.9) until *both* the
-- retiring bag-man and the successor have confirmed via their own emailed
-- token (see verification_token above). completed_at is set once the
-- transfer has actually been carried out. Never readable by the public API.
create table bag_man_transfer_request (
  id uuid primary key default gen_random_uuid(),
  retiring_bag_man_id uuid not null references bag_man(id) on delete cascade,
  successor_bag_man_id uuid not null references bag_man(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One or more Locations per Event: each gets its own map marker and
-- calendar entry, per plan_v001.md §9.2.
create table location (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  address_text text,
  event_date date not null,
  start_time time not null,
  end_time time,
  created_at timestamptz not null default now()
);
```

You should see "Success. No rows returned". If you get an error, re-check you pasted the whole block (all six `create table` statements) in one go.

> The optional `ContactMessage` table from plan §7 is deliberately **not** created here — the plan already notes it may not need to be stored at all (Phase 3 will likely just email the contact form submission via Brevo, with nothing persisted). It can be added later if you ever decide you want a record of messages.

## Step 4 — Turn on Row-Level Security and add the public read policies

This is the step that technically enforces "bag-man emails are never publicly exposed" (plan §8). Paste this into a new SQL Editor query and click **Run**:

```sql
-- Turn on Row-Level Security for every table. From this point on, a row is
-- only readable/writable by the public API if a policy explicitly says so.
alter table bag_man enable row level security;
alter table verification_token enable row level security;
alter table event enable row level security;
alter table event_co_editor enable row level security;
alter table bag_man_transfer_request enable row level security;
alter table location enable row level security;

-- The public (anonymous website visitor) is allowed to READ events and
-- locations — this is what powers the map and calendar in later phases.
create policy "Public can read events" on event
  for select
  using (true);

create policy "Public can read locations" on location
  for select
  using (true);

-- Deliberately NO policies are created on bag_man, verification_token,
-- event_co_editor, or bag_man_transfer_request, and NO insert/update/delete
-- policies on event or location either. With RLS on and zero matching
-- policies, every one of those requests is denied by default to anyone
-- using the public API key. All writes (submitting/editing events, vetting
-- bag-men, nominating co-editors, retirement handovers) will go through
-- trusted server-side Netlify Functions in later phases, using a separate
-- secret key that bypasses RLS — never from the browser.

-- Because "Automatically expose new tables" was turned off in Step 1, no
-- table has any Data API privileges yet — even event/location would be
-- invisible to the API without this. Grant SELECT only on the two tables
-- that should be publicly readable. Deliberately grant nothing at all on
-- bag_man, verification_token, event_co_editor, or bag_man_transfer_request:
-- combined with RLS above, this is a second, independent lock on those four.
grant select on event to anon, authenticated;
grant select on location to anon, authenticated;

-- service_role (what Netlify Functions authenticate as, via the SECRET key
-- from Step 6 — never the anon/publishable key) has BYPASSRLS, so the
-- policies above don't apply to it — but plain Postgres table GRANTs are a
-- SEPARATE check that BYPASSRLS does NOT skip. Without this, every
-- server-side Function request fails with "permission denied for table ..."
-- (Postgres error 42501), even though it's using the privileged secret key.
-- Grant full access on all six tables to service_role — this is the
-- trusted server-side role, never exposed to the browser, so it's safe
-- (and necessary) for it to bypass the public-facing restrictions above.
grant select, insert, update, delete on bag_man to service_role;
grant select, insert, update, delete on verification_token to service_role;
grant select, insert, update, delete on event to service_role;
grant select, insert, update, delete on location to service_role;
grant select, insert, update, delete on event_co_editor to service_role;
grant select, insert, update, delete on bag_man_transfer_request to service_role;
```

This means, for now, the public API key can **read** events and locations but **cannot write anything at all yet** — that's expected. Writing (bag-man registration, event submission/editing, co-editor and retirement handling) is built in Phases 6–7, via server-side functions, not directly from the browser.

## Step 5 — Insert some test data

Still in the SQL Editor, run this to create one test bag-man, one test event, and one test location, all linked together:

```sql
with new_bag_man as (
  insert into bag_man (side_name, email, verified)
  values ('Test Morris Men', 'test@example.com', true)
  returning id
),
new_event as (
  insert into event (bag_man_id, morris_sides, description)
  select id, array['Test Morris Men'], 'A test event created in Phase 2 to prove the database works.'
  from new_bag_man
  returning id
)
insert into location (event_id, latitude, longitude, address_text, event_date, start_time, end_time)
select id, 51.7520, -1.2577, 'Radcliffe Camera, Oxford', '2026-09-01', '19:00', '20:00'
from new_event;
```

Click **Table Editor** in the sidebar and check `bag_man`, `event`, and `location` each now show one row, correctly linked (the `event` row's `bag_man_id` matches the `bag_man` row's `id`, and likewise for `location`'s `event_id`).

`event_co_editor` and `bag_man_transfer_request` are deliberately left empty here — there's nothing to insert until the co-editor and retirement/handover flows are actually built in Phase 7. This step just needs to confirm they exist with the right columns and foreign keys, which the Table Editor lets you check visually.

## Step 6 — Get your Project URL and API keys

Supabase recently replaced the old JWT-based `anon`/`service_role` keys with a new **Publishable**/**Secret** key system (they say the old ones will be deprecated by the end of 2026). For a brand-new project like this one, use the new keys — they work the same way, just with new names and formats.

1. In the sidebar, go to **Project Settings** (gear icon).
2. For the **Project URL** (looks like `https://abcdefghijk.supabase.co`): this has moved off the **API Keys** page in Supabase's redesign — look under **Data API** in the Settings sidebar instead, or click the **Connect** button near the top of your project's dashboard, which shows the same URL alongside ready-made `supabase-js` code snippets. It is: `https://fdhnogpsvkfwmmshxymc.supabase.co` — use exactly this bare origin, with **no** trailing `/rest/v1/`. The Connect dialog's "REST" tab sometimes shows the full endpoint including `/rest/v1/`, but `supabase-js`'s `createClient()` wants just the plain project URL and appends `/rest/v1/` (and other paths) itself internally; including it yourself doubles the path and every request will 404.
3. For your keys, go to **API Keys** — you should see a **Publishable key** section and a **Secret keys** section:
   - **Publishable key** (`sb_publishable_...`) — safe to use in browser-side code. It's the new equivalent of the old `anon` key: access is still governed entirely by RLS (Step 4), not by the key itself. Note it down, you'll need it in Step 7. sb_publishable_aGICltfJUIFKQkVmi4MeIw_e2Zx9AWU
   - **Secret keys** (`sb_secret_...`) — the new equivalent of the old `service_role` key. **Do not use it yet, and never put it in any file that ends up in the browser or gets committed to GitHub.** It bypasses RLS entirely — full read/write access to everything, including `bag_man` emails. It's only ever used later, in a Netlify Function running on the server, stored as a Netlify environment variable (Phase 3 onward).
   - If you ever see a **"Legacy anon, service_role API keys"** tab, that's the old JWT-based system — safe to ignore for this new project; use the new Publishable/Secret keys above instead.

## Step 7 — Prove the site can connect, with a throwaway test page

Create a new file directly in the repository root (same folder as `index.html`), called `db-test.html`. This file is **not** linked from the site's navigation — it's a scratch file purely to prove the connection works, and you'll delete it once confirmed.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Supabase connection test</title>
</head>
<body>
  <h1>Supabase connection test</h1>
  <p>Open the browser console (press F12, click the "Console" tab) to see the results below.</p>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
    const SUPABASE_URL = 'PASTE-YOUR-PROJECT-URL-HERE';
    const SUPABASE_PUBLISHABLE_KEY = 'PASTE-YOUR-PUBLISHABLE-KEY-HERE';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    async function runTest() {
      const { data: events, error: eventsError } = await supabaseClient
        .from('event')
        .select('*, location(*)');
      console.log('Events + locations (should succeed and show your test row):', events, eventsError);

      const { data: bagMen, error: bagManError } = await supabaseClient
        .from('bag_man')
        .select('*');
      console.log('Bag-men (should come back empty/blocked — RLS working):', bagMen, bagManError);
    }

    runTest();
  </script>
</body>
</html>
```

Replace the two `PASTE-...-HERE` placeholders with the Project URL and Publishable key from Step 6, save the file, then open it in your browser over a local server rather than double-clicking it:

- Open a terminal in the repository root and run `python -m http.server 8000` (Python ships with most systems; if you don't have it, `npx serve` works the same way with Node.js installed).
- Visit `http://localhost:8000/db-test.html` in your browser.

This is a change from Phase 1's "just double-click the file" trick — that's still fine for pages with no network calls, but pages that call `fetch`/`supabase-js` are better served over `http://` from the start. Opening this particular kind of page directly as `file://` can trigger a console warning like `'file:' URLs are treated as unique security origins` (some browsers run a hidden preview/reader pass on local files) — this isn't caused by anything wrong in the file itself, and isn't fixed by Incognito/Private mode either, since it's not extension-related. Serving over `http://localhost` avoids that particular warning entirely.

Open the browser console (F12 → Console tab) and check:

- The **events** log shows an array with one event, including a nested `location` array with your test location (`Radcliffe Camera, Oxford`, etc.).
- The **bag-men** log shows `data: null` alongside a **permission-denied error** — something like `{code: '42501', message: 'permission denied for table bag_man', hint: 'Grant the required privileges to the current role with: GRANT SELECT ON public.bag_man TO anon;'}`, plus a `401 (Unauthorized)` network request in the console. This is the **correct, expected** result: since `bag_man` has no `grant select` (Step 4) and no RLS policies either, Postgres refuses the request outright — a stronger block than a plain empty array, and proof both layers (missing grant + RLS) are doing their job. (A `favicon.ico 404` in the console is unrelated browser noise — ignore it.)

If both checks pass, the database, the tables, and the security policy are all working correctly.

### Troubleshooting

- **Events come back empty too**: double-check Step 4's SQL ran without errors, and that Step 5's test data was actually inserted (check the Table Editor).
- **A CORS or network error in the console**: double-check you copied the Project URL exactly (starts with `https://`, ends in `.supabase.co`, no extra spaces).
- **"Invalid API key"**: you likely copied a **Secret key** instead of the **Publishable key** — go back to Step 6 and copy the correct one (or, if using the legacy tab, `service_role` instead of `anon`).
- **`Uncaught SyntaxError: Identifier 'supabase' has already been declared`**: this happens if you named your client variable `supabase` — it collides with the global `window.supabase` namespace object that the CDN script itself sets up. The code above avoids this by calling it `supabaseClient` instead (matching Supabase's own official example) — if you're still seeing this, double-check you don't have a local variable named `supabase` anywhere in the page.

## Step 8 — Clean up and commit

Delete `db-test.html` once you've confirmed both checks pass — it's served its purpose and there's no need to keep hardcoded (if harmless) connection details lying around in the repo. Nothing else needs to change in the site files this phase — the tables live in Supabase itself, not in your Git repository.

If you'd like a record that this phase happened, this document plus your own confirmation that Step 7's checks passed is enough; there's nothing new to `git push` unless you choose to keep the test file (not recommended — see above).

## Checklist — Phase 2 Definition of Done

- [x] Supabase account created, linked to GitHub, project created in a UK/EU region.
- [x] Database password saved somewhere safe (a password manager).
- [x] `bag_man` (with its `retired` and `banned` columns), `verification_token` (with all six token types), `event`, `event_co_editor`, `bag_man_transfer_request`, and `location` tables created exactly as in Step 3.
- [x] Row-Level Security enabled on all six tables.
- [x] Public read policies added for `event` and `location` only — `bag_man`, `verification_token`, `event_co_editor`, and `bag_man_transfer_request` have zero public policies.
- [x] "Automatically expose new tables" was turned off at project creation; explicit `grant select` added for `event` and `location` only — the other four tables have no Data API privileges at all.
- [x] Test data inserted and visible in the Table Editor, correctly linked across tables.
- [x] Project URL and **Publishable key** noted down (and a **Secret key** identified but *not* used anywhere yet).
- [x] `db-test.html` created, run locally, confirmed events are readable and bag-man data is blocked, then deleted.

Phase 2 is complete. Phase 3 (static content pages — Home, Links, Contact us, with the Contact form wired up via Netlify Forms and Brevo) will be expanded into its own document once this phase is confirmed working.
