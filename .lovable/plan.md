
# Salon Booking App — Review (no code changes)

Scope: read-only assessment of the current codebase, RLS policies, and WhatsApp webhook. Nothing below is applied yet — treat this as a triage document.

## 1) Main technical challenges

- **Slot integrity without server-side booking.** Public booking (`salons.$slug.tsx`) inserts directly into `bookings` from the browser under a permissive `INSERT` policy. There is no DB-level exclusion constraint on `(barber_id, [start_time, end_time))`, so two people picking the same slot within a few seconds can both succeed (double-book). Same risk from the WhatsApp bot which only filters conflicts in JS before inserting.
- **Two independent booking engines drifting apart.** Slot generation exists twice: `salons.$slug.tsx` (per-service duration, per-day) and `api/public/whatsapp.ts` (fixed 30-min stride, next 3 days). They will diverge in rules (breaks, days off, holidays, barber-specific hours — none of which exist yet).
- **Timezones.** Salon `opening_time`/`closing_time` are compared using the browser's / worker's local time (`new Date()`, `parseISO("YYYY-MM-DDTHH:mm")`). A salon in another timezone, or a customer traveling, will see wrong "past" markers and wrong open windows.
- **Webhook not signature-verified.** `/api/public/whatsapp` accepts any POST. Anyone who guesses the URL can drive the bot and create bookings. Twilio signature validation is required.
- **No realtime on the dashboard.** WhatsApp/offline bookings won't appear on the owner's screen until refresh — the "instantly on the dashboard" claim is not implemented.

## 2) Existing / likely bugs

- **`salons.$slug.tsx` L46–L61:** the first `barber_services` query uses `.in("barber_id", [])` (always empty), then a second query fetches real data. The first call is dead — harmless but wasted. `void bs;` is a smell.
- **Same file, `eligibleBarbers`:** when `barber_services` has no mapping for the salon, it falls back to "all barbers" — a barber who does not offer that service can still be booked.
- **Same file, `submit()` L120–127:** the "existing customer" branch runs under the public policy (no auth), so `customers` SELECT/UPDATE from an anonymous session will actually be blocked by RLS (`customers owner all` only allows the salon owner). Result: repeat customers silently fall through to the else branch on every booking, `visit_count` never increments beyond 1, and new-vs-regular color coding (a stated requirement) cannot work.
- **Same file, L145:** `navigate(...); setStep(1); ...` — the state resets happen after a navigation to the same route; on strict/unmount cycles this can flash the wrong step. Also there is no visible success screen — user sees a toast then the form resets.
- **Slot key collisions:** slot buttons use `s.start.toISOString()` as key — fine, but slot iteration steps by `service.duration_minutes`, not a fixed grid. Changing service mid-flow can produce different grids that misalign with existing bookings made under a different duration.
- **`dashboard.tsx` `useSalon()`:** creates a duplicate Supabase auth + salon fetch on every component that calls it. Multiple children mounting = N fetches. Should be one context/query.
- **WhatsApp bot, `nextSlots`:** doesn't consider barber-specific availability or day-off; also inserts with `status: 'confirmed'` and no `customer_id` linkage (breaks the new-vs-regular coloring for WA bookings).
- **WhatsApp bot session:** `whatsapp_sessions` has `no client access` policy (good) but state is stored as JSON keyed only by phone — no salon scoping, so if a user starts a flow with one WA number and the app later serves multiple salons, state bleeds across.
- **`handle_new_user` trigger** unconditionally assigns `salon_owner` role to every new signup — customers who log in later would also become owners.
- **`profiles` has no INSERT policy** but the trigger uses `SECURITY DEFINER` so inserts work — fine, but there is no self-insert path if the trigger ever fails.
- **`bookings` public INSERT policy** validates shape but does NOT check that the slot is inside salon hours, isn't in the past, and doesn't overlap existing bookings — all "no double-book" logic lives in JS.
- **`onAuthStateChange` in `useAuth`** doesn't filter events; fires on every `TOKEN_REFRESHED` and remounts, causing extra re-renders of the whole dashboard tree.
- **`salons` public read policy is `qual: true`** — exposes `whatsapp_number`, `phone`, and any future private columns to anyone.

## 3) UX issues

- No confirmation screen after booking — just a toast and a form reset. No booking reference, no "add to calendar", no SMS/email echo.
- No indication of which slots are the customer's own past bookings, no way to cancel/reschedule as a customer.
- Booking flow has no loading skeletons; salon page shows a bare "Loading salon..." text.
- Date strip shows 7 days but doesn't grey out full days.
- The stated requirement — **regular vs new customer color coding on the dashboard** — is not implemented anywhere in `dashboard.index.tsx` (needs verification but nothing in the query selects `visit_count`).
- WhatsApp bot: numbered menus are fine but there's no way to go "back" one step (only "menu" to restart). No handling for typos, plural options, or salon closing during the flow.
- Owner onboarding forces salon creation before seeing the dashboard; no demo/skip.
- No "share this salon" link / QR for offline customers to scan.
- Sign-out button hidden at bottom of a fixed sidebar on mobile.

## 4) Scalability concerns

- **Client-side slot computation** loads every same-day booking to the browser. Fine at 10/day, painful at 500.
- **N+1 in booking page:** salon → services + barbers + barber_services + bookings, all sequential on every date/barber change.
- **No pagination** on `salons` (`.limit(10)` in WA bot is hardcoded), no index-backed search.
- **`whatsapp_sessions` grows forever** — no TTL/cleanup on abandoned flows.
- **All bookings ever** are queried for the WA bot's conflict check (`gte(now)` is present — good; but no upper bound and no index hint).
- **No caching layer.** TanStack Query isn't used on the public salon page — every navigation refetches.
- **Cloudflare Workers cold-boot** + Supabase publishable-key request per read = latency for public pages. Consider loader + `ensureQueryData`.
- **Multi-salon marketplace** implied by the UI but there is no salon listing search, no geo, no ranking.

## 5) Security concerns

- **Twilio webhook has no signature validation.** Anyone can POST to `/api/public/whatsapp` and create bookings under arbitrary phone numbers. Highest severity.
- **Anonymous INSERT on `bookings`** with only length checks — no rate limit, no captcha, no per-phone throttle. A script can fill a salon's day.
- **`salons public read qual: true`** exposes owner phone / WhatsApp number to the internet. Should project a safe column subset via a view or narrow the policy.
- **`customers` table:** only owner can read/write, but the public booking flow tries to read/update it anonymously — those calls silently fail (data leak of failure, not of data, but the app logic breaks).
- **`handle_new_user` grants `salon_owner` to every signup** — privilege escalation if the app later adds a customer-only signup surface.
- **`supabaseAdmin` used from the webhook** (correct choice) but every read/insert bypasses RLS — a bug there is a full-table exposure. Needs input validation on `From`/`Body` beyond `.trim()`.
- **CORS on the webhook is `*` with `POST, OPTIONS`** — Twilio doesn't need CORS; this widens the attack surface.
- **No CSRF/rate limiting** on any server function or public route.
- **`SECURITY DEFINER` functions** are correctly `SET search_path = public` — good.

## 6) Highest-priority improvements (ranked)

1. **Verify Twilio signature** in `/api/public/whatsapp` using `X-Twilio-Signature` + auth token; reject on mismatch. Remove `Access-Control-Allow-Origin: *`.
2. **Move booking creation to a `createServerFn`** that (a) re-checks slot inside salon hours, (b) uses a Postgres `tstzrange` exclusion constraint on `(barber_id, during) WHERE status <> 'cancelled'` to make double-booking impossible, (c) upserts the customer under service-role, (d) returns a booking id.
3. **Tighten `bookings` public INSERT policy** — remove it once bookings go through the server fn, or at minimum add per-IP rate limiting via a lightweight table.
4. **Narrow the `salons` public SELECT policy** to a safe column set (drop phone/whatsapp/owner_id from public exposure) via a view, and select from that view on the public page.
5. **Fix the customer upsert path** so anonymous bookings can look up / update the `customers` row (either via server fn, or a targeted RLS policy scoped to the booking transaction).
6. **Implement regular vs new customer coloring** on `dashboard.index.tsx` using `customers.visit_count` — this is a stated core requirement not yet delivered.
7. **Realtime dashboard** — subscribe to `bookings` inserts for the owner's salon so WhatsApp/offline bookings appear immediately.
8. **Unify slot generation** into one server-side helper used by both the web flow and the WA bot; drive it from salon hours + barber schedule + duration.
9. **Timezones**: store salon `timezone`; do all open/close and "is past" math in that zone.
10. **Auth cleanup:** replace `handle_new_user` blanket role grant with an explicit "salon owner signup" surface; filter `onAuthStateChange` events in `useAuth`.
11. **`whatsapp_sessions` TTL** (e.g. delete rows older than 30 min) + session key scoped to salon.
12. **Move public salon page to loader + TanStack Query** with `ensureQueryData`, and add a proper booking-confirmation screen (reference, add-to-calendar, cancel link).
13. **Add signature-verified inbound and outbound WhatsApp** so the customer receives a confirmation message from the bot, not just the TwiML reply.
14. **Owner UX:** cancel/reschedule from dashboard, day view with capacity indicator, walk-in "book now" button.

## Deliverable

If you approve, I'd tackle in this order: security fixes (1, 3, 4) → correctness (2, 5, 8, 9) → the promised UX (6, 7, 12) → the rest. Each is a small, independently shippable change.
