-- 0048: admin invites an EXISTING person (imported dancer, child, trainer) by setting the e-mail and sending the welcome mail.
--       Under 18 → supervised login tied to the first guardian (parent consent is recorded); under 18 without a guardian is refused.
--       Logging in with that e-mail then claims this person (claim_person), so teams, roles and children stay as they are.
create or replace function invite_existing(p_id uuid, p_email text) returns void language plpgsql security definer set search_path = public as $$
declare p person; em text := lower(trim(p_email)); age int; par uuid; sid uuid := my_school_id(); body text; nm text;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  select * into p from person where id = p_id and school_id = sid;
  if p.id is null then raise exception 'not found'; end if;
  if p.user_id is not null then raise exception 'already has login'; end if;
  if exists (select 1 from person where school_id = sid and lower(email) = em and id <> p_id) then raise exception 'email exists'; end if;
  age := person_age(p);
  if age is not null and age < 18 then
    select parent_id into par from guardian where child_id = p_id order by confirmed desc, consent_at desc nulls last limit 1;
    if par is null then raise exception 'needs parent'; end if;
    if age < 10 then raise exception 'child too young'; end if;
    update person set email = em, supervised_by = par, status = 'approved', invited_at = now(), updated_at = now() where id = p_id;
    update guardian set consent_at = coalesce(consent_at, now()), confirmed = true where parent_id = par and child_id = p_id;
  else
    update person set email = em, status = case when status = 'pending' then 'approved' else status end, invited_at = now(), updated_at = now() where id = p_id;
  end if;
  nm := access_phrase(p_id);
  body := '<p>Du er oprettet i LL Dance Studios app' || coalesce(' ' || nm, '') || '. Her finder du træningstider, afbud, beskeder fra træneren, koreografi og betalinger.</p>'
       || '<p>Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || em || '</b>.</p>';
  perform send_mail(sid, em, 'Velkommen i appen – LL Dance Studio', app_mail_html(sid, 'Du er inviteret', p.first_name, body), 'invite', jsonb_build_object('person_id', p_id));
  insert into audit_log(school_id, actor_user, action, target, detail) values (sid, auth.uid(), 'invite_existing', p_id::text, jsonb_build_object('email', em, 'supervised', age is not null and age < 18));
end $$;
grant execute on function invite_existing(uuid, text) to authenticated;

-- resend uses the same role-aware text as the first invitation
create or replace function resend_invite(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare p person; nm text; begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into p from person where id = p_id and school_id = my_school_id() and email is not null;
  if p.id is null then raise exception 'not found'; end if;
  update person set invited_at = now() where id = p_id;
  nm := access_phrase(p_id);
  perform send_mail(p.school_id, p.email, 'Velkommen i appen – LL Dance Studio', app_mail_html(p.school_id, 'Du er inviteret', p.first_name,
    '<p>Du er oprettet i LL Dance Studios app' || coalesce(' ' || nm, '') || '. Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || p.email || '</b>.</p>'), 'invite', jsonb_build_object('person_id', p.id));
end $$;
