-- A weekly series created in the app was stepped forward 7 × 24 hours in UTC, so after the switch to summer time (or back)
-- every training in the series started one hour off in Danish time. The step is now 7 calendar days in Europe/Copenhagen.
do $$
declare src text := pg_get_functiondef('create_weekly_sessions(uuid,uuid,text,timestamptz,timestamptz,uuid,date,uuid)'::regprocedure);
  a text := 's := s + interval ''7 days''; e := e + interval ''7 days'';';
begin
  if position(a in src) = 0 then raise exception 'anchor missing'; end if;
  execute replace(src, a,
    's := ((s at time zone ''Europe/Copenhagen'') + interval ''7 days'') at time zone ''Europe/Copenhagen''; '
    || 'e := ((e at time zone ''Europe/Copenhagen'') + interval ''7 days'') at time zone ''Europe/Copenhagen'';');
end $$;
-- how many existing series are affected (for the person running this): series whose Danish start time is not the same all the way through
select count(*) as series_with_shifting_time from (
  select weekly_rule_id from session where weekly_rule_id is not null group by 1
  having count(distinct (starts_at at time zone 'Europe/Copenhagen')::time) > 1) x;
insert into schema_migration(name) values ('0074_weekly_series_keeps_local_time') on conflict do nothing;
