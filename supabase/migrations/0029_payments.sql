-- 0029: season payments. (1) Family discount is computed automatically on web sign-up: full price for the household's most expensive team,
-- 10 % off every further team. (2) Admin can send payment requests to dancers on a team with an optional discount (special deals).
-- Both live in web_signup (now "payment requests"): source web | admin, visible to the household in the app under Betalinger.
alter table web_signup add column if not exists discount_pct int not null default 0;
alter table web_signup add column if not exists amount_before_dkk int;
alter table web_signup add column if not exists source text not null default 'web';
alter table web_signup add column if not exists message text;
alter table web_signup alter column plan drop not null;
drop policy if exists web_signup_own on web_signup;
create policy web_signup_own on web_signup for select using (dancer_id in (select my_people()) or contact_id in (select my_people()));

drop view if exists web_signup_view;
create view web_signup_view with (security_invoker = true) as
  select w.*, person_name(w.dancer_id) as dancer_name, person_name(w.contact_id) as contact_name, (select name from team t where t.id = w.team_id) as team_name,
         (select email from person p where p.id = w.contact_id) as email, (select phone from person p where p.id = w.contact_id) as phone
  from web_signup w;
grant select on web_signup_view to authenticated;

-- household = the contact person; 10 % off when the household already has a season payment that is at least as expensive
create or replace function family_discount_pct(p_contact uuid, p_amount int) returns int language sql stable security definer set search_path = public as $$
  select case when p_amount is not null and exists (
    select 1 from web_signup w where w.contact_id = p_contact and w.status <> 'cancelled' and coalesce(w.amount_before_dkk, w.amount_dkk) >= p_amount and w.created_at > now() - interval '11 months'
  ) then 10 else 0 end
$$;

create or replace function web_signup(p_school_slug text, p_team_name text, p_dancer_first text, p_dancer_last text, p_birth_date date,
  p_contact_first text, p_contact_last text, p_email text, p_phone text, p_self boolean, p_plan text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; tm team; contact uuid; dancer uuid; amounts int[]; amount int; before int; pct int := 0; ref text; wid uuid; em text := lower(trim(p_email));
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  select * into tm from team where school_id = sid and name = p_team_name and not archived; if tm.id is null then raise exception 'unknown team'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(p_dancer_first)) < 1 or length(trim(p_contact_first)) < 1 then raise exception 'missing name'; end if;
  if (select count(*) from web_signup w join person p on p.id = w.contact_id where w.school_id = sid and lower(p.email) = em and w.created_at > now() - interval '1 day') >= 5 then raise exception 'too many'; end if;
  select id into contact from person where school_id = sid and lower(email) = em and status in ('pending','approved') order by (user_id is not null) desc limit 1;
  if contact is null then
    insert into person(school_id, first_name, last_name, email, phone, status, wished_roles, wished_teams, source, birth_date)
    values (sid, trim(p_contact_first), trim(p_contact_last), em, nullif(trim(p_phone), ''), 'pending', case when p_self then '{dancer}'::text[] else '{parent}'::text[] end, tm.name, 'web', case when p_self then p_birth_date end)
    returning id into contact;
  else
    update person set wished_teams = concat_ws(', ', wished_teams, tm.name), phone = coalesce(phone, nullif(trim(p_phone), '')) where id = contact;
  end if;
  if p_self then dancer := contact;
  else
    select p.id into dancer from person p join guardian g on g.child_id = p.id where g.parent_id = contact and lower(p.first_name) = lower(trim(p_dancer_first)) limit 1;
    if dancer is null then
      insert into person(school_id, first_name, last_name, status, wished_roles, wished_teams, source, birth_date)
      values (sid, trim(p_dancer_first), coalesce(nullif(trim(p_dancer_last), ''), trim(p_contact_last)), 'pending', '{dancer}', tm.name, 'web', p_birth_date) returning id into dancer;
      insert into guardian(parent_id, child_id) values (contact, dancer) on conflict do nothing;
    else update person set wished_teams = concat_ws(', ', wished_teams, tm.name) where id = dancer; end if;
  end if;
  amounts := price_amounts(tm.price);
  before := case p_plan when 'full' then amounts[1] when 'half' then coalesce(amounts[2], amounts[1]) else null end;
  pct := family_discount_pct(contact, before);
  amount := case when before is null then null else round(before * (100 - pct) / 100.0) end;
  ref := left(tm.name, 18) || ' ' || trim(p_dancer_first);
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, reference, note, source)
  values (sid, dancer, contact, tm.id, p_plan, amount, before, pct, ref, nullif(trim(p_note), ''), 'web') returning id into wid;
  perform notify_admins(sid, 'signup', 'Ny tilmelding fra websitet 📝', trim(p_dancer_first) || ' → ' || tm.name || coalesce(' · ' || amount || ' kr.' || case when pct > 0 then ' (familierabat ' || pct || ' %)' else '' end, ' · rater'), jsonb_build_object('web_signup_id', wid, 'person_id', dancer));
  return jsonb_build_object('id', wid, 'reference', ref, 'amount_dkk', amount, 'amount_before_dkk', before, 'discount_pct', pct, 'plan', p_plan, 'team', tm.name, 'mobilepay', (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid));
end $$;

-- admin: send a payment request to dancers on a team (season fee), optional discount %, optional message. Returns number created.
create or replace function request_payment(p_team uuid, p_person_ids uuid[], p_plan text, p_amount int, p_discount_pct int default 0, p_message text default null)
returns int language plpgsql security definer set search_path = public as $$
declare tm team; pid uuid; contact uuid; amount int; ref text; n int := 0; wid uuid; fn text; begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into tm from team where id = p_team and school_id = my_school_id(); if tm.id is null then raise exception 'unknown team'; end if;
  amount := round(p_amount * (100 - coalesce(p_discount_pct, 0)) / 100.0);
  foreach pid in array p_person_ids loop
    select first_name into fn from person where id = pid and school_id = tm.school_id; if fn is null then continue; end if;
    select case when exists (select 1 from person where id = pid and (user_id is not null or email is not null)) then pid else (select parent_id from guardian where child_id = pid limit 1) end into contact;
    contact := coalesce(contact, pid);
    ref := left(tm.name, 18) || ' ' || fn;
    insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, reference, message, source)
    values (tm.school_id, pid, contact, tm.id, p_plan, amount, p_amount, coalesce(p_discount_pct, 0), ref, nullif(trim(p_message), ''), 'admin') returning id into wid;
    perform notify(contact, 'payment', 'Betaling: ' || tm.name, fn || ' · ' || amount || ' kr.' || case when coalesce(p_discount_pct, 0) > 0 then ' (rabat ' || p_discount_pct || ' %)' else '' end || coalesce(' · ' || p_message, ''), jsonb_build_object('payment_id', wid));
    if contact <> pid then perform notify(pid, 'payment', 'Betaling: ' || tm.name, amount || ' kr.', jsonb_build_object('payment_id', wid)); end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function request_payment(uuid, uuid[], text, int, int, text) to authenticated;

-- receipt shows the discount
create or replace function trg_web_signup_receipt() returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text; tm text; dn text; rows jsonb; begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    select p.email, p.first_name into em, nm from person p where p.id = new.contact_id;
    select name into tm from team where id = new.team_id; select first_name into dn from person where id = new.dancer_id;
    rows := jsonb_build_array(jsonb_build_object('label', 'Hold', 'value', tm), jsonb_build_object('label', 'Danser', 'value', dn), jsonb_build_object('label', 'Betaling', 'value', case new.plan when 'full' then 'Hel sæson' when 'half' then 'Halv sæson' when 'rates' then 'Rater' else coalesce(new.plan, 'Sæson') end));
    if new.discount_pct > 0 then rows := rows || jsonb_build_object('label', 'Pris før rabat', 'value', dkk(new.amount_before_dkk)) || jsonb_build_object('label', 'Rabat', 'value', new.discount_pct || ' %'); end if;
    rows := rows || jsonb_build_object('label', 'Reference', 'value', new.reference);
    perform send_mail(new.school_id, em, 'Kvittering – ' || tm, receipt_html(new.school_id, case when new.source = 'admin' then 'Betaling modtaget' else 'Tilmelding bekræftet' end, nm, rows,
      coalesce(dkk(new.amount_dkk), 'Aftalt i rater'), 'Vi glæder os til at se ' || dn || ' på gulvet. Træningstider og beskeder fra træneren finder du i appen – log ind med denne e-mail.'), 'web_signup', jsonb_build_object('web_signup_id', new.id));
  end if; return new;
end $$;

-- signed-in members sign up for another team from the app (same family discount, same payment flow)
create or replace function app_signup_team(p_team uuid, p_person uuid, p_plan text) returns jsonb language plpgsql security definer set search_path = public as $$
declare tm team; me uuid := my_person_id(); contact uuid; amounts int[]; before int; pct int; amount int; ref text; wid uuid; fn text; begin
  if me is null or not i_am_approved() then raise exception 'not allowed'; end if;
  if not (p_person = me or p_person in (select my_people())) then raise exception 'not your person'; end if;
  select * into tm from team where id = p_team and school_id = my_school_id() and not archived and visibility = 'public'; if tm.id is null then raise exception 'unknown team'; end if;
  if exists (select 1 from membership where person_id = p_person and team_id = p_team) then raise exception 'already member'; end if;
  if exists (select 1 from web_signup where dancer_id = p_person and team_id = p_team and status <> 'cancelled') then raise exception 'already requested'; end if;
  select first_name into fn from person where id = p_person;
  contact := me;
  amounts := price_amounts(tm.price);
  before := case p_plan when 'full' then amounts[1] when 'half' then coalesce(amounts[2], amounts[1]) else null end;
  pct := family_discount_pct(contact, before);
  amount := case when before is null then null else round(before * (100 - pct) / 100.0) end;
  ref := left(tm.name, 18) || ' ' || fn;
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, reference, source)
  values (tm.school_id, p_person, contact, tm.id, p_plan, amount, before, pct, ref, 'app') returning id into wid;
  perform notify_admins(tm.school_id, 'signup', 'Ny holdtilmelding i appen 📝', fn || ' → ' || tm.name || coalesce(' · ' || amount || ' kr.' || case when pct > 0 then ' (familierabat)' else '' end, ' · rater'), jsonb_build_object('web_signup_id', wid, 'person_id', p_person));
  return jsonb_build_object('id', wid, 'reference', ref, 'amount_dkk', amount, 'amount_before_dkk', before, 'discount_pct', pct, 'team', tm.name);
end $$;
grant execute on function app_signup_team(uuid, uuid, text) to authenticated;

-- when Line marks a season payment paid, the dancer is put on the team (and approved if still pending)
create or replace function trg_web_signup_paid_membership() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    insert into membership(person_id, team_id, role) values (new.dancer_id, new.team_id, 'dancer') on conflict do nothing;
    update person set status = 'approved', updated_at = now() where id in (new.dancer_id, new.contact_id) and status = 'pending';
    perform notify(new.contact_id, 'payment', 'Betaling modtaget ✓', (select name from team where id = new.team_id) || ' · ' || coalesce(new.amount_dkk::text || ' kr.', 'rater'), jsonb_build_object('payment_id', new.id));
  end if; return new;
end $$;
drop trigger if exists web_signup_paid_membership on web_signup;
create trigger web_signup_paid_membership after update on web_signup for each row execute function trg_web_signup_paid_membership();
