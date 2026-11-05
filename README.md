# LL Dance Studio – app

Members app for a dance school: dancers, parents, trainers, assistant trainers and the owner (admin).
React + TypeScript + Vite + Capacitor 7 (iOS/Android/web) on a Supabase backend. Multi-tenant (`school_id`).

Spec (living): Claude Docs "LL Dance Studio – produktspec v1".

## Develop
```bash
npm install
npm run dev          # http://localhost:5173 – real Supabase (keys in app.config.json)
npm run dev:mock     # in-memory mock (any 6-digit code; admin@demo = Line, parent@demo = parent)
npm run typecheck
npm run build:mock && npx vite preview --port 4173 && npm run smoke   # NOTE: smoke needs the mock build in dist/ – a RELEASE build there makes every login time out   # Playwright: phase 1 (signup→approve) + phase 2 (absence, booking, season, attendance, substitute) + phase 3 (feed, messages, folders, reports, notes, formations) + phase 4 (events, shop, punch cards, milestones, notifications)
```
Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (or `app.config.json → supabase`) to run against a real project.

## Backend
`supabase/migrations/0001_schema.sql` – tables, Row Level Security, public website views, RPCs (`sign_up`, `approve_person`, `reject_person`).
`supabase/seed.sql` – school `llds`, rooms, season 26/27 teams, punch-card type.
First admin: after Line's first sign-in, `update person set status='approved', is_admin=true where email='…'` with the service role.

## Phases
1. ✅ Auth (e-mail code), self-registration with children, admin approval + team/role assignment, team picker with parent/child hats.
2. ✅ Rooms calendar + booking (approval), weekly trainings (season generator, clash check, edit this/future), absence (dancer/parent), attendance, substitute request/take + lesson-plan hand-over, Admin → Members/Teams/Season/Bookings, supervised child login (10–12).
3. Social (team rooms, trainer channel, moderation), official messages, folders/video.
4. Events, punch cards, shop (MobilePay QR), milestones, push.
5. Public website + `/app/` PWA on ilumie.com/llds/.

## Release
Codemagic workflows `ios-release` / `android-release` (see codemagic.yaml). `RELEASE=1` strips the dev menu. Web: `npm run build:web` → `ilumie-site/llds/app/`.

## Website + hosted app (phase 5)
`npm run site` regenerates `../ilumie-site/llds/` (public site, Danish, reads Supabase public views client-side) and copies the web build to `../ilumie-site/llds/app/` (PWA: manifest + sw.js). Commit and push `ilumie-site` → live at https://ilumie.com/llds/ and https://ilumie.com/llds/app/.

## Native push (phase 6)
- `supabase/migrations/0006_push.sql` (push_token + notification.pushed_at), client `src/core/push.ts` registers the device once approved.
- Edge function `supabase/functions/push`: `npx supabase functions deploy push --project-ref pbpaojgrjtolxwbdymad`, then secrets
  `npx supabase secrets set APNS_KEY_ID=… APNS_TEAM_ID=… APNS_P8=$(base64 -w0 AuthKey.p8) APNS_BUNDLE_ID=com.ilumie.llds FCM_SERVICE_ACCOUNT="$(cat firebase-sa.json)"`
  and a schedule: `select cron.schedule('push','* * * * *', $$select net.http_post('https://pbpaojgrjtolxwbdymad.supabase.co/functions/v1/push', '{}'::jsonb, '{"Authorization":"Bearer <service-role>"}'::jsonb)$$);`
- iOS needs the Push capability on the App ID (regenerate the profile), Android needs `google-services.json` (Codemagic secret `GOOGLE_SERVICES_JSON`, base64).

## First admin
After Line (or Steffen) has signed in once: `update person set status='approved', is_admin=true where email='<mail>';` in the SQL editor. If the person row does not exist yet (signed in but never registered), register in the app first, then run it.
