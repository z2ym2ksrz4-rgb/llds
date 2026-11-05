-- Phase 5: public website reads. Views run as owner on purpose (anon has no RLS access) and expose only website-safe columns.
alter table team add column if not exists description text;

drop view if exists public_teams;
create view public_teams as
  select t.school_id, t.id, t.name, t.style, t.category, t.level, t.closed, t.punch_card_open, t.color, t.sort, t.description,
         (select count(*) from membership m where m.team_id = t.id and m.role = 'dancer') as dancers
  from team t where t.visibility = 'public' and not t.archived;
grant select on public_teams to anon, authenticated;

-- next 7 days of trainings, so the website can draw a weekly timetable (cancelled ones excluded)
drop view if exists public_schedule;
create view public_schedule as
  select t.school_id, t.id as team_id, t.name, t.style, t.category, t.level, t.closed, t.color,
         s.id as session_id, s.starts_at, s.ends_at, r.name as room
  from session s join team t on t.id = s.team_id left join room r on r.id = s.room_id
  where t.visibility = 'public' and not t.archived and not s.cancelled
    and s.starts_at >= now() - interval '1 day' and s.starts_at < now() + interval '8 days';
grant select on public_schedule to anon, authenticated;

drop view if exists public_events;
create view public_events as
  select school_id, id, title, kind, starts_at, ends_at, place, signup_deadline, price_dkk, info,
         (select array_agg(name order by name) from team where id = any(event.team_ids) and visibility = 'public') as team_names
  from event where visibility = 'public' and starts_at >= now() - interval '1 day';
grant select on public_events to anon, authenticated;

drop view if exists public_posts;
create view public_posts as
  select p.school_id, p.id, p.body, p.created_at, (select name from team t where t.id = p.team_id) as team_name
  from post p where p.visibility = 'public' and not p.hidden and p.official;
grant select on public_posts to anon, authenticated;

drop view if exists public_products;
create view public_products as
  select school_id, id, name, price_dkk, sizes, image_path from product where visibility = 'public' and active;
grant select on public_products to anon, authenticated;
