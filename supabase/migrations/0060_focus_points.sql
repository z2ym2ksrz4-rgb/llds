-- 0060: focus point for photos (where the important part of the picture is, 0–1 × 0–1), set in Admin by tapping the picture.
-- Used as background-position so heroes/cards never crop faces away, whatever the screen format.
alter table team add column if not exists focus jsonb;
alter table event add column if not exists focus jsonb;

-- event_view freezes e.* – recreate so the app sees focus (same definition as 0017)
drop view if exists event_view;
create view event_view with (security_invoker = true) as
  select e.*, (select count(*) from event_signup s where s.event_id = e.id) as signups,
         (select array_agg(name order by name) from team where id = any(e.team_ids)) as team_names
  from event e;
grant select on event_view to authenticated;

select 'chk' as chk, (select count(*) from information_schema.columns where table_name in ('team','event') and column_name = 'focus') as cols;
