-- LL Dance Studio – core schema (multi-tenant: everything hangs on school_id)
-- Apply with: supabase db push   (or paste into the SQL editor)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type member_role as enum ('dancer', 'trainer', 'assistant');
create type person_status as enum ('pending', 'approved', 'rejected', 'inactive');
create type team_category as enum ('mini', 'kids', 'junior', 'adult', 'mixed');
create type visibility as enum ('private', 'public');

-- ---------------------------------------------------------------- tenants & people
create table school (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,   -- {minAccountAge:13, trainersPostOnMini:true, mobilepay:{...}}
  created_at timestamptz not null default now()
);

create table person (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,   -- null for children without login
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  birth_year int,
  status person_status not null default 'pending',
  is_admin boolean not null default false,
  photo_consent boolean,                  -- null = not answered
  wished_roles text[] not null default '{}',  -- what they asked for at signup (admin reads it)
  wished_teams text,                      -- free text at signup
  supervised_by uuid references person(id) on delete set null,   -- 10–12 y/o child account managed by this parent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on person(school_id, status);

create table guardian (
  parent_id uuid not null references person(id) on delete cascade,
  child_id uuid not null references person(id) on delete cascade,
  confirmed boolean not null default false,   -- parent confirmed a 13–17 y/o's own account
  consent_at timestamptz,                      -- GDPR art. 8: parent consented to the child's own (supervised) login
  primary key (parent_id, child_id)
);

-- ---------------------------------------------------------------- teams & rooms
create table room (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  name text not null,
  sort int not null default 0
);

create table team (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  name text not null,
  style text,                       -- Showdance, Hip Hop, Contemporary…
  category team_category not null default 'mixed',
  level text,                       -- Begynder … Elite+
  closed boolean not null default false,
  max_dancers int,
  punch_card_open boolean not null default false,
  parents_see_video boolean not null default false,   -- "mini/børn" flag
  visibility visibility not null default 'public',   -- on the website schedule
  color text,
  sort int not null default 0,
  archived boolean not null default false
);
create index on team(school_id);

create table membership (
  person_id uuid not null references person(id) on delete cascade,
  team_id uuid not null references team(id) on delete cascade,
  role member_role not null default 'dancer',
  created_at timestamptz not null default now(),
  primary key (person_id, team_id, role)
);
create index on membership(team_id);

-- ---------------------------------------------------------------- schedule
create table session (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid references team(id) on delete cascade,
  room_id uuid references room(id) on delete set null,
  title text,                        -- defaults to team name
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  trainer_id uuid references person(id) on delete set null,
  substitute_id uuid references person(id) on delete set null,
  lesson_plan text,                  -- vikar-overlevering
  lesson_plan_read_at timestamptz,
  cancelled boolean not null default false,
  cancel_note text,
  weekly_rule_id uuid,               -- sessions generated from the season plan share a rule id
  check (ends_at > starts_at)
);
create index on session(school_id, starts_at);
create index on session(team_id, starts_at);

create table booking (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  room_id uuid not null references room(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',   -- pending | approved | rejected
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on booking(school_id, starts_at);

create table absence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references session(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  reason text,
  note text,
  reported_by uuid references person(id),
  created_at timestamptz not null default now(),
  unique (session_id, person_id)
);

create table attendance (
  session_id uuid not null references session(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  present boolean not null default true,
  via_punch boolean not null default false,
  primary key (session_id, person_id)
);

-- ---------------------------------------------------------------- social
create table post (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid references team(id) on delete cascade,      -- null = whole school (admin only)
  channel text not null default 'team',                      -- team | school | trainers
  author_id uuid not null references person(id) on delete cascade,
  body text not null,
  media jsonb not null default '[]'::jsonb,
  official boolean not null default false,
  visibility visibility not null default 'private',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on post(team_id, created_at desc);

create table comment (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references post(id) on delete cascade,
  author_id uuid not null references person(id) on delete cascade,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table report (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  post_id uuid references post(id) on delete cascade,
  comment_id uuid references comment(id) on delete cascade,
  reporter_id uuid not null references person(id),
  reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table message (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  author_id uuid not null references person(id),
  title text not null,
  body text not null,
  audience jsonb not null default '{}'::jsonb,   -- {teams:[..], roles:[..], all:true}
  needs text not null default 'read',            -- read | accept
  created_at timestamptz not null default now()
);
create table message_receipt (
  message_id uuid not null references message(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  acted_at timestamptz not null default now(),
  primary key (message_id, person_id)
);

-- ---------------------------------------------------------------- media & choreography
create table folder (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid not null references team(id) on delete cascade,
  name text not null,
  staff_only boolean not null default false,
  created_at timestamptz not null default now()
);
create table media (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folder(id) on delete cascade,
  uploader_id uuid not null references person(id),
  storage_path text not null,       -- bucket media/<school>/<team>/<file>
  kind text not null default 'image',  -- image | video
  visibility visibility not null default 'private',
  created_at timestamptz not null default now()
);
create table video (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references team(id) on delete cascade,
  uploader_id uuid not null references person(id),
  title text not null,
  storage_path text not null,
  duration_s int,
  formations jsonb not null default '[]'::jsonb,   -- [{label, positions:[{initials,x,y}]}]
  created_at timestamptz not null default now()
);
create table note (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references team(id) on delete cascade,
  dancer_id uuid not null references person(id) on delete cascade,
  author_id uuid not null references person(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- events, shop, punch cards
create table event (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  title text not null,
  kind text not null default 'competition',   -- competition | show | workshop | social
  starts_at timestamptz not null,
  place text,
  meet_time text,
  team_ids uuid[] not null default '{}',
  plan jsonb not null default '[]'::jsonb,      -- [{time, text}]
  pack_list text[] not null default '{}',
  info text,
  signup_deadline date,
  price_dkk int,
  visibility visibility not null default 'private',
  created_at timestamptz not null default now()
);
create table event_signup (
  event_id uuid not null references event(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);
create table result (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid references team(id) on delete set null,
  event_title text not null,
  placed text not null,
  held_on date not null,
  visibility visibility not null default 'private'
);

create table product (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  name text not null,
  price_dkk int not null,
  sizes text[] not null default '{}',
  stock int,
  image_path text,
  visibility visibility not null default 'public',
  active boolean not null default true
);
create table "order" (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  number serial,
  lines jsonb not null,                  -- [{product_id, name, size, qty, price_dkk}]
  total_dkk int not null,
  status text not null default 'awaiting_payment',   -- awaiting_payment | paid | delivered | cancelled
  claimed_paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table punch_card_type (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  name text not null,
  punches int not null,
  valid_days int not null default 90,
  price_dkk int not null,
  active boolean not null default true
);
create table punch_card (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references punch_card_type(id),
  person_id uuid not null references person(id) on delete cascade,
  punches_left int not null,
  expires_on date not null,
  status text not null default 'awaiting_payment',   -- awaiting_payment | active | expired
  created_at timestamptz not null default now()
);
create table punch (
  card_id uuid not null references punch_card(id) on delete cascade,
  session_id uuid not null references session(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, session_id)
);

create table milestone (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  title text not null,
  reached_on date
);

create table audit_log (
  id bigserial primary key,
  school_id uuid,
  actor_user uuid,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers (security definer, used by RLS)
create or replace function my_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from person where user_id = auth.uid() limit 1
$$;

create or replace function my_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from person where user_id = auth.uid() limit 1
$$;

create or replace function i_am_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and status = 'approved' from person where user_id = auth.uid() limit 1), false)
$$;

create or replace function i_am_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from person where user_id = auth.uid() limit 1), false)
$$;

-- every person whose data I may see: me, my children
create or replace function my_people() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from person where user_id = auth.uid()
  union
  select g.child_id from guardian g join person p on p.id = g.parent_id where p.user_id = auth.uid()
$$;

-- teams I belong to directly or through a child
create or replace function my_team_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.team_id from membership m where m.person_id in (select my_people())
$$;

create or replace function i_am_staff_of(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select i_am_admin() or exists (
    select 1 from membership m where m.team_id = t and m.person_id = my_person_id() and m.role in ('trainer','assistant'))
$$;

create or replace function i_am_trainer_of(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select i_am_admin() or exists (
    select 1 from membership m where m.team_id = t and m.person_id = my_person_id() and m.role = 'trainer')
$$;

create or replace function i_am_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select i_am_admin() or exists (
    select 1 from membership m where m.person_id = my_person_id() and m.role in ('trainer','assistant'))
$$;

-- ---------------------------------------------------------------- RLS
alter table school enable row level security;
alter table person enable row level security;
alter table guardian enable row level security;
alter table room enable row level security;
alter table team enable row level security;
alter table membership enable row level security;
alter table session enable row level security;
alter table booking enable row level security;
alter table absence enable row level security;
alter table attendance enable row level security;
alter table post enable row level security;
alter table comment enable row level security;
alter table report enable row level security;
alter table message enable row level security;
alter table message_receipt enable row level security;
alter table folder enable row level security;
alter table media enable row level security;
alter table video enable row level security;
alter table note enable row level security;
alter table event enable row level security;
alter table event_signup enable row level security;
alter table result enable row level security;
alter table product enable row level security;
alter table "order" enable row level security;
alter table punch_card_type enable row level security;
alter table punch_card enable row level security;
alter table punch enable row level security;
alter table milestone enable row level security;
alter table audit_log enable row level security;

-- school: readable by its members
create policy school_read on school for select using (id = my_school_id());
create policy school_admin on school for update using (i_am_admin() and id = my_school_id());

-- person
create policy person_self on person for select using (user_id = auth.uid() or id in (select my_people()));
create policy person_admin on person for all using (i_am_admin() and school_id = my_school_id()) with check (school_id = my_school_id());
-- staff see dancers on their teams (limited columns enforced in a view, see person_card)
create policy person_staff on person for select using (
  i_am_staff() and status = 'approved' and exists (
    select 1 from membership m where m.person_id = person.id and i_am_staff_of(m.team_id)));
-- signup: an authenticated user may create exactly their own pending person (+ children without user_id)
create policy person_signup on person for insert with check (
  auth.uid() is not null and status = 'pending' and is_admin = false
  and (user_id = auth.uid() or user_id is null));
create policy person_self_update on person for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_admin = (select is_admin from person p where p.id = person.id) and status = (select status from person p where p.id = person.id));

-- guardian
create policy guardian_read on guardian for select using (parent_id in (select my_people()) or child_id in (select my_people()) or i_am_admin());
create policy guardian_signup on guardian for insert with check (parent_id = my_person_id() or i_am_admin());
create policy guardian_admin on guardian for all using (i_am_admin());

-- room/team: all approved members of the school can read; admin writes
create policy room_read on room for select using (school_id = my_school_id() and i_am_approved());
create policy room_admin on room for all using (i_am_admin() and school_id = my_school_id());
create policy team_read on team for select using (school_id = my_school_id() and i_am_approved());
create policy team_admin on team for all using (i_am_admin() and school_id = my_school_id());

-- membership: admin writes; members read their teams' rosters; staff read their teams
create policy membership_read on membership for select using (
  person_id in (select my_people()) or team_id in (select my_team_ids()) or i_am_staff_of(team_id));
create policy membership_admin on membership for all using (i_am_admin());

-- session: everyone approved reads the school's schedule (needed for room calendar); trainers/admin write
create policy session_read on session for select using (school_id = my_school_id() and i_am_approved());
create policy session_write on session for insert with check (school_id = my_school_id() and (i_am_admin() or (team_id is not null and i_am_trainer_of(team_id))));
create policy session_update on session for update using (school_id = my_school_id() and (i_am_admin() or (team_id is not null and i_am_trainer_of(team_id)) or substitute_id = my_person_id()));
create policy session_delete on session for delete using (school_id = my_school_id() and (i_am_admin() or (team_id is not null and i_am_trainer_of(team_id))));

-- booking: everyone reads (calendar), own insert, admin approves
create policy booking_read on booking for select using (school_id = my_school_id() and i_am_approved());
create policy booking_insert on booking for insert with check (school_id = my_school_id() and person_id = my_person_id() and i_am_approved() and (select supervised_by from person where id = my_person_id()) is null and status = case when i_am_staff() then 'approved' else 'pending' end);
create policy booking_own on booking for delete using (person_id = my_person_id());
create policy booking_admin on booking for all using (i_am_admin() and school_id = my_school_id());

-- absence: own/children + staff of the session's team
create policy absence_read on absence for select using (
  person_id in (select my_people()) or exists (select 1 from session s where s.id = absence.session_id and i_am_staff_of(s.team_id)));
create policy absence_insert on absence for insert with check (person_id in (select my_people()) and reported_by = my_person_id());
create policy absence_delete on absence for delete using (person_id in (select my_people()) or exists (select 1 from session s where s.id = absence.session_id and i_am_staff_of(s.team_id)));

-- attendance: staff of team
create policy attendance_rw on attendance for all using (exists (select 1 from session s where s.id = attendance.session_id and i_am_staff_of(s.team_id)));
create policy attendance_self on attendance for select using (person_id in (select my_people()));

-- posts: team rooms + school channel + trainers channel
create policy post_read on post for select using (
  school_id = my_school_id() and i_am_approved() and not hidden and (
    (channel = 'team' and team_id in (select my_team_ids())) or
    (channel = 'team' and i_am_staff_of(team_id)) or
    channel = 'school' or
    (channel = 'trainers' and i_am_staff())));
create policy post_insert on post for insert with check (
  school_id = my_school_id() and author_id = my_person_id() and i_am_approved() and (
    (channel = 'team' and (team_id in (select my_team_ids()) or i_am_staff_of(team_id))) or
    (channel = 'school' and i_am_admin()) or
    (channel = 'trainers' and i_am_staff())));
create policy post_own on post for update using (author_id = my_person_id());
create policy post_mod on post for all using (i_am_admin() or (team_id is not null and i_am_staff_of(team_id)));

create policy comment_read on comment for select using (not hidden and exists (select 1 from post p where p.id = comment.post_id));
create policy comment_insert on comment for insert with check (author_id = my_person_id() and exists (select 1 from post p where p.id = comment.post_id));
create policy comment_mod on comment for all using (author_id = my_person_id() or i_am_admin() or exists (select 1 from post p where p.id = comment.post_id and p.team_id is not null and i_am_staff_of(p.team_id)));

create policy report_insert on report for insert with check (reporter_id = my_person_id() and school_id = my_school_id());
create policy report_admin on report for all using (i_am_admin() and school_id = my_school_id());

-- messages: author/admin writes; recipients read when audience matches
create policy message_read on message for select using (
  school_id = my_school_id() and i_am_approved() and (
    i_am_admin() or (audience->>'all')::boolean is true or
    exists (select 1 from jsonb_array_elements_text(coalesce(audience->'teams','[]'::jsonb)) t where t::uuid in (select my_team_ids()))));
create policy message_write on message for all using (i_am_staff() and school_id = my_school_id());
create policy receipt_rw on message_receipt for all using (person_id in (select my_people()) or i_am_admin());

-- folders/media/video/note: team members (+ parents) and staff; staff_only folders only staff
create policy folder_read on folder for select using ((team_id in (select my_team_ids()) and not staff_only) or i_am_staff_of(team_id));
create policy folder_write on folder for all using (i_am_staff_of(team_id));
create policy media_read on media for select using (exists (select 1 from folder f where f.id = media.folder_id and ((f.team_id in (select my_team_ids()) and not f.staff_only) or i_am_staff_of(f.team_id))));
create policy media_insert on media for insert with check (uploader_id = my_person_id() and (select supervised_by from person where id = my_person_id()) is null and exists (select 1 from folder f where f.id = media.folder_id and (f.team_id in (select my_team_ids()) or i_am_staff_of(f.team_id))));
create policy media_mod on media for all using (uploader_id = my_person_id() or exists (select 1 from folder f where f.id = media.folder_id and i_am_staff_of(f.team_id)));
-- video: dancers themselves, staff, and parents only when team.parents_see_video
create policy video_read on video for select using (
  i_am_staff_of(team_id) or
  exists (select 1 from membership m where m.team_id = video.team_id and m.person_id = my_person_id()) or
  exists (select 1 from membership m join guardian g on g.child_id = m.person_id join team t on t.id = m.team_id join person c on c.id = m.person_id
          where m.team_id = video.team_id and g.parent_id = my_person_id()
            and (t.parents_see_video or (c.birth_year is not null and extract(year from now()) - c.birth_year < 13))));
create policy video_write on video for all using (i_am_staff_of(team_id));
create policy note_read on note for select using (dancer_id in (select my_people()) or i_am_staff_of(team_id));
create policy note_write on note for all using (i_am_staff_of(team_id));

-- events & results: school-wide read; staff write
create policy event_read on event for select using (school_id = my_school_id() and i_am_approved());
create policy event_write on event for all using (i_am_staff() and school_id = my_school_id());
create policy signup_rw on event_signup for all using (person_id in (select my_people()) or i_am_staff());
create policy result_read on result for select using (school_id = my_school_id() and i_am_approved());
create policy result_write on result for all using (i_am_staff() and school_id = my_school_id());

-- shop & punch cards
create policy product_read on product for select using (school_id = my_school_id() and active);
create policy product_admin on product for all using (i_am_admin() and school_id = my_school_id());
create policy order_own on "order" for select using (person_id in (select my_people()));
create policy order_insert on "order" for insert with check (person_id in (select my_people()) and school_id = my_school_id() and status = 'awaiting_payment');
create policy order_claim on "order" for update using (person_id in (select my_people())) with check (status = 'awaiting_payment');
create policy order_admin on "order" for all using (i_am_admin() and school_id = my_school_id());
create policy pct_read on punch_card_type for select using (school_id = my_school_id() and active);
create policy pct_admin on punch_card_type for all using (i_am_admin() and school_id = my_school_id());
create policy pc_own on punch_card for select using (person_id in (select my_people()));
create policy pc_insert on punch_card for insert with check (person_id in (select my_people()) and status = 'awaiting_payment');
create policy pc_admin on punch_card for all using (i_am_admin());
create policy punch_own on punch for all using (exists (select 1 from punch_card c where c.id = punch.card_id and (c.person_id in (select my_people()) or i_am_admin())));
create policy milestone_read on milestone for select using (person_id in (select my_people()) or i_am_staff());
create policy milestone_write on milestone for all using (i_am_staff());
create policy audit_admin on audit_log for select using (i_am_admin() and school_id = my_school_id());

-- ---------------------------------------------------------------- public website views (anon reads ONLY these)
create view public_schedule as
  select t.school_id, t.id as team_id, t.name, t.style, t.category, t.level, t.closed, t.color,
         s.id as session_id, s.starts_at, s.ends_at, r.name as room
  from session s join team t on t.id = s.team_id left join room r on r.id = s.room_id
  where t.visibility = 'public' and not t.archived and not s.cancelled;

create view public_events as
  select school_id, id, title, kind, starts_at, place, signup_deadline, price_dkk, info
  from event where visibility = 'public';

create view public_posts as
  select p.school_id, p.id, p.body, p.created_at
  from post p where p.visibility = 'public' and not p.hidden and p.official;

create view public_products as
  select school_id, id, name, price_dkk, sizes, image_path from product where visibility = 'public' and active;

create view public_results as
  select school_id, id, event_title, placed, held_on, (select name from team where team.id = result.team_id) as team
  from result where visibility = 'public';

grant select on public_schedule, public_events, public_posts, public_products, public_results to anon, authenticated;
grant select on school to anon;   -- slug/name lookup for the website (settings column is read via a function, not exposed)
create policy school_anon on school for select to anon using (true);

-- ---------------------------------------------------------------- admin RPCs (run as definer, check admin inside)
create or replace function approve_person(p_id uuid, p_admin boolean default false, p_memberships jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  update person set status = 'approved', is_admin = p_admin, updated_at = now() where id = p_id and school_id = my_school_id();
  delete from membership where person_id = p_id;
  insert into membership(person_id, team_id, role)
    select p_id, (m->>'team_id')::uuid, (m->>'role')::member_role from jsonb_array_elements(p_memberships) m;
  insert into audit_log(school_id, actor_user, action, target, detail) values (my_school_id(), auth.uid(), 'approve_person', p_id::text, p_memberships);
end $$;

create or replace function reject_person(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  update person set status = 'rejected', updated_at = now() where id = p_id and school_id = my_school_id();
  insert into audit_log(school_id, actor_user, action, target) values (my_school_id(), auth.uid(), 'reject_person', p_id::text);
end $$;

-- signup: creates the adult's person + children in one transaction, bound to the school slug
create or replace function sign_up(p_school_slug text, p_first text, p_last text, p_phone text, p_birth_year int,
  p_roles text[], p_wished_teams text, p_children jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; pid uuid; c jsonb; cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from person where user_id = auth.uid()) then raise exception 'already registered'; end if;
  select id into sid from school where slug = p_school_slug;
  if sid is null then raise exception 'unknown school'; end if;
  insert into person(school_id, user_id, first_name, last_name, email, phone, birth_year, wished_roles, wished_teams)
    values (sid, auth.uid(), p_first, p_last, (select email from auth.users where id = auth.uid()), p_phone, p_birth_year, p_roles, p_wished_teams)
    returning id into pid;
  for c in select * from jsonb_array_elements(p_children) loop
    insert into person(school_id, first_name, last_name, birth_year, status, wished_roles)
      values (sid, c->>'first_name', coalesce(c->>'last_name', p_last), (c->>'birth_year')::int, 'pending', '{dancer}')
      returning id into cid;
    insert into guardian(parent_id, child_id, confirmed, consent_at) values (pid, cid, true, now());
  end loop;
  return pid;
end $$;

-- bootstrap: the very first approved admin of a school is created by the service role (seed), never through the app.
