-- 0079: the audience helpers follow 0078 – test persons (no login) count as recipients, so "Vis appen som" shows the same counters a member gets.
-- Also: an event aimed at named dancers (event.person_ids, 0063) used to notify the whole school when it had no teams; now it notifies those dancers and their parents.
create or replace function can_notify(p person) returns boolean language sql immutable as $$ select p.user_id is not null or p.last_name = 'Testperson' $$;

create or replace function team_audience(p_team uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct x from (
    select m.person_id as x from membership m join person p on p.id = m.person_id where m.team_id = p_team and can_notify(p) and p.status = 'approved'
    union
    select g.parent_id from membership m join guardian g on g.child_id = m.person_id join person p on p.id = g.parent_id where m.team_id = p_team and p.status = 'approved'
  ) s
$$;

create or replace function trg_message_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if (new.audience->>'all')::boolean is true then
    for r in select p.id from person p where p.school_id = new.school_id and p.status = 'approved' and can_notify(p) loop
      perform notify(r.id, 'message', new.title, left(new.body, 120), jsonb_build_object('message_id', new.id));
    end loop;
  else
    for r in select distinct team_audience(t::uuid) as id from jsonb_array_elements_text(coalesce(new.audience->'teams','[]'::jsonb)) t loop
      perform notify(r.id, 'message', new.title, left(new.body, 120), jsonb_build_object('message_id', new.id));
    end loop;
  end if;
  return new;
end $$;

create or replace function trg_event_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; body text;
begin
  body := to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM') || coalesce(' · ' || new.place, '');
  if array_length(new.team_ids, 1) is null and array_length(new.person_ids, 1) is null then
    for r in select p.id from person p where p.school_id = new.school_id and p.status = 'approved' and can_notify(p) loop
      perform notify(r.id, 'event', new.title, body, jsonb_build_object('event_id', new.id));
    end loop;
  else
    for r in select distinct x as id from (
        select team_audience(t) as x from unnest(new.team_ids) t
        union select p from unnest(new.person_ids) p
        union select g.parent_id from guardian g where g.child_id = any(new.person_ids)
      ) s loop
      perform notify(r.id, 'event', new.title, body, jsonb_build_object('event_id', new.id));
    end loop;
  end if;
  return new;
end $$;

create or replace function trg_post_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare tn text; an text; recips uuid[];
begin
  if new.hidden then return new; end if;
  select first_name into an from person where id = new.author_id;
  if new.team_id is not null then
    select name into tn from team where id = new.team_id;
    select coalesce(array_agg(distinct x), '{}') into recips from (
      select m.person_id as x from membership m where m.team_id = new.team_id
      union select g.parent_id from membership m join guardian g on g.child_id = m.person_id where m.team_id = new.team_id and m.role = 'dancer'
    ) r where x <> new.author_id;
  else
    select coalesce(array_agg(p.id), '{}') into recips from person p where p.school_id = new.school_id and p.status = 'approved' and p.id <> new.author_id and can_notify(p);
    tn := null;
  end if;
  perform notify(x, 'post', coalesce(an, 'Nyt opslag') || case when new.official then ' (officielt)' else '' end || coalesce(' · ' || tn, ''), left(new.body, 120), jsonb_build_object('post_id', new.id, 'team_id', new.team_id)) from unnest(recips) x;
  return new;
end $$;

insert into schema_migration(name) values ('0079_notify_audience') on conflict do nothing;
select 'chk' as chk, (select count(*) from pg_proc where proname = 'can_notify') as fn;
