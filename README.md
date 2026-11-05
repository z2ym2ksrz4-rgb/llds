# LL Dance Studio – app

Members app for a dance school: dancers, parents, trainers, assistant trainers and the owner (admin).
React + TypeScript + Vite + Capacitor 7 (iOS/Android/web) on a Supabase backend. Multi-tenant (`school_id`).

Spec (living): Claude Docs "LL Dance Studio – produktspec v1".

## Develop
```bash
npm install
npm run dev          # http://localhost:5173 – runs on the in-memory mock (any 6-digit code; admin@demo = Line)
npm run typecheck
npm run build && npx vite preview --port 4173 && npm run smoke   # Playwright: signup → pending → approve → team picker
```
Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (or `app.config.json → supabase`) to run against a real project.

## Backend
`supabase/migrations/0001_schema.sql` – tables, Row Level Security, public website views, RPCs (`sign_up`, `approve_person`, `reject_person`).
`supabase/seed.sql` – school `llds`, rooms, season 26/27 teams, punch-card type.
First admin: after Line's first sign-in, `update person set status='approved', is_admin=true where email='…'` with the service role.

## Phases
1. ✅ Auth (e-mail code), self-registration with children, admin approval + team/role assignment, team picker with parent/child hats.
2. Teams, season planner, sessions, room booking, absence, attendance, substitute hand-over.
3. Social (team rooms, trainer channel, moderation), official messages, folders/video.
4. Events, punch cards, shop (MobilePay QR), milestones, push.
5. Public website + `/app/` PWA on ilumie.com/llds/.

## Release
Codemagic workflows `ios-release` / `android-release` (see codemagic.yaml). `RELEASE=1` strips the dev menu. Web: `npm run build:web` → `ilumie-site/llds/app/`.
