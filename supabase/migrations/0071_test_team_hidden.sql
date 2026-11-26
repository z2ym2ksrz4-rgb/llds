-- Test teams (Testholdet) and their trainings are visible only to administrators and to the team's own members.
-- Real dancers, parents and trainers never meet them in the calendar, in "Tilmeld nyt hold" or in any team list.
alter table team add column if not exists is_test boolean not null default false;
update team set is_test = true where name = 'Testholdet';

create or replace function team_is_test(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_test from team where id = t), false)
$$;

drop policy if exists team_read on team;
create policy team_read on team for select using (
  school_id = my_school_id() and i_am_approved()
  and (not is_test or i_am_admin() or id in (select my_team_ids())));

drop policy if exists session_read on session;
create policy session_read on session for select using (
  school_id = my_school_id() and i_am_approved()
  and (team_id is null or not team_is_test(team_id) or i_am_admin() or team_id in (select my_team_ids())));

insert into schema_migration(name) values ('0071_test_team_hidden') on conflict do nothing;
