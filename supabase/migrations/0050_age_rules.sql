-- 0050: ONE age rule everywhere.
--   < 13      no own login – the parent uses the app on the child's behalf
--   13–14     own login only as a child login under a parent who has consented (guardian.confirmed + person.supervised_by)
--   15+       own login, parent optional (may still be linked and see along)
--   parent    must be linked to at least one child; teams follow the children
create or replace function login_age_class(p person) returns text language sql immutable as $$
  select case when person_age(p) is null then 'unknown' when person_age(p) < 13 then 'none' when person_age(p) < 15 then 'child' else 'own' end
$$;

-- self-registration: 13–14 must name a parent's e-mail; a known parent is linked (unconfirmed) and asked to confirm
drop function if exists sign_up(text, text, text, text, int, text[], text, jsonb, date);
create or replace function sign_up(p_school_slug text, p_first text, p_last text, p_phone text, p_birth_year int,
  p_roles text[], p_wished_teams text, p_children jsonb default '[]'::jsonb, p_birth_date date default null, p_parent_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; pid uuid; c jsonb; cid uuid; age int; par uuid; pem text := lower(trim(coalesce(p_parent_email, '')));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from person where user_id = auth.uid()) then raise exception 'already registered'; end if;
  select id into sid from school where slug = p_school_slug;
  if sid is null then raise exception 'unknown school'; end if;
  age := case when p_birth_date is not null then extract(year from age(p_birth_date))::int when p_birth_year is not null then extract(year from now())::int - p_birth_year end;
  if 'dancer' = any(p_roles) and age is not null and age < 13 then raise exception 'too young'; end if;
  if 'dancer' = any(p_roles) and age is not null and age < 15 and pem = '' then raise exception 'needs parent'; end if;
  insert into person(school_id, user_id, first_name, last_name, email, phone, birth_year, birth_date, wished_roles, wished_teams)
    values (sid, auth.uid(), p_first, p_last, (select email from auth.users where id = auth.uid()), p_phone, coalesce(p_birth_year, extract(year from p_birth_date)::int), p_birth_date, p_roles, p_wished_teams)
    returning id into pid;
  if pem <> '' then
    select id into par from person where school_id = sid and lower(email) = pem and id <> pid limit 1;
    if par is not null then
      insert into guardian(parent_id, child_id, confirmed) values (par, pid, false) on conflict do nothing;
      perform notify(par, 'system', p_first || ' har oprettet sig i appen', 'Bekræft under Indstillinger → Børn, at ' || p_first || ' må bruge appen.', jsonb_build_object('person_id', pid));
    else
      update person set wished_teams = coalesce(nullif(p_wished_teams, ''), '') || ' · Forælder: ' || pem where id = pid;
    end if;
  end if;
  for c in select * from jsonb_array_elements(p_children) loop
    insert into person(school_id, first_name, last_name, birth_year, birth_date, status, wished_roles)
      values (sid, c->>'first_name', coalesce(c->>'last_name', p_last), coalesce((c->>'birth_year')::int, extract(year from (c->>'birth_date')::date)::int), (c->>'birth_date')::date, 'pending', '{dancer}')
      returning id into cid;
    insert into guardian(parent_id, child_id, confirmed, consent_at) values (pid, cid, true, now());
  end loop;
  return pid;
end $$;
grant execute on function sign_up(text, text, text, text, int, text[], text, jsonb, date, text) to authenticated;

-- a parent confirms a 13–14-year-old's own registration
create or replace function confirm_child(p_child uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id();
begin
  if not exists (select 1 from guardian where parent_id = me and child_id = p_child) then raise exception 'not your child'; end if;
  update guardian set confirmed = true, consent_at = now() where parent_id = me and child_id = p_child;
  update person set supervised_by = me, updated_at = now() where id = p_child and user_id is not null;
end $$;
grant execute on function confirm_child(uuid) to authenticated;

-- Line's approval checks the rule
create or replace function approve_person(p_id uuid, p_admin boolean default false, p_memberships jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare p person;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into p from person where id = p_id and school_id = my_school_id();
  if p.id is null then raise exception 'not found'; end if;
  if p.user_id is not null and login_age_class(p) = 'none' then raise exception 'too young'; end if;
  if p.user_id is not null and login_age_class(p) = 'child' and not exists (select 1 from guardian where child_id = p.id and confirmed) then raise exception 'needs parent'; end if;
  if 'parent' = any(p.wished_roles) and not exists (select 1 from unnest(p.wished_roles) r where r <> 'parent') and not exists (select 1 from guardian where parent_id = p.id) then raise exception 'parent needs child'; end if;
  update person set status = 'approved', is_admin = p_admin, updated_at = now(), supervised_by = case when login_age_class(p) = 'child' then coalesce(p.supervised_by, (select parent_id from guardian where child_id = p.id and confirmed limit 1)) else p.supervised_by end where id = p_id;
  delete from membership where person_id = p_id;
  insert into membership(person_id, team_id, role) select p_id, (m->>'team_id')::uuid, (m->>'role')::member_role from jsonb_array_elements(p_memberships) m;
  insert into audit_log(school_id, actor_user, action, target, detail) values (my_school_id(), auth.uid(), 'approve_person', p_id::text, p_memberships);
end $$;

-- parent switches on a child's login: 13–17 (13–14 always supervised; 15–17 supervised too since the parent created it and may revoke)
create or replace function grant_child_login(p_child uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id(); c person; nm text; em text := lower(trim(p_email));
begin
  if not exists (select 1 from guardian g where g.parent_id = me and g.child_id = p_child) then raise exception 'not your child'; end if;
  select * into c from person where id = p_child;
  if login_age_class(c) in ('none', 'unknown') then raise exception 'child too young'; end if;
  if exists (select 1 from person where lower(email) = em and id <> p_child) then raise exception 'email in use'; end if;
  update person set email = em, supervised_by = me, status = 'approved', invited_at = now(), updated_at = now() where id = p_child;
  update guardian set consent_at = now(), confirmed = true where parent_id = me and child_id = p_child;
  nm := access_phrase(p_child);
  perform send_mail(c.school_id, em, 'Velkommen i appen – LL Dance Studio', app_mail_html(c.school_id, 'Du er inviteret', c.first_name,
    '<p>Du er oprettet i LL Dance Studios app' || coalesce(' ' || nm, '') || '. Her finder du træningstider, afbud, beskeder fra træneren, koreografi og meget mere.</p>'
    || '<p>Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || em || '</b>.</p>'), 'invite', jsonb_build_object('person_id', p_child));
end $$;

-- admin invites an existing person: <13 refused, 13–14 supervised under a linked parent, 15+ plain
create or replace function invite_existing(p_id uuid, p_email text) returns void language plpgsql security definer set search_path = public as $$
declare p person; em text := lower(trim(p_email)); cls text; par uuid; sid uuid := my_school_id(); body text; nm text;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  select * into p from person where id = p_id and school_id = sid;
  if p.id is null then raise exception 'not found'; end if;
  if p.user_id is not null then raise exception 'already has login'; end if;
  if exists (select 1 from person where school_id = sid and lower(email) = em and id <> p_id) then raise exception 'email exists'; end if;
  cls := login_age_class(p);
  if cls = 'unknown' then raise exception 'needs birth date'; end if;
  if cls = 'none' then raise exception 'too young'; end if;
  if cls = 'child' then
    select parent_id into par from guardian where child_id = p_id order by confirmed desc, consent_at desc nulls last limit 1;
    if par is null then raise exception 'needs parent'; end if;
    update person set email = em, supervised_by = par, status = 'approved', invited_at = now(), updated_at = now() where id = p_id;
    update guardian set consent_at = coalesce(consent_at, now()), confirmed = true where parent_id = par and child_id = p_id;
  else
    update person set email = em, status = case when status = 'pending' then 'approved' else status end, invited_at = now(), updated_at = now() where id = p_id;
  end if;
  nm := access_phrase(p_id);
  body := '<p>Du er oprettet i LL Dance Studios app' || coalesce(' ' || nm, '') || '. Her finder du træningstider, afbud, beskeder fra træneren, koreografi og betalinger.</p>'
       || '<p>Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || em || '</b>.</p>';
  perform send_mail(sid, em, 'Velkommen i appen – LL Dance Studio', app_mail_html(sid, 'Du er inviteret', p.first_name, body), 'invite', jsonb_build_object('person_id', p_id));
  insert into audit_log(school_id, actor_user, action, target, detail) values (sid, auth.uid(), 'invite_existing', p_id::text, jsonb_build_object('email', em, 'class', cls));
end $$;

-- test persona Milo was 11 with a child login – under the rule he is 13
update person set birth_date = make_date(extract(year from now())::int - 13, 9, 20), birth_year = extract(year from now())::int - 13 where last_name = 'Testperson' and first_name = 'Milo';
