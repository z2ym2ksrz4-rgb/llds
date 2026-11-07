-- 0020: "present unless an absence is registered". After a training has ended, every dancer on the team without an attendance row and
-- without an absence is recorded as present, so streak/total emblems count by themselves. Trainers' own attendance (saveAttendance) always wins.
-- Punch-card teams (Hit Fit) are excluded – presence there is a paid punch and must be marked by the trainer.
create or replace function settle_attendance() returns int language plpgsql security definer set search_path = public as $$
declare n int; begin
  insert into attendance(session_id, person_id, present, via_punch)
  select s.id, m.person_id, true, false
  from session s
  join team t on t.id = s.team_id and not t.punch_card_open
  join membership m on m.team_id = s.team_id and m.role = 'dancer'
  join person p on p.id = m.person_id and p.status = 'approved'
  where not s.cancelled and s.ends_at < now() - interval '1 hour' and s.ends_at > now() - interval '45 days'
    and not exists (select 1 from attendance a where a.session_id = s.id and a.person_id = m.person_id)
    and not exists (select 1 from absence x where x.session_id = s.id and x.person_id = m.person_id)
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;
grant execute on function settle_attendance() to authenticated;

-- hourly via pg_cron when the extension is available (Supabase: Database → Extensions → pg_cron); the app also calls it on Home load, so it works without cron.
do $$ begin
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule('settle_attendance') from cron.job where jobname = 'settle_attendance';
    perform cron.schedule('settle_attendance', '17 * * * *', 'select settle_attendance()');
  exception when others then raise notice 'pg_cron not available: %', sqlerrm;
  end;
end $$;
