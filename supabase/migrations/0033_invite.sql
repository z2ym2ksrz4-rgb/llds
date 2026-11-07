-- Invitations from Admin + "you're in" mail on approval.
alter table person add column if not exists invited_at timestamptz;

-- Plain app mail in the receipt look: title, greeting, body (html), gold "Åbn appen" button.
create or replace function app_mail_html(p_school uuid, p_title text, p_name text, p_body text)
returns text language sql stable as $$
  select '<div style="background:#0a0a0b;padding:32px 16px;font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#f4f1ea"><div style="max-width:560px;margin:0 auto;background:#121214;border:1px solid rgba(201,162,74,.35);border-radius:18px;padding:28px">'
    || '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a24a">' || (select name from school where id = p_school) || '</div>'
    || '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-weight:400;font-size:30px;margin:8px 0 4px">' || p_title || '</h1>'
    || '<p style="color:#a8a49c;margin:0 0 18px">Hej ' || coalesce(p_name, '') || '</p>'
    || '<div style="font-size:15px;line-height:1.55">' || p_body || '</div>'
    || '<p style="margin:24px 0 0"><a href="https://ilumie.com/llds/hent/" style="display:inline-block;background:#e6c87a;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Åbn appen →</a></p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:10px 0 0">Log ind med denne e-mail – du får en kode (eller et link) på mail. På telefonen hentes appen, på computeren åbner den i browseren.</p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:22px 0 0">' || (select name from school where id = p_school) || ' · Vinkelvej 17, 8860 Ulstrup</p>'
    || '</div></div>'
$$;

-- Admin invites a person (adult; optionally a parent with children). Everyone is created approved and put on teams; the adult gets the invitation mail.
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

-- Resend the invitation (person created by invite or pre-created, not yet logged in).
create or replace function resend_invite(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare p person; begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into p from person where id = p_id and school_id = my_school_id() and email is not null;
  if p.id is null then raise exception 'not found'; end if;
  update person set invited_at = now() where id = p_id;
  perform send_mail(p.school_id, p.email, 'Velkommen i appen – LL Dance Studio', app_mail_html(p.school_id, 'Du er inviteret', p.first_name,
    '<p>Du er oprettet i LL Dance Studios app. Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || p.email || '</b>.</p>'), 'invite', jsonb_build_object('person_id', p.id));
end $$;
grant execute on function resend_invite(uuid) to authenticated;

-- Approval mail: a self-registered adult goes pending → approved.
create or replace function trg_person_approved_mail() returns trigger language plpgsql security definer set search_path = public as $$
declare tms text; begin
  if new.status = 'approved' and old.status = 'pending' and new.email is not null and new.supervised_by is null then
    tms := (select string_agg(t.name, ', ') from (select distinct tm.name from membership m join team tm on tm.id = m.team_id where m.person_id = new.id or m.person_id in (select child_id from guardian where parent_id = new.id)) t);
    perform send_mail(new.school_id, new.email, 'Du er inde – LL Dance Studio', app_mail_html(new.school_id, 'Du er godkendt', new.first_name,
      '<p>Line har godkendt din profil' || coalesce(' – ' || tms, '') || '. Appen er åben for dig nu: træningstider, afbud, beskeder fra træneren, koreografi og betalinger.</p>'), 'approved', jsonb_build_object('person_id', new.id));
    perform notify(new.id, 'system', 'Du er godkendt 🎉', 'Velkommen i LL Dance Studio' || coalesce(' – ' || tms, ''), jsonb_build_object('person_id', new.id));
  end if; return new;
end $$;
drop trigger if exists person_approved_mail on person;
create trigger person_approved_mail after update of status on person for each row execute function trg_person_approved_mail();
