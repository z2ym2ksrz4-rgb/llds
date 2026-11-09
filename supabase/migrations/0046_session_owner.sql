-- 0046: only the session's own trainer (or admin) moves/cancels a training; other staff may only take it as substitute.
--       Moving a training (time or room) notifies everyone on the team, like a cancellation does.
drop policy if exists session_update on session;
create policy session_update on session for update using (
  school_id = my_school_id() and (
    i_am_admin()
    or trainer_id = my_person_id()
    or (trainer_id is null and team_id is not null and i_am_trainer_of(team_id))
    or substitute_id = my_person_id()
    or (substitute_wanted and substitute_id is null and i_am_staff())   -- taking the substitute slot
  )
);

create or replace function trg_session_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; tname text; rname text;
begin
  select name into tname from team where id = new.team_id;
  if new.substitute_wanted and not old.substitute_wanted then
    for r in select distinct p.id from person p join membership m on m.person_id = p.id where p.school_id = new.school_id and p.status = 'approved' and m.role in ('trainer','assistant') and p.id <> coalesce(new.trainer_id, '00000000-0000-0000-0000-000000000000'::uuid)
             union select id from person where school_id = new.school_id and is_admin loop
      perform notify(r.id, 'substitute', 'Vikar søges', coalesce(tname,'') || ' · ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI'), jsonb_build_object('session_id', new.id));
    end loop;
  elsif new.cancelled and not old.cancelled and new.team_id is not null then
    for r in select team_audience(new.team_id) as id loop
      perform notify(r.id, 'session', 'Træning aflyst', coalesce(tname,'') || ' · ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI') || coalesce(' · ' || new.cancel_note, ''), jsonb_build_object('session_id', new.id));
    end loop;
  elsif not new.cancelled and new.team_id is not null and (new.starts_at <> old.starts_at or new.ends_at <> old.ends_at or new.room_id is distinct from old.room_id) then
    select name into rname from room where id = new.room_id;
    for r in select team_audience(new.team_id) as id loop
      perform notify(r.id, 'session', 'Træning flyttet', coalesce(tname,'') || ' · nu ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI') || '–' || to_char(new.ends_at at time zone 'Europe/Copenhagen', 'HH24:MI') || coalesce(' · ' || rname, '') || ' (før ' || to_char(old.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI') || ')', jsonb_build_object('session_id', new.id));
    end loop;
  end if;
  return new;
end $$;
