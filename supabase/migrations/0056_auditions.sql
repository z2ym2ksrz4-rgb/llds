-- 0056: Auditions. Anyone may apply to an audition team (no payment). The trainer sends a brief (video + requirements + the
-- audition event) to everyone who applied, scores candidates in the hall, sends selections; the selected accept in the app and pay.
-- Candidates see it all on Home ("Audition"-card) – they are not team members yet, so nothing uses team RLS.

-- brief lives on the team (one audition per team per season)
alter table team add column if not exists audition_video_url text;     -- public bucket URL or external link
alter table team add column if not exists audition_text text;          -- requirements / steps
alter table team add column if not exists audition_event_id uuid references event(id) on delete set null;
alter table team add column if not exists audition_sent_at timestamptz;   -- when the brief was last sent

create table if not exists audition_candidate (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid not null references team(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','invited','selected','waitlist','declined','accepted','withdrawn')),
  scores jsonb not null default '{}'::jsonb,     -- {technique:1-5, expression:1-5, potential:1-5}
  note text,
  applied_by uuid references person(id) on delete set null,
  decided_at timestamptz, results_sent_at timestamptz, responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, person_id)
);
alter table audition_candidate enable row level security;
drop policy if exists audition_read on audition_candidate;
create policy audition_read on audition_candidate for select using (school_id = my_school_id() and (i_am_staff_of(team_id) or person_id = my_person_id() or person_id in (select my_people())));
drop policy if exists audition_staff on audition_candidate;
create policy audition_staff on audition_candidate for update using (i_am_staff_of(team_id));
drop policy if exists audition_admin on audition_candidate;
create policy audition_admin on audition_candidate for all using (i_am_admin() and school_id = my_school_id());

drop view if exists audition_candidate_view;
create view audition_candidate_view with (security_invoker = true) as
  select c.*, person_name(c.person_id) as person_name, (select birth_year from person p where p.id = c.person_id) as birth_year,
         t.name as team_name, t.audition_video_url, t.audition_text, t.audition_event_id, t.audition_sent_at,
         (select e.starts_at from event e where e.id = t.audition_event_id) as audition_at, (select e.place from event e where e.id = t.audition_event_id) as audition_place
  from audition_candidate c join team t on t.id = c.team_id;
grant select on audition_candidate_view to authenticated;

-- staff of an audition team
create or replace function audition_staff_ids(p_team uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select m.person_id from membership m where m.team_id = p_team and m.role in ('trainer','assistant')
$$;

-- 1) apply (self or my child) – "Tak for din tilmelding, afvent instrukser"
create or replace function apply_audition(p_team uuid, p_person uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare tm team; me uuid := my_person_id(); cid uuid; fn text; begin
  if me is null or not i_am_approved() then raise exception 'not allowed'; end if;
  if not (p_person = me or p_person in (select my_people())) then raise exception 'not your person'; end if;
  select * into tm from team where id = p_team and school_id = my_school_id() and not archived; if tm.id is null then raise exception 'unknown team'; end if;
  if tm.admission <> 'audition' then raise exception 'not an audition team'; end if;
  if not coalesce(tm.signup_open, true) or not coalesce((select (settings->>'signups_open')::boolean from school where id = tm.school_id), true) then raise exception 'signups closed'; end if;
  if exists (select 1 from membership where person_id = p_person and team_id = p_team) then raise exception 'already member'; end if;
  select first_name into fn from person where id = p_person;
  insert into audition_candidate(school_id, team_id, person_id, status, applied_by) values (tm.school_id, p_team, p_person, 'applied', me)
    on conflict (team_id, person_id) do update set status = case when audition_candidate.status in ('withdrawn','declined') then 'applied' else audition_candidate.status end, created_at = now()
    returning id into cid;
  -- if the brief is already out, the new applicant gets it right away
  if tm.audition_sent_at is not null then update audition_candidate set status = 'invited' where id = cid and status = 'applied'; end if;
  perform notify(me, 'message', 'Tak for tilmeldingen til audition – ' || tm.name, 'Du får besked her i appen, når træneren sender krav og dato. Indtil da: bare glæd dig.', jsonb_build_object('audition_team', p_team));
  perform notify(s, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team)) from audition_staff_ids(p_team) s;
  perform notify_admins(tm.school_id, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team));
  return cid;
end $$;
grant execute on function apply_audition(uuid, uuid) to authenticated;

-- 2) brief: trainer/admin saves video + text + event, then sends it to everyone who applied
create or replace function audition_set_brief(p_team uuid, p_video text, p_text text, p_event uuid) returns void language sql security definer set search_path = public as $$
  update team set audition_video_url = p_video, audition_text = p_text, audition_event_id = p_event where id = p_team and i_am_staff_of(p_team)
$$;
grant execute on function audition_set_brief(uuid, text, text, uuid) to authenticated;

create or replace function audition_send_brief(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare tm team; n int := 0; c record; whenTxt text; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  select * into tm from team where id = p_team;
  select to_char(e.starts_at at time zone 'Europe/Copenhagen', 'DD.MM. HH24:MI') into whenTxt from event e where e.id = tm.audition_event_id;
  update team set audition_sent_at = now() where id = p_team;
  for c in select * from audition_candidate where team_id = p_team and status in ('applied','invited') loop
    update audition_candidate set status = 'invited' where id = c.id;
    perform notify(x, 'message', 'Audition ' || tm.name || ': krav og dato er klar', coalesce('Audition ' || whenTxt || '. ', '') || 'Se video og krav på din forside – og øv dig frem til dagen.', jsonb_build_object('audition_team', p_team))
      from (select c.person_id as x union select g.parent_id from guardian g where g.child_id = c.person_id) q;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function audition_send_brief(uuid) to authenticated;

-- 3) scoring + decision (staff), 4) send results
create or replace function audition_decide(p_id uuid, p_status text, p_scores jsonb, p_note text) returns void language sql security definer set search_path = public as $$
  update audition_candidate set status = coalesce(p_status, status), scores = coalesce(p_scores, scores), note = coalesce(p_note, note), decided_at = case when p_status is not null then now() else decided_at end
  where id = p_id and i_am_staff_of(team_id)
$$;
grant execute on function audition_decide(uuid, text, jsonb, text) to authenticated;

create or replace function audition_send_results(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare tm team; n int := 0; c record; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  select * into tm from team where id = p_team;
  for c in select * from audition_candidate where team_id = p_team and status in ('selected','waitlist','declined') and results_sent_at is null loop
    update audition_candidate set results_sent_at = now() where id = c.id;
    perform notify(x, 'message',
      case c.status when 'selected' then '🎉 Tillykke – du er udtaget til ' || tm.name when 'waitlist' then tm.name || ': du står på venteliste' else 'Tak for din audition til ' || tm.name end,
      case c.status when 'selected' then 'Acceptér pladsen på din forside – så er næste skridt betalingen.' when 'waitlist' then 'Bliver der en plads ledig, får du besked med det samme.' else 'Det blev ikke denne gang – men bliv ved med at danse. Vi håber at se dig til næste audition.' end,
      jsonb_build_object('audition_team', p_team))
      from (select c.person_id as x union select g.parent_id from guardian g where g.child_id = c.person_id) q;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function audition_send_results(uuid) to authenticated;

-- 5) the selected accept (→ payment request like a normal sign-up, bypassing the sign-up window) or decline (→ first on the waitlist moves up)
create or replace function audition_respond(p_id uuid, p_accept boolean, p_plan text default 'full') returns jsonb language plpgsql security definer set search_path = public as $$
declare c audition_candidate; tm team; me uuid := my_person_id(); q record; ref text; wid uuid; fn text; nxt audition_candidate; begin
  select * into c from audition_candidate where id = p_id; if c.id is null then raise exception 'unknown'; end if;
  if not (c.person_id = me or c.person_id in (select my_people())) then raise exception 'not your person'; end if;
  if c.status <> 'selected' then raise exception 'not selected'; end if;
  select * into tm from team where id = c.team_id; select first_name into fn from person where id = c.person_id;
  if not p_accept then
    update audition_candidate set status = 'withdrawn', responded_at = now() where id = p_id;
    select * into nxt from audition_candidate where team_id = c.team_id and status = 'waitlist' order by created_at limit 1;
    if nxt.id is not null then
      update audition_candidate set status = 'selected', results_sent_at = now() where id = nxt.id;
      perform notify(x, 'message', '🎉 Der blev en plads: du er udtaget til ' || tm.name, 'Acceptér pladsen på din forside – så er næste skridt betalingen.', jsonb_build_object('audition_team', c.team_id))
        from (select nxt.person_id as x union select g.parent_id from guardian g where g.child_id = nxt.person_id) q2;
    end if;
    perform notify(s, 'signup', fn || ' takkede nej til ' || tm.name, case when nxt.id is not null then 'Næste på ventelisten har fået tilbuddet.' else 'Ingen på ventelisten.' end, jsonb_build_object('audition_team', c.team_id)) from audition_staff_ids(c.team_id) s;
    return jsonb_build_object('ok', true);
  end if;
  update audition_candidate set status = 'accepted', responded_at = now() where id = p_id;
  if exists (select 1 from web_signup where dancer_id = c.person_id and team_id = c.team_id and status <> 'cancelled') then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into q from season_quote(tm.id, me, p_plan);
  ref := left(tm.name, 18) || ' ' || fn;
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, installments, fee_dkk, per_rate_dkk, price_note, reference, source)
  values (tm.school_id, c.person_id, me, tm.id, p_plan, q.amount, q.before, q.discount_pct, q.installments, q.fee, q.per_rate, q.note, ref, 'audition') returning id into wid;
  perform notify(s, 'signup', fn || ' har accepteret pladsen på ' || tm.name, 'Betaling afventer.', jsonb_build_object('audition_team', c.team_id)) from audition_staff_ids(c.team_id) s;
  perform notify_admins(tm.school_id, 'signup', fn || ' har accepteret pladsen på ' || tm.name, coalesce(q.amount || ' kr. afventer betaling.', 'Betaling aftales.'), jsonb_build_object('audition_team', c.team_id));
  return jsonb_build_object('ok', true, 'id', wid, 'reference', ref, 'amount_dkk', q.amount, 'amount_before_dkk', q.before, 'discount_pct', q.discount_pct, 'team', tm.name, 'installments', q.installments, 'fee_dkk', q.fee, 'per_rate_dkk', q.per_rate, 'note', q.note);
end $$;
grant execute on function audition_respond(uuid, boolean, text) to authenticated;

-- sign-up window: audition acceptances pass
create or replace function trg_web_signup_window() returns trigger language plpgsql security definer set search_path = public as $$
declare tm team; open_all boolean;
begin
  if new.source in ('admin','audition') then return new; end if;
  select * into tm from team where id = new.team_id;
  select coalesce((settings->>'signups_open')::boolean, true) into open_all from school where id = new.school_id;
  if not open_all or not coalesce(tm.signup_open, true) then raise exception 'signups closed'; end if;
  if tm.admission = 'audition' then raise exception 'audition required'; end if;
  return new;
end $$;

-- staff may upload the audition video to the public bucket under <slug>/auditions/
drop policy if exists public_bucket_write_staff on storage.objects;
create policy public_bucket_write_staff on storage.objects for insert with check (bucket_id = 'public' and name like '%/auditions/%' and i_am_staff());

select 'chk' as chk, (select count(*) from audition_candidate) as candidates, (select column_name from information_schema.columns where table_name = 'team' and column_name = 'audition_text') as col;
