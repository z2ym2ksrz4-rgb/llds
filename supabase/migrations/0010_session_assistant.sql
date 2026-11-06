-- 0010: assistant trainer on a training (defaults from the team's assistant membership in the app). session_view rebuilt
-- (s.* is expanded at creation, so a new column needs drop + create).
alter table session add column if not exists assistant_id uuid references person(id) on delete set null;

drop view if exists session_view;
create view session_view as
  select s.*, t.name as team_name, r.name as room_name,
         tr.first_name || ' ' || tr.last_name as trainer_name,
         su.first_name || ' ' || su.last_name as substitute_name,
         asst.first_name || ' ' || asst.last_name as assistant_name
  from session s left join team t on t.id = s.team_id left join room r on r.id = s.room_id
  left join person tr on tr.id = s.trainer_id left join person su on su.id = s.substitute_id left join person asst on asst.id = s.assistant_id
  where s.school_id = my_school_id() and i_am_approved();
grant select on session_view to authenticated;

-- weekly creation with assistant
create or replace function create_weekly_sessions(p_team uuid, p_room uuid, p_title text, p_start timestamptz, p_end timestamptz, p_trainer uuid, p_until date, p_assistant uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare rule uuid := gen_random_uuid(); s timestamptz := p_start; e timestamptz := p_end; sid uuid := my_school_id();
begin
  if not (i_am_admin() or (p_team is not null and i_am_trainer_of(p_team))) then raise exception 'not allowed'; end if;
  while s::date <= coalesce(p_until, p_start::date) loop
    insert into session(school_id, team_id, room_id, title, starts_at, ends_at, trainer_id, assistant_id, weekly_rule_id)
      values (sid, p_team, p_room, p_title, s, e, p_trainer, p_assistant, rule);
    s := s + interval '7 days'; e := e + interval '7 days';
  end loop;
  return rule;
end $$;

-- seeded trainings: fill in the team's assistant where one exists
update session s set assistant_id = m.person_id
from membership m where m.team_id = s.team_id and m.role = 'assistant' and s.assistant_id is null;
