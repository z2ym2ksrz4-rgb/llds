-- Phase 2: schedule helpers, substitute flag, supervised child login, roster view.
alter table session add column if not exists substitute_wanted boolean not null default false;
alter table team add column if not exists cover_path text;

-- A supervised child's login: the parent sets an e-mail on the child; the first OTP sign-in with that e-mail claims the person.
create or replace function grant_child_login(p_child uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id();
begin
  if not exists (select 1 from guardian g where g.parent_id = me and g.child_id = p_child) then raise exception 'not your child'; end if;
  if exists (select 1 from person c where c.id = p_child and c.birth_year is not null and extract(year from now()) - c.birth_year < 10) then raise exception 'child too young'; end if;
  if exists (select 1 from person where lower(email) = lower(p_email) and id <> p_child) then raise exception 'email in use'; end if;
  update person set email = lower(p_email), supervised_by = me, updated_at = now() where id = p_child;
  update guardian set consent_at = now() where parent_id = me and child_id = p_child;
end $$;

create or replace function revoke_child_login(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from guardian g where g.parent_id = my_person_id() and g.child_id = p_child) and not i_am_admin() then raise exception 'not your child'; end if;
  update person set email = null, user_id = null, supervised_by = null, updated_at = now() where id = p_child;
end $$;

-- Called by the app right after sign-in when no person is bound to auth.uid(): binds a pre-created person with the same e-mail.
create or replace function claim_person()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null then return null; end if;
  if exists (select 1 from person where user_id = auth.uid()) then return (select id from person where user_id = auth.uid()); end if;
  select id into pid from person where lower(email) = lower(em) and user_id is null and status in ('pending','approved') limit 1;
  if pid is null then return null; end if;
  update person set user_id = auth.uid(), updated_at = now() where id = pid;
  return pid;
end $$;

-- Weekly sessions: one call creates the whole run (first date .. until, same weekday/time).
create or replace function create_weekly_sessions(p_team uuid, p_room uuid, p_title text, p_start timestamptz, p_end timestamptz, p_trainer uuid, p_until date)
returns uuid language plpgsql security definer set search_path = public as $$
declare rule uuid := gen_random_uuid(); s timestamptz := p_start; e timestamptz := p_end; sid uuid := my_school_id();
begin
  if not (i_am_admin() or (p_team is not null and i_am_trainer_of(p_team))) then raise exception 'not allowed'; end if;
  while s::date <= coalesce(p_until, p_start::date) loop
    insert into session(school_id, team_id, room_id, title, starts_at, ends_at, trainer_id, weekly_rule_id)
      values (sid, p_team, p_room, p_title, s, e, p_trainer, rule);
    s := s + interval '7 days'; e := e + interval '7 days';
  end loop;
  return rule;
end $$;

-- Attendance roster for a session: members of the team (dancers) + their absence, in one query.
create or replace function session_roster(p_session uuid)
returns table (person_id uuid, name text, birth_year int, role member_role, present boolean, via_punch boolean, absence_id uuid, reason text, note text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || p.last_name, p.birth_year, m.role, a.present, coalesce(a.via_punch,false), ab.id, ab.reason, ab.note
  from session s
  join membership m on m.team_id = s.team_id and m.role = 'dancer'
  join person p on p.id = m.person_id and p.status = 'approved'
  left join attendance a on a.session_id = s.id and a.person_id = p.id
  left join absence ab on ab.session_id = s.id and ab.person_id = p.id
  where s.id = p_session and (i_am_staff_of(s.team_id) or p.id in (select my_people()))
  order by p.first_name
$$;

-- Sessions with names, for the calendar.
create or replace view session_view as
  select s.*, t.name as team_name, r.name as room_name,
         tr.first_name || ' ' || tr.last_name as trainer_name,
         su.first_name || ' ' || su.last_name as substitute_name
  from session s left join team t on t.id = s.team_id left join room r on r.id = s.room_id
  left join person tr on tr.id = s.trainer_id left join person su on su.id = s.substitute_id;
grant select on session_view to authenticated;

create or replace view booking_view as
  select b.*, r.name as room_name, p.first_name || ' ' || p.last_name as person_name
  from booking b join room r on r.id = b.room_id join person p on p.id = b.person_id;
grant select on booking_view to authenticated;

-- staff may read each other (names for pickers)
create policy person_staff_peers on person for select using (
  i_am_staff() and status = 'approved' and (is_admin or exists (select 1 from membership m where m.person_id = person.id and m.role in ('trainer','assistant'))));
