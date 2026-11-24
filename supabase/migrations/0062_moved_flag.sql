-- 0062: `moved` flag on sessions – a session whose local weekday/time/room differs from the usual slot of its
-- weekly rule (the mode across all sessions sharing weekly_rule_id). Used by the website's week calendar and the
-- app's Sale view to show "Flyttet" next to "Aflyst". session_view and public_schedule rebuilt (s.* freezes columns).

create or replace function session_usual(p_rule uuid)
returns table (dw int, st time, et time, room_id uuid)
language sql stable security definer set search_path = public as $$
  select extract(isodow from s.starts_at at time zone 'Europe/Copenhagen')::int,
         (s.starts_at at time zone 'Europe/Copenhagen')::time,
         (s.ends_at at time zone 'Europe/Copenhagen')::time,
         s.room_id
  from session s where s.weekly_rule_id = p_rule
  group by 1, 2, 3, 4 order by count(*) desc, 1, 2 limit 1
$$;

create or replace function session_moved(p_session session)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_session.weekly_rule_id is null then false else coalesce((
    select extract(isodow from p_session.starts_at at time zone 'Europe/Copenhagen')::int <> u.dw
        or (p_session.starts_at at time zone 'Europe/Copenhagen')::time <> u.st
        or (p_session.ends_at at time zone 'Europe/Copenhagen')::time <> u.et
        or p_session.room_id is distinct from u.room_id
    from session_usual(p_session.weekly_rule_id) u), false) end
$$;

drop view if exists session_view;
create view session_view as
  select s.*, t.name as team_name, r.name as room_name,
         tr.first_name || ' ' || tr.last_name as trainer_name,
         su.first_name || ' ' || su.last_name as substitute_name,
         asst.first_name || ' ' || asst.last_name as assistant_name,
         session_moved(s) as moved
  from session s left join team t on t.id = s.team_id left join room r on r.id = s.room_id
  left join person tr on tr.id = s.trainer_id left join person su on su.id = s.substitute_id left join person asst on asst.id = s.assistant_id
  where s.school_id = my_school_id() and i_am_approved();
grant select on session_view to authenticated;

drop view if exists public_schedule;
create view public_schedule as
  select t.school_id, t.id as team_id, t.name, t.style, t.category, t.level, t.closed, t.color,
         s.id as session_id, s.starts_at, s.ends_at, r.name as room, s.cancelled, s.weekly_rule_id,
         session_moved(s) as moved
  from session s join team t on t.id = s.team_id left join room r on r.id = s.room_id
  where t.visibility = 'public' and not t.archived;
grant select on public_schedule to anon, authenticated;
