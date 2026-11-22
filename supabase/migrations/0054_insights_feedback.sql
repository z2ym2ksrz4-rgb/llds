-- 0054: App insights + feedback + "no teams left" reminders + trainers may remove dancers from their own team.
-- 1) last_seen: the app calls touch_seen() at start (throttled client-side); insights count live / inactive / never-logged-in from it.
alter table person add column if not exists last_seen_at timestamptz;
alter table person add column if not exists first_seen_at timestamptz;
create index if not exists person_last_seen_idx on person(school_id, last_seen_at);

create or replace function touch_seen() returns void language sql security definer set search_path = public as $$
  update person set last_seen_at = now(), first_seen_at = coalesce(first_seen_at, now()) where id = my_person_id()
$$;
grant execute on function touch_seen() to authenticated;

-- 2) feedback: linked to the person (admin sees who wrote it), one row per submission
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  person_id uuid references person(id) on delete set null,
  mood text not null default 'neutral' check (mood in ('love','ok','meh')),
  body text not null,
  context text,                          -- what the user was doing / app version / platform
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table feedback enable row level security;
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert with check (school_id = my_school_id() and person_id = my_person_id());
drop policy if exists feedback_admin on feedback;
create policy feedback_admin on feedback for all using (i_am_admin() and school_id = my_school_id());
drop view if exists feedback_view;
create view feedback_view with (security_invoker = true) as
  select f.*, person_name(f.person_id) as person_name from feedback f;

-- 3) insights: one admin-only RPC with the numbers (no raw data leaves the DB)
create or replace function app_insights() returns jsonb language plpgsql security definer set search_path = public as $$
declare s uuid := my_school_id(); r jsonb;
begin
  if not i_am_admin() then raise exception 'admin only'; end if;
  select jsonb_build_object(
    'members',        (select count(*) from person where school_id = s and status = 'approved'),
    'with_login',     (select count(*) from person where school_id = s and status = 'approved' and user_id is not null),
    'never_logged_in',(select count(*) from person where school_id = s and status = 'approved' and user_id is not null and last_seen_at is null),
    'live_24h',       (select count(*) from person where school_id = s and last_seen_at > now() - interval '24 hours'),
    'active_7d',      (select count(*) from person where school_id = s and last_seen_at > now() - interval '7 days'),
    'active_30d',     (select count(*) from person where school_id = s and last_seen_at > now() - interval '30 days'),
    'inactive_30d',   (select count(*) from person where school_id = s and status = 'approved' and user_id is not null and last_seen_at is not null and last_seen_at < now() - interval '30 days'),
    'pending',        (select count(*) from person where school_id = s and status = 'pending'),
    'no_team',        (select count(*) from person p where p.school_id = s and p.status = 'approved' and not p.is_admin
                          and not exists (select 1 from membership m where m.person_id = p.id)
                          and not exists (select 1 from guardian g join membership m on m.person_id = g.child_id where g.parent_id = p.id)),
    'posts_30d',      (select count(*) from post where school_id = s and created_at > now() - interval '30 days'),
    'comments_30d',   (select count(*) from comment c join post p on p.id = c.post_id where p.school_id = s and c.created_at > now() - interval '30 days'),
    'messages_30d',   (select count(*) from message where school_id = s and created_at > now() - interval '30 days'),
    'threads_30d',    (select count(*) from thread_message tm join thread t on t.id = tm.thread_id where t.school_id = s and tm.created_at > now() - interval '30 days'),
    'bookings_30d',   (select count(*) from booking where school_id = s and created_at > now() - interval '30 days'),
    'absences_30d',   (select count(*) from absence a join session se on se.id = a.session_id where se.school_id = s and a.created_at > now() - interval '30 days'),
    'feedback_total', (select count(*) from feedback where school_id = s),
    'feedback_unread',(select count(*) from feedback where school_id = s and read_at is null),
    'never_list',     (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name, 'since', created_at) order by created_at), '[]'::jsonb)
                          from (select id, first_name, last_name, created_at from person where school_id = s and status = 'approved' and user_id is not null and last_seen_at is null order by created_at limit 50) x),
    'inactive_list',  (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name, 'last', last_seen_at) order by last_seen_at), '[]'::jsonb)
                          from (select id, first_name, last_name, last_seen_at from person where school_id = s and status = 'approved' and user_id is not null and last_seen_at < now() - interval '30 days' order by last_seen_at limit 50) x),
    'no_team_list',   (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name) order by last_name, first_name), '[]'::jsonb)
                          from (select p.id, p.first_name, p.last_name from person p where p.school_id = s and p.status = 'approved' and not p.is_admin
                                  and not exists (select 1 from membership m where m.person_id = p.id)
                                  and not exists (select 1 from guardian g join membership m on m.person_id = g.child_id where g.parent_id = p.id)
                                order by p.last_name, p.first_name limit 100) p)
  ) into r;
  return r;
end $$;
grant execute on function app_insights() to authenticated;

-- 4) "no teams left": when a membership is removed and the person (and, for parents, all their children) has no team left, remind the admins.
create or replace function trg_membership_orphan() returns trigger language plpgsql security definer set search_path = public as $$
declare p person; par record; school uuid;
begin
  select * into p from person where id = old.person_id; if p.id is null then return old; end if;
  school := p.school_id;
  if not p.is_admin and not exists (select 1 from membership m where m.person_id = p.id) then
    perform notify_admins(school, 'signup', p.first_name || ' ' || p.last_name || ' er ikke længere på noget hold',
      'Sæt personen på et hold igen – eller slet brugeren under Admin → Medlemmer.', jsonb_build_object('person_id', p.id, 'reason', 'no_team'));
    -- parents whose children now all are off teams (and who have no teams themselves)
    for par in select pp.* from guardian g join person pp on pp.id = g.parent_id where g.child_id = p.id loop
      if not par.is_admin
         and not exists (select 1 from membership m where m.person_id = par.id)
         and not exists (select 1 from guardian g2 join membership m2 on m2.person_id = g2.child_id where g2.parent_id = par.id) then
        perform notify_admins(school, 'signup', par.first_name || ' ' || par.last_name || ' (forælder) har ingen børn på hold længere',
          'Forælderen følger barnet – slet begge under Admin → Medlemmer, hvis de er stoppet.', jsonb_build_object('person_id', par.id, 'reason', 'parent_no_team'));
      end if;
    end loop;
  end if;
  return old;
end $$;
drop trigger if exists membership_orphan on membership;
create trigger membership_orphan after delete on membership for each row execute function trg_membership_orphan();

-- 5) trainers (not assistants) may remove dancers from the teams they train; adding/deleting anything else stays admin-only
drop policy if exists membership_trainer_remove on membership;
create policy membership_trainer_remove on membership for delete using (role = 'dancer' and i_am_trainer_of(team_id));

-- verification
select 'chk' as chk, (select count(*) from feedback) as feedback_rows, (select column_name from information_schema.columns where table_name = 'person' and column_name = 'last_seen_at') as col;
