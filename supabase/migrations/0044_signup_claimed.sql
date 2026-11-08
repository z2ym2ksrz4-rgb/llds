-- 0044: event sign-ups remember "I have paid" – three clear states: unpaid, paid-awaiting-confirmation, confirmed.
alter table event_signup add column if not exists claimed_paid_at timestamptz;
drop view if exists event_signup_view;
create view event_signup_view with (security_invoker = true) as
  select s.*, person_name(s.person_id) as person_name,
         (select t.name from membership m join team t on t.id = m.team_id join event e on e.id = s.event_id where m.person_id = s.person_id and t.id = any(e.team_ids) limit 1) as team_name
  from event_signup s;
grant select on event_signup_view to authenticated;
