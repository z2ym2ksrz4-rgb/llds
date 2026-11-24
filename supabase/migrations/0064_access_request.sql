-- 0064: "Ansøg om adgang til Backstage" from the website (anon) – for people who already dance / are parents but
-- have no login. Creates pending person(s) with wished teams; Line approves in Nye brugere (teams are pre-ticked
-- from the wished names). Under 13 without a parent → refused with 'too young' (a parent must apply).
create or replace function web_access_request(p_school_slug text, p_first text, p_last text, p_email text, p_phone text,
  p_birth_date date default null, p_teams text default null, p_children jsonb default '[]'::jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; em text := lower(trim(p_email)); contact uuid; cid uuid; c jsonb; n int := 0; kids text := ''; age int; body text;
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(p_first)) < 1 then raise exception 'missing name'; end if;
  if (select count(*) from person where school_id = sid and lower(email) = em and created_at > now() - interval '1 day') >= 3 then raise exception 'too many'; end if;
  if p_birth_date is not null then age := date_part('year', age(p_birth_date))::int; if age < 13 and jsonb_array_length(coalesce(p_children, '[]'::jsonb)) = 0 then raise exception 'too young'; end if; end if;
  select id into contact from person where school_id = sid and lower(email) = em order by (user_id is not null) desc limit 1;
  if contact is not null and exists (select 1 from person where id = contact and user_id is not null) then raise exception 'has login'; end if;
  if contact is null then
    insert into person(school_id, first_name, last_name, email, phone, birth_date, status, wished_roles, wished_teams, source)
    values (sid, trim(p_first), trim(coalesce(p_last, '')), em, nullif(trim(p_phone), ''), p_birth_date, 'pending',
      array_remove(array[case when nullif(trim(coalesce(p_teams, '')), '') is not null then 'dancer' end, case when jsonb_array_length(coalesce(p_children, '[]'::jsonb)) > 0 then 'parent' end], null),
      concat_ws(' · ', nullif(trim(coalesce(p_teams, '')), ''), case when nullif(trim(coalesce(p_note, '')), '') is not null then 'Note: ' || trim(p_note) end), 'web_access')
    returning id into contact;
  else
    update person set status = case when status = 'approved' then status else 'pending' end, phone = coalesce(nullif(trim(p_phone), ''), phone), birth_date = coalesce(birth_date, p_birth_date),
      wished_teams = concat_ws(' · ', wished_teams, nullif(trim(coalesce(p_teams, '')), ''), case when nullif(trim(coalesce(p_note, '')), '') is not null then 'Note: ' || trim(p_note) end) where id = contact;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_children, '[]'::jsonb)) loop
    if length(trim(coalesce(c->>'first_name', ''))) < 1 then continue; end if;
    select p.id into cid from person p join guardian g on g.child_id = p.id where g.parent_id = contact and lower(p.first_name) = lower(trim(c->>'first_name')) limit 1;
    if cid is null then
      insert into person(school_id, first_name, last_name, birth_date, status, wished_roles, wished_teams, source)
      values (sid, trim(c->>'first_name'), trim(coalesce(nullif(c->>'last_name', ''), p_last, '')), nullif(c->>'birth_date', '')::date, 'pending', '{dancer}', nullif(trim(coalesce(c->>'teams', '')), ''), 'web_access') returning id into cid;
      insert into guardian(parent_id, child_id) values (contact, cid) on conflict do nothing;
    else update person set wished_teams = concat_ws(' · ', wished_teams, nullif(trim(coalesce(c->>'teams', '')), '')) where id = cid; end if;
    n := n + 1; kids := concat_ws(', ', kids, trim(c->>'first_name'));
  end loop;
  perform notify_admins(sid, 'signup', 'Ansøgning om adgang til Backstage 🔑', trim(p_first) || ' ' || trim(coalesce(p_last, '')) || coalesce(' – ' || nullif(trim(coalesce(p_teams, '')), ''), '') || case when n > 0 then ' · forælder til ' || kids else '' end, jsonb_build_object('person_id', contact));
  body := '<p>Tak for din ansøgning om adgang til Backstage. Danseskolen godkender dig – typisk inden for et par dage – og så får du en mail. Derefter logger du ind i appen med <b>' || em || '</b> (du får en kode på mail, ingen adgangskode).</p>';
  perform send_mail(sid, em, 'Vi har modtaget din ansøgning – LL Dance Studio', app_mail_html(sid, 'Tak for ansøgningen', trim(p_first), body), 'access_request', jsonb_build_object('person_id', contact));
  return jsonb_build_object('ok', true, 'children', n);
end $$;
grant execute on function web_access_request(text, text, text, text, text, date, text, jsonb, text) to anon, authenticated;
select 'chk' as chk, (select count(*) from pg_proc where proname = 'web_access_request') as fn;
