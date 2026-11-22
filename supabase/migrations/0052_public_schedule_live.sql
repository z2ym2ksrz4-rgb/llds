-- 0052: the website's week calendar is live from the app: include cancelled sessions (shown as AFLYST) and the room.
drop view if exists public_schedule;
create view public_schedule as
  select t.school_id, t.id as team_id, t.name, t.style, t.category, t.level, t.closed, t.color,
         s.id as session_id, s.starts_at, s.ends_at, r.name as room, s.cancelled, s.weekly_rule_id
  from session s join team t on t.id = s.team_id left join room r on r.id = s.room_id
  where t.visibility = 'public' and not t.archived;
grant select on public_schedule to anon, authenticated;
