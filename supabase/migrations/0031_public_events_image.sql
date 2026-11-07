-- Website events = exactly the public events from Admin, with the same picture as in the app.
drop view if exists public_events;
create view public_events as
  select school_id, id, title, kind, starts_at, ends_at, place, signup_deadline, price_dkk, info, image_key,
         (select array_agg(name order by name) from team where id = any(event.team_ids) and visibility = 'public') as team_names
  from event where visibility = 'public' and starts_at >= now() - interval '1 day';
grant select on public_events to anon, authenticated;
