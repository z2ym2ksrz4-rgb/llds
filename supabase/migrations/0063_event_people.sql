-- 0063: events can be aimed at specific people (a disco solo, a duo) as well as teams. Empty team_ids AND empty
-- person_ids = everyone. Dancers/parents only see events that concern their household; staff see all (client filter,
-- RLS unchanged – staff need the full list and "Vis appen som" must mirror the persona).
alter table event add column if not exists person_ids uuid[] not null default '{}';

drop view if exists event_view;
create view event_view with (security_invoker = true) as
  select e.*, (select count(*) from event_signup s where s.event_id = e.id) as signups,
         (select array_agg(name order by name) from team where id = any(e.team_ids)) as team_names,
         (select array_agg(first_name || ' ' || last_name order by first_name) from person where id = any(e.person_ids)) as person_names
  from event e;
grant select on event_view to authenticated;

select 'chk' as chk, (select count(*) from information_schema.columns where table_name = 'event' and column_name = 'person_ids') as cols;
