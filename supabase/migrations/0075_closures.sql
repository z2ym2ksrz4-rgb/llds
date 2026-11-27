-- Ferier og fridage: periods without fixed trainings – for the whole school or for chosen teams.
-- New weekly series skip them. Saving a period removes the fixed trainings that already lie in it and keeps them
-- on the period row, so deleting the period can put them back.
create table if not exists closure (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  name text not null,
  from_date date not null,
  to_date date not null,
  team_ids uuid[],                         -- null = the whole school
  removed jsonb not null default '[]'::jsonb,   -- the session rows this period took out (for restore)
  created_by uuid references person(id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists closure_school_idx on closure(school_id, from_date);
alter table closure enable row level security;
drop policy if exists closure_read on closure;
create policy closure_read on closure for select using (school_id = my_school_id() and i_am_approved());
-- writes only through the functions below

create or replace function closure_hits(p_team uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from closure c join team t on t.id = p_team
                 where c.school_id = t.school_id and p_day between c.from_date and c.to_date
                   and (c.team_ids is null or p_team = any(c.team_ids)))
$$;

-- what everyone may see of a period (no restore data)
create or replace view closure_view with (security_invoker = true) as
  select c.id, c.school_id, c.name, c.from_date, c.to_date, c.team_ids, jsonb_array_length(c.removed) as removed_count, c.created_at from closure c;
grant select on closure_view to authenticated;

-- fixed trainings a period would remove (coming ones only; single trainings such as camps are left alone)
create or replace function closure_sessions(p_from date, p_to date, p_team_ids uuid[]) returns setof session
language sql stable security definer set search_path = public as $$
  select s.* from session s
  where s.school_id = my_school_id() and s.team_id is not null and s.weekly_rule_id is not null and s.starts_at >= now()
    and (s.starts_at at time zone 'Europe/Copenhagen')::date between p_from and p_to
    and (p_team_ids is null or s.team_id = any(p_team_ids))
$$;
revoke all on function closure_sessions(date, date, uuid[]) from public, anon, authenticated;

create or replace function closure_preview(p_from date, p_to date, p_team_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  return (select jsonb_build_object('sessions', count(*), 'teams', count(distinct team_id)) from closure_sessions(p_from, p_to, p_team_ids));
end $$;
grant execute on function closure_preview(date, date, uuid[]) to authenticated;

create or replace function closure_restore(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; c closure;
begin
  select * into c from closure where id = p_id and school_id = my_school_id(); if c.id is null then return 0; end if;
  with ins as (
    insert into session select r.* from jsonb_populate_recordset(null::session, c.removed) r
      where exists (select 1 from team t where t.id = r.team_id)      -- the team may be gone since
    on conflict (id) do nothing returning 1)
  select count(*) into n from ins;
  update closure set removed = '[]'::jsonb where id = p_id;
  return n;
end $$;
revoke all on function closure_restore(uuid) from public, anon, authenticated;

create or replace function save_closure(p_id uuid, p_name text, p_from date, p_to date, p_team_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := p_id; taken jsonb; n int; tids uuid[] := case when p_team_ids is null or cardinality(p_team_ids) = 0 then null else p_team_ids end;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'missing name'; end if;
  if p_to < p_from then raise exception 'bad dates'; end if;
  if p_to - p_from > 120 then raise exception 'too long'; end if;
  if cid is not null then
    if not exists (select 1 from closure where id = cid and school_id = my_school_id()) then raise exception 'unknown closure'; end if;
    perform closure_restore(cid);       -- changed dates or teams: put back what the old version took, then apply the new one
    update closure set name = trim(p_name), from_date = p_from, to_date = p_to, team_ids = tids where id = cid;
  else
    insert into closure(school_id, name, from_date, to_date, team_ids, created_by) values (my_school_id(), trim(p_name), p_from, p_to, tids, my_person_id()) returning id into cid;
  end if;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb), count(*) into taken, n from closure_sessions(p_from, p_to, tids) s;
  delete from session where id in (select (x->>'id')::uuid from jsonb_array_elements(taken) x);
  update closure set removed = taken where id = cid;
  return jsonb_build_object('id', cid, 'removed', n);
end $$;
grant execute on function save_closure(uuid, text, date, date, uuid[]) to authenticated;

create or replace function delete_closure(p_id uuid, p_restore boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if not exists (select 1 from closure where id = p_id and school_id = my_school_id()) then raise exception 'unknown closure'; end if;
  if p_restore then n := closure_restore(p_id); end if;
  delete from closure where id = p_id;
  return jsonb_build_object('restored', n);
end $$;
grant execute on function delete_closure(uuid, boolean) to authenticated;

-- new weekly series skip the periods
do $$
declare src text := pg_get_functiondef('create_weekly_sessions(uuid,uuid,text,timestamptz,timestamptz,uuid,date,uuid)'::regprocedure);
  a text := 'insert into session(school_id, team_id, room_id, title, starts_at, ends_at, trainer_id, assistant_id, weekly_rule_id)';
  b text := 'values (sid, p_team, p_room, p_title, s, e, p_trainer, p_assistant, rule);';
begin
  if position('closure_hits' in src) > 0 then return; end if;
  if position(a in src) = 0 or position(b in src) = 0 then raise exception 'anchor missing'; end if;
  src := replace(src, a, 'if p_team is null or not closure_hits(p_team, (s at time zone ''Europe/Copenhagen'')::date) then ' || a);
  src := replace(src, b, b || ' end if;');
  execute src;
end $$;
insert into schema_migration(name) values ('0075_closures') on conflict do nothing;
