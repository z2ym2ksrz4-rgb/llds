-- An administrator can sign any person in the school up for a team (used from "Vis appen som" and when helping a family).
-- The payment then belongs to that person's own household: first confirmed parent, else the person – never the admin.
do $$
declare src text := pg_get_functiondef('app_signup_team(uuid,uuid,text)'::regprocedure); a text; b text; n text := src;
begin
  a := 'me uuid := my_person_id(); q record;';
  if position(a in n) = 0 then raise exception 'anchor 1 missing'; end if;
  n := replace(n, a, 'me uuid := my_person_id(); ct uuid; q record;');
  a := 'if not (p_person = me or p_person in (select my_people())) then raise exception ''not your person''; end if;';
  if position(a in n) = 0 then raise exception 'anchor 2 missing'; end if;
  n := replace(n, a,
    'if p_person = me or p_person in (select my_people()) then ct := me; '
    || 'elsif i_am_admin() and exists (select 1 from person where id = p_person and school_id = my_school_id()) then '
    || 'ct := coalesce((select g.parent_id from guardian g where g.child_id = p_person order by g.confirmed desc nulls last limit 1), p_person); '
    || 'else raise exception ''not your person''; end if;');
  a := 'from season_quote(tm.id, me, p_plan)';
  if position(a in n) = 0 then raise exception 'anchor 3 missing'; end if;
  n := replace(n, a, 'from season_quote(tm.id, ct, p_plan)');
  a := 'p_person, me, tm.id, p_plan';
  if position(a in n) = 0 then raise exception 'anchor 4 missing'; end if;
  n := replace(n, a, 'p_person, ct, tm.id, p_plan');
  execute n;
end $$;
insert into schema_migration(name) values ('0072_admin_signup_for_others') on conflict do nothing;
