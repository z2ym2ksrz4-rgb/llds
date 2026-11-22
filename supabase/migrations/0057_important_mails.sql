-- 0057: e-mail for the important things only – sign-ups (team/audition), audition results, payment requests, selections.
-- Receipts already go by mail (0024). The person can switch mails off under Notifikationer (notify_prefs.mail = false);
-- children without e-mail fall back to their parents' addresses.

-- addresses for a person: own e-mail, else the parents'
create or replace function mail_addresses(p_person uuid) returns setof text language sql stable security definer set search_path = public as $$
  select p.email from person p where p.id = p_person and p.email is not null and coalesce((p.notify_prefs->>'mail')::boolean, true)
  union
  select pp.email from guardian g join person pp on pp.id = g.parent_id where g.child_id = p_person and pp.email is not null and coalesce((pp.notify_prefs->>'mail')::boolean, true)
    and not exists (select 1 from person x where x.id = p_person and x.email is not null)
$$;

-- in-app notification + e-mail (same text, app button). p_kind is the notification kind; the mail is logged as 'important'.
create or replace function notify_mail(p_person uuid, p_kind text, p_title text, p_body text, p_ref jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path = public as $$
declare sch uuid; nm text; addr text; begin
  perform notify(p_person, p_kind, p_title, p_body, p_ref);
  select school_id, first_name into sch, nm from person where id = p_person;
  for addr in select * from mail_addresses(p_person) loop
    perform send_mail(sch, addr, p_title, app_mail_html(sch, p_title, nm, p_body), 'important', p_ref);
  end loop;
end $$;

-- 1) team sign-up from the app or the website: "Tilmelding modtaget" to the dancer/parents (admin requests already mail via request_payment path below)
create or replace function trg_web_signup_mail() returns trigger language plpgsql security definer set search_path = public as $$
declare tm text; fn text; body text; begin
  select name into tm from team where id = new.team_id; select first_name into fn from person where id = new.dancer_id;
  body := case when new.amount_dkk is null then 'Vi har modtaget tilmeldingen til ' || tm || '. Betalingen aftales – du hører fra os.'
               when coalesce(new.installments, 1) > 1 then 'Vi har modtaget tilmeldingen til ' || tm || '. Betal første rate (' || new.per_rate_dkk || ' kr. af ' || new.amount_dkk || ' kr.) med MobilePay og referencen "' || new.reference || '" – pladsen er klar, når betalingen er registreret.'
               else 'Vi har modtaget tilmeldingen til ' || tm || '. Betal ' || new.amount_dkk || ' kr. med MobilePay og referencen "' || new.reference || '" – pladsen er klar, når betalingen er registreret.' end;
  if new.source in ('app','web','audition') then
    perform notify_mail(new.contact_id, 'payment', 'Tilmelding modtaget: ' || fn || ' → ' || tm, body, jsonb_build_object('payment_id', new.id));
  elsif new.source = 'admin' then   -- request_payment already notifies in-app; mail only
    perform send_mail(new.school_id, a, 'Betaling: ' || tm || ' (' || fn || ')', app_mail_html(new.school_id, 'Betaling: ' || tm, fn, body || coalesce(' ' || new.message, '')), 'important', jsonb_build_object('payment_id', new.id)) from mail_addresses(new.contact_id) a;
  end if;
  return new;
end $$;
drop trigger if exists web_signup_mail on web_signup;
create trigger web_signup_mail after insert on web_signup for each row execute function trg_web_signup_mail();

-- 2) auditions: thanks-for-applying, brief, results → mail as well (swap notify → notify_mail for the candidate messages)
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
  if tm.audition_sent_at is not null then update audition_candidate set status = 'invited' where id = cid and status = 'applied'; end if;
  perform notify_mail(me, 'message', 'Tak for tilmeldingen til audition – ' || tm.name, fn || ' er meldt til audition. Du får besked i appen og på mail, når træneren sender krav, video og dato. Indtil da: bare glæd dig.', jsonb_build_object('audition_team', p_team));
  perform notify(s, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team)) from audition_staff_ids(p_team) s;
  perform notify_admins(tm.school_id, 'signup', 'Ny til audition: ' || tm.name, fn || ' har meldt sig til audition.', jsonb_build_object('audition_team', p_team));
  return cid;
end $$;

create or replace function audition_send_brief(p_team uuid) returns int language plpgsql security definer set search_path = public as $$
declare tm team; n int := 0; c record; whenTxt text; begin
  if not i_am_staff_of(p_team) then raise exception 'not allowed'; end if;
  select * into tm from team where id = p_team;
  select to_char(e.starts_at at time zone 'Europe/Copenhagen', 'DD.MM. HH24:MI') into whenTxt from event e where e.id = tm.audition_event_id;
  update team set audition_sent_at = now() where id = p_team;
  for c in select * from audition_candidate where team_id = p_team and status in ('applied','invited') loop
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
  for c in select * from audition_candidate where team_id = p_team and status in ('selected','waitlist','declined') and results_sent_at is null loop
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

-- the waitlist offer inside audition_respond also mails (person + parents) – re-create with notify_mail
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
      perform notify_mail(x, 'message', '🎉 Der blev en plads: du er udtaget til ' || tm.name, 'Acceptér pladsen på forsiden i appen – så er næste skridt betalingen.', jsonb_build_object('audition_team', c.team_id))
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

select 'chk' as chk, (select count(*) from pg_proc where proname in ('notify_mail','mail_addresses')) as fns;
