-- Home carousel: each team's own pictures. Admin and the team's trainer/assistant pick them; empty = the app picks at random (Line's photos → folder media → catalog).
alter table team add column if not exists gallery text[] not null default '{}';
create or replace function set_team_gallery(p_team uuid, p_refs text[]) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (i_am_admin() or i_am_staff_of(p_team)) then raise exception 'not allowed'; end if;
  update team set gallery = coalesce(p_refs, '{}') where id = p_team and school_id = my_school_id();
end $$;
grant execute on function set_team_gallery(uuid, text[]) to authenticated;
-- the public team view used by the website keeps its column list; nothing to change there.
