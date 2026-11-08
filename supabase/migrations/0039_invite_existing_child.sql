-- 0039: invite_person – a child entry with an `id` links an existing dancer instead of creating a new person.
create or replace function invite_person(p_first text, p_last text, p_email text, p_phone text, p_is_parent boolean, p_memberships jsonb default '[]'::jsonb, p_children jsonb default '[]'::jsonb, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := my_school_id(); pid uuid; cid uuid; c jsonb; em text := lower(trim(p_email)); roles text[]; nm text; body text;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if exists (select 1 from person where school_id = sid and lower(email) = em) then raise exception 'email exists'; end if;
  roles := array_remove(array[case when p_is_parent then 'parent' end, case when jsonb_array_length(p_memberships) > 0 then 'dancer' end], null);
  insert into person(school_id, first_name, last_name, email, phone, status, wished_roles, source, invited_at)
    values (sid, trim(p_first), trim(coalesce(p_last, '')), em, nullif(trim(p_phone), ''), 'approved', coalesce(roles, '{}'), 'invite', now()) returning id into pid;
  insert into membership(person_id, team_id, role) select pid, (m->>'team_id')::uuid, (m->>'role')::member_role from jsonb_array_elements(p_memberships) m;
  for c in select * from jsonb_array_elements(p_children) loop
    if nullif(c->>'id', '') is not null then
      -- existing dancer: just link (must be in this school, not an admin)
      select id into cid from person where id = (c->>'id')::uuid and school_id = sid and not is_admin;
      if cid is null then raise exception 'child not found'; end if;
      insert into guardian(parent_id, child_id, confirmed) values (pid, cid, true) on conflict do nothing;
      continue;
    end if;
    insert into person(school_id, first_name, last_name, birth_date, status, wished_roles, source, invited_at)
      values (sid, trim(c->>'first_name'), trim(coalesce(c->>'last_name', p_last, '')), nullif(c->>'birth_date', '')::date, 'approved', '{dancer}', 'invite', now()) returning id into cid;
    insert into guardian(parent_id, child_id, confirmed) values (pid, cid, true);
    insert into membership(person_id, team_id, role) select cid, (m->>'team_id')::uuid, 'dancer' from jsonb_array_elements(coalesce(c->'memberships', '[]'::jsonb)) m;
  end loop;
  nm := (select string_agg(t.name, ', ') from (select distinct tm.name from membership m join team tm on tm.id = m.team_id where m.person_id = pid or m.person_id in (select child_id from guardian where parent_id = pid)) t);
  body := '<p>Du er oprettet i LL Dance Studios app' || coalesce(' – ' || nm, '') || '. Her finder du træningstider, afbud, beskeder fra træneren, koreografi og betalinger.</p>'
       || coalesce('<p style="color:#a8a49c">' || replace(p_message, E'\n', '<br>') || '</p>', '')
       || '<p>Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || em || '</b>.</p>';
  perform send_mail(sid, em, 'Velkommen i appen – LL Dance Studio', app_mail_html(sid, 'Du er inviteret', trim(p_first), body), 'invite', jsonb_build_object('person_id', pid));
  insert into audit_log(school_id, actor_user, action, target, detail) values (sid, auth.uid(), 'invite_person', pid::text, jsonb_build_object('email', em, 'children', jsonb_array_length(p_children)));
  return pid;
end $$;
grant execute on function invite_person(text, text, text, text, boolean, jsonb, jsonb, text) to authenticated;
