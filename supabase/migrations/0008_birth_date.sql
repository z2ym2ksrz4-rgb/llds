-- 0008: exact birth date (a birth year cannot tell 12 from 13). birth_year is kept in sync for older code.
alter table person add column if not exists birth_date date;

create or replace function person_age(p person) returns int language sql immutable as $$
  select case when p.birth_date is not null then extract(year from age(current_date, p.birth_date))::int
              when p.birth_year is not null then extract(year from current_date)::int - p.birth_year
              else null end
$$;

create or replace function person_sync_birth_year() returns trigger language plpgsql as $$
begin
  if new.birth_date is not null then new.birth_year := extract(year from new.birth_date)::int; end if;
  return new;
end $$;
drop trigger if exists person_sync_birth_year on person;
create trigger person_sync_birth_year before insert or update of birth_date on person for each row execute function person_sync_birth_year();

-- sign_up: accepts birth dates (ISO yyyy-mm-dd) for the adult and the children; the year params stay for older clients
create or replace function sign_up(p_school_slug text, p_first text, p_last text, p_phone text, p_birth_year int,
  p_roles text[], p_wished_teams text, p_children jsonb default '[]'::jsonb, p_birth_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; pid uuid; c jsonb; cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from person where user_id = auth.uid()) then raise exception 'already registered'; end if;
  select id into sid from school where slug = p_school_slug;
  if sid is null then raise exception 'unknown school'; end if;
  insert into person(school_id, user_id, first_name, last_name, email, phone, birth_year, birth_date, wished_roles, wished_teams)
    values (sid, auth.uid(), p_first, p_last, (select email from auth.users where id = auth.uid()), p_phone, coalesce(p_birth_year, extract(year from p_birth_date)::int), p_birth_date, p_roles, p_wished_teams)
    returning id into pid;
  for c in select * from jsonb_array_elements(p_children) loop
    insert into person(school_id, first_name, last_name, birth_year, birth_date, status, wished_roles)
      values (sid, c->>'first_name', coalesce(c->>'last_name', p_last), coalesce((c->>'birth_year')::int, extract(year from (c->>'birth_date')::date)::int), (c->>'birth_date')::date, 'pending', '{dancer}')
      returning id into cid;
    insert into guardian(parent_id, child_id, confirmed, consent_at) values (pid, cid, true, now());
  end loop;
  return pid;
end $$;

-- child login: exact age ≥ 10
create or replace function grant_child_login(p_child uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id();
begin
  if not exists (select 1 from guardian g where g.parent_id = me and g.child_id = p_child) then raise exception 'not your child'; end if;
  if exists (select 1 from person c where c.id = p_child and person_age(c) is not null and person_age(c) < 10) then raise exception 'child too young'; end if;
  if exists (select 1 from person where lower(email) = lower(p_email) and id <> p_child) then raise exception 'email in use'; end if;
  update person set email = lower(p_email), supervised_by = me, updated_at = now() where id = p_child;
  update guardian set consent_at = now() where parent_id = me and child_id = p_child;
end $$;

-- parents of under-13s see choreography videos: exact age
drop policy if exists video_read on video;
create policy video_read on video for select using (
  i_am_staff_of(team_id) or
  exists (select 1 from membership m where m.team_id = video.team_id and m.person_id = my_person_id()) or
  exists (select 1 from membership m join guardian g on g.child_id = m.person_id join team t on t.id = m.team_id join person c on c.id = m.person_id
          where m.team_id = video.team_id and g.parent_id = my_person_id()
            and (t.parents_see_video or (person_age(c) is not null and person_age(c) < 13))));
