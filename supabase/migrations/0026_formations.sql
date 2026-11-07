-- 0026: formation tool – per team, a set of named formation plans; each plan is a sequence of frames with the dancers' spots on stage.
create table if not exists formation_set (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references team(id) on delete cascade,
  title text not null,
  created_by uuid not null references person(id),
  frames jsonb not null default '[]'::jsonb,   -- [{id, label, at, positions:[{key, label, name, x, y}]}]  x/y 0..1 (x left→right, y back→front)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table formation_set enable row level security;
drop policy if exists formation_read on formation_set; drop policy if exists formation_write on formation_set;
create policy formation_read on formation_set for select using (team_id in (select my_team_ids()) or i_am_staff_of(team_id) or i_am_admin());
create policy formation_write on formation_set for all using (i_am_staff_of(team_id) or i_am_admin()) with check (i_am_staff_of(team_id) or i_am_admin());
-- dancers on the team (for the editor's roster): name + initials, readable by anyone on the team
create or replace function team_dancers(p_team uuid) returns table (person_id uuid, name text, initials text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || p.last_name, upper(left(p.first_name, 1) || coalesce(left(p.last_name, 1), ''))
  from membership m join person p on p.id = m.person_id
  where m.team_id = p_team and m.role = 'dancer' and p.status = 'approved' and (p_team in (select my_team_ids()) or i_am_staff_of(p_team) or i_am_admin())
  order by p.first_name
$$;
grant execute on function team_dancers(uuid) to authenticated;
