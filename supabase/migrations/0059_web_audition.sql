-- 0059: apply for an audition from the website without being a member. Same household creation as web_signup
-- (pending persons, guardian, wished_teams), no payment; admin approves the person in Nye brugere, the trainer sees the
-- candidate in the Audition tab. When the person later logs in with the e-mail, claim_person() takes over the profile.

create or replace function web_audition(p_school_slug text, p_team_name text, p_dancer_first text, p_dancer_last text, p_birth_date date,
  p_contact_first text, p_contact_last text, p_email text, p_phone text, p_self boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; tm team; contact uuid; dancer uuid; cid uuid; em text := lower(trim(p_email)); whenTxt text;
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  select * into tm from team where school_id = sid and name = p_team_name and not archived; if tm.id is null then raise exception 'unknown team'; end if;
  if tm.admission <> 'audition' then raise exception 'not an audition team'; end if;
  if not coalesce(tm.signup_open, true) or not coalesce((select (settings->>'signups_open')::boolean from school where id = sid), true) then raise exception 'signups closed'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(p_dancer_first)) < 1 or length(trim(p_contact_first)) < 1 then raise exception 'missing name'; end if;
  if (select count(*) from audition_candidate c join person p on p.id = coalesce(c.applied_by, c.person_id) where c.school_id = sid and lower(p.email) = em and c.created_at > now() - interval '1 day') >= 5 then raise exception 'too many'; end if;
  select id into contact from person where school_id = sid and lower(email) = em and status in ('pending','approved') order by (user_id is not null) desc limit 1;
  if contact is null then
    insert into person(school_id, first_name, last_name, email, phone, status, wished_roles, wished_teams, source, birth_date)
    values (sid, trim(p_contact_first), trim(p_contact_last), em, nullif(trim(p_phone), ''), 'pending', case when p_self then '{dancer}'::text[] else '{parent}'::text[] end, tm.name || ' (audition)', 'web', case when p_self then p_birth_date end)
    returning id into contact;
  else
    update person set wished_teams = concat_ws(', ', wished_teams, tm.name || ' (audition)'), phone = coalesce(phone, nullif(trim(p_phone), '')) where id = contact;
  end if;
  if p_self then dancer := contact;
  else
    select p.id into dancer from person p join guardian g on g.child_id = p.id where g.parent_id = contact and lower(p.first_name) = lower(trim(p_dancer_first)) limit 1;
    if dancer is null then
      insert into person(school_id, first_name, last_name, status, wished_roles, wished_teams, source, birth_date)
      values (sid, trim(p_dancer_first), coalesce(nullif(trim(p_dancer_last), ''), trim(p_contact_last)), 'pending', '{dancer}', tm.name || ' (audition)', 'web', p_birth_date) returning id into dancer;
      insert into guardian(parent_id, child_id) values (contact, dancer) on conflict do nothing;
    else update person set wished_teams = concat_ws(', ', wished_teams, tm.name || ' (audition)') where id = dancer; end if;
  end if;
  if exists (select 1 from membership where person_id = dancer and team_id = tm.id) then raise exception 'already member'; end if;
  insert into audition_candidate(school_id, team_id, person_id, status, applied_by, round, note)
  values (sid, tm.id, dancer, case when tm.audition_sent_at is not null then 'invited' else 'applied' end, contact, tm.audition_round, nullif(trim(p_note), ''))
  on conflict (team_id, person_id, round) do update set status = case when audition_candidate.status in ('withdrawn','declined') then 'applied' else audition_candidate.status end, created_at = now()
  returning id into cid;
  select to_char(e.starts_at at time zone 'Europe/Copenhagen', 'DD.MM. HH24:MI') into whenTxt from event e where e.id = tm.audition_event_id;
  perform notify_mail(contact, 'message', 'Tak for tilmeldingen til audition – ' || tm.name,
    trim(p_dancer_first) || ' er meldt til audition' || coalesce(' (' || whenTxt || ')', '') || '. Danseskolen godkender profilen, og du får besked på mail og i appen, når træneren sender krav, video og dato. Log ind i appen med denne e-mail – så ligger alt på forsiden.',
    jsonb_build_object('audition_team', tm.id));
  perform notify(s, 'signup', 'Ny til audition fra websitet: ' || tm.name, trim(p_dancer_first) || ' har meldt sig til audition.', jsonb_build_object('audition_team', tm.id, 'person_id', dancer)) from audition_staff_ids(tm.id) s;
  perform notify_admins(sid, 'signup', 'Ny til audition fra websitet 🎯', trim(p_dancer_first) || ' → ' || tm.name || ' · gratis, afventer godkendelse', jsonb_build_object('audition_team', tm.id, 'person_id', dancer));
  return jsonb_build_object('id', cid, 'team', tm.name, 'audition_at', whenTxt, 'audition_text', tm.audition_text);
end $$;
grant execute on function web_audition(text, text, text, text, date, text, text, text, text, boolean, text) to anon, authenticated;

select 'chk' as chk, (select count(*) from pg_proc where proname = 'web_audition') as fn;
