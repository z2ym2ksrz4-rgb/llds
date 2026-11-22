-- 0058: audition rounds. "Start ny runde" archives this season's candidates (kept as history), clears the brief and lets everyone apply again.
alter table team add column if not exists audition_round int not null default 1;
alter table audition_candidate add column if not exists round int not null default 1;
alter table audition_candidate drop constraint if exists audition_candidate_team_id_person_id_key;
create unique index if not exists audition_candidate_team_person_round on audition_candidate(team_id, person_id, round);

drop view if exists audition_candidate_view;
create view audition_candidate_view with (security_invoker = true) as
  select c.*, person_name(c.person_id) as person_name, (select birth_year from person p where p.id = c.person_id) as birth_year,
         t.name as team_name, t.audition_video_url, t.audition_text, t.audition_event_id, t.audition_sent_at, (c.round = t.audition_round) as current_round,
         (select e.starts_at from event e where e.id = t.audition_event_id) as audition_at, (select e.place from event e where e.id = t.audition_event_id) as audition_place
  from audition_candidate c join team t on t.id = c.team_id;
grant select on audition_candidate_view to authenticated;

create or replace function apply_audition(p_team uuid, p_person uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare tm team; me uuid := my_person_id(); cid uuid; fn text; begin
  if me is null or not i_am_approved() then raise exception 'not allowed'; end if;
  if not (p_person = me or p_person in (select my_people())) then raise exception 'not your person'; end if;
  select * into tm from team where id = p_team and school_id = my_school_id() and not archived; if tm.id is null then raise exception 'unknown team'; end if;
  if tm.admission <> 'audition' then raise exception 'not an audition team'; end if;
  if not coalesce(tm.signup_open, true) or not coalesce((select (settings->>'signups_open')::boolean from school where id = tm.school_id), true) then raise exception 'signups closed'; end if;
  if exists (select 1 from membership where person_id = p_person and team_id = p_team) then raise exception 'already member'; end if;
  select first_name into fn from person where id = p_person;
  insert into audition_candidate(school_id, team_id, person_id, status, applied_by, round) values (tm.school_id, p_team, p_person, 'applied', me, tm.audition_round)
    on conflict (team_id, person_id, round) do update set status = case when audition_candidate.status in ('withdrawn','declined') then 'applied' else audition_candidate.status end, created_at = now()
    returning id into cid;
  if tm.audition_sent_at is not null then update audition_candidate set status = 'invited' where id = cid and status = 'applied'; end if;
  perform notify_mail(me, 'message', 'Tak for tilmeldingen til audition – ' || tm.name, fn || ' er meldt til audition. Du får besked i appen og på mail, når træneren sender krav, video og dato. Indtil da: bare glæd dig.', jsonb_build_object('audition_team', p_team));
  perform notify(s, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team)) from audition_staff_ids(p_team) s;
  perform notify_admins(tm.school_id, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team));
  return cid;
end $$;

-- brief/results only act on the current round
create or replace function audition_send_brief(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare tm team; n int := 0; c record; whenTxt text; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  select * into tm from team where id = p_team;
  select to_char(e.starts_at at time zone 'Europe/Copenhagen', 'DD.MM. HH24:MI') into whenTxt from event e where e.id = tm.audition_event_id;
  update team set audition_sent_at = now() where id = p_team;
  for c in select * from audition_candidate where team_id = p_team and round = tm.audition_round and status in ('applied','invited') loop
    update audition_candidate set status = 'invited' where id = c.id;
    perform notify_mail(x, 'message', 'Audition ' || tm.name || ': krav og dato er klar', coalesce('Audition ' || whenTxt || '. ', '') || 'Åbn appen og se video og krav på forsiden – og øv dig frem til dagen. Alle er velkomne.', jsonb_build_object('audition_team', p_team))
      from (select c.person_id as x union select g.parent_id from guardian g where g.child_id = c.person_id) q;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function audition_send_results(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare tm team; n int := 0; c record; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  select * into tm from team where id = p_team;
  for c in select * from audition_candidate where team_id = p_team and round = tm.audition_round and status in ('selected','waitlist','declined') and results_sent_at is null loop
    update audition_candidate set results_sent_at = now() where id = c.id;
    perform notify_mail(x, 'message',
      case c.status when 'selected' then '🎉 Tillykke – du er udtaget til ' || tm.name when 'waitlist' then tm.name || ': du står på venteliste' else 'Tak for din audition til ' || tm.name end,
      case c.status when 'selected' then 'Acceptér pladsen på forsiden i appen – så er næste skridt betalingen.' when 'waitlist' then 'Bliver der en plads ledig, får du besked med det samme.' else 'Det blev ikke denne gang – men bliv ved med at danse. Vi håber at se dig til næste audition.' end,
      jsonb_build_object('audition_team', p_team))
      from (select c.person_id as x union select g.parent_id from guardian g where g.child_id = c.person_id) q;
    n := n + 1;
  end loop;
  return n;
end $$;

-- start a new round: old candidates stay as history (round n), brief is cleared, sign-up for the audition opens again
create or replace function audition_new_round(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare r int; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  update team set audition_round = audition_round + 1, audition_video_url = null, audition_text = null, audition_event_id = null, audition_sent_at = null, signup_open = true where id = p_team returning audition_round into r;
  return r;
end $$;
grant execute on function audition_new_round(uuid) to authenticated;

select 'chk' as chk, (select count(*) from pg_proc where proname = 'audition_new_round') as fn;
