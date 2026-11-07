-- 0030: structured season prices (no more parsing the price text), instalment plans with 50 kr. fee per rate (one fee per rate per household),
-- sign-up price vs. rest for tryout teams (Sky Stars/Control). Team editor sets the numbers; website + app read them.
alter table team add column if not exists price_full int;          -- whole season
alter table team add column if not exists price_half int;          -- half season (Aug–Dec), null = not offered
alter table team add column if not exists price_signup int;        -- paid at sign-up when it differs (tryout teams); rest = price_full - price_signup after the trial lessons
alter table team add column if not exists price_note text;         -- shown with the price ("Resterende 975 kr. betales efter 4 prøvegange", "Betales med klippekort")
alter table team add column if not exists installments_allowed boolean not null default true;
update team set price_full = (price_amounts(price))[1], price_half = case when price like '%halv sæson%' then (price_amounts(price))[2] end where price_full is null and price is not null and price not like '%klip%';
update team set price_signup = 5825, price_note = 'Tilmelding til Satellite Stars-pris – resterende 975 kr. betales efter 4 prøvegange' where name = 'Sky Stars';
update team set price_signup = 5825, price_note = 'Tilmelding til Empire-pris – resterende 975 kr. betales efter 4 prøvegange' where name = 'Control';
update team set price_full = null, price_half = null, price_note = 'Betales med klippekort (10 klip = 625 kr.) – købes i appen eller mød bare op', installments_allowed = false where name like 'Hit Fit%';
update team set price_note = 'Inkluderet i holdpakken for hovedholdet – ingen separat betaling', installments_allowed = false where name like 'Teknik%';

alter table web_signup add column if not exists installments int not null default 1;
alter table web_signup add column if not exists fee_dkk int not null default 0;
alter table web_signup add column if not exists per_rate_dkk int;
alter table web_signup add column if not exists rates_paid int not null default 0;
alter table web_signup add column if not exists price_note text;

drop view if exists public_teams;
create view public_teams as select school_id, id, name, admission, admission_note, closed, punch_card_open, price_full, price_half, price_signup, price_note, installments_allowed from team where visibility = 'public' and not archived;
grant select on public_teams to anon, authenticated;
drop view if exists web_signup_view;
create view web_signup_view with (security_invoker = true) as
  select w.*, person_name(w.dancer_id) as dancer_name, person_name(w.contact_id) as contact_name, (select name from team t where t.id = w.team_id) as team_name,
         (select email from person p where p.id = w.contact_id) as email, (select phone from person p where p.id = w.contact_id) as phone
  from web_signup w;
grant select on web_signup_view to authenticated;

-- the one place the season price is computed: plan = full | half | rates2 | rates4 | rates10
create or replace function season_quote(p_team uuid, p_contact uuid, p_plan text)
returns table (before int, discount_pct int, amount int, installments int, fee int, per_rate int, note text) language plpgsql stable security definer set search_path = public as $$
declare tm team; base int; pct int; n int := 1; f int := 0; amt int; begin
  select * into tm from team where id = p_team;
  n := case p_plan when 'rates2' then 2 when 'rates4' then 4 when 'rates10' then 10 else 1 end;
  if n > 1 and not tm.installments_allowed then n := 1; end if;
  base := case when p_plan = 'half' and tm.price_half is not null then tm.price_half else coalesce(tm.price_signup, tm.price_full) end;
  if base is null then return query select null::int, 0, null::int, 1, 0, null::int, tm.price_note; return; end if;
  pct := coalesce(family_discount_pct(p_contact, base), 0);
  amt := round(base * (100 - pct) / 100.0);
  -- 50 kr. per rate, but only once per rate per household: skip when the household already runs a plan with the same number of rates
  if n > 1 and not exists (select 1 from web_signup w where w.contact_id = p_contact and w.status <> 'cancelled' and w.installments = n and w.created_at > now() - interval '11 months') then f := 50 * n; end if;
  return query select base, pct, amt + f, n, f, case when n > 1 then ceil((amt + f)::numeric / n)::int else amt + f end, tm.price_note;
end $$;

create or replace function web_signup(p_school_slug text, p_team_name text, p_dancer_first text, p_dancer_last text, p_birth_date date,
  p_contact_first text, p_contact_last text, p_email text, p_phone text, p_self boolean, p_plan text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; tm team; contact uuid; dancer uuid; q record; ref text; wid uuid; em text := lower(trim(p_email));
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
  select * into q from season_quote(tm.id, contact, p_plan);
  ref := left(tm.name, 18) || ' ' || trim(p_dancer_first);
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, installments, fee_dkk, per_rate_dkk, price_note, reference, note, source)
  values (sid, dancer, contact, tm.id, p_plan, q.amount, q.before, q.discount_pct, q.installments, q.fee, q.per_rate, q.note, ref, nullif(trim(p_note), ''), 'web') returning id into wid;
  perform notify_admins(sid, 'signup', 'Ny tilmelding fra websitet 📝', trim(p_dancer_first) || ' → ' || tm.name || coalesce(' · ' || q.amount || ' kr.' || case when q.installments > 1 then ' i ' || q.installments || ' rater' else '' end || case when q.discount_pct > 0 then ' (familierabat)' else '' end, ''), jsonb_build_object('web_signup_id', wid, 'person_id', dancer));
  return jsonb_build_object('id', wid, 'reference', ref, 'amount_dkk', q.amount, 'amount_before_dkk', q.before, 'discount_pct', q.discount_pct, 'installments', q.installments, 'fee_dkk', q.fee, 'per_rate_dkk', q.per_rate, 'note', q.note, 'plan', p_plan, 'team', tm.name, 'mobilepay', (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid));
end $$;

create or replace function app_signup_team(p_team uuid, p_person uuid, p_plan text) returns jsonb language plpgsql security definer set search_path = public as $$
declare tm team; me uuid := my_person_id(); q record; ref text; wid uuid; fn text; begin
  if me is null or not i_am_approved() then raise exception 'not allowed'; end if;
  if not (p_person = me or p_person in (select my_people())) then raise exception 'not your person'; end if;
  select * into tm from team where id = p_team and school_id = my_school_id() and not archived and visibility = 'public'; if tm.id is null then raise exception 'unknown team'; end if;
  if exists (select 1 from membership where person_id = p_person and team_id = p_team) then raise exception 'already member'; end if;
  if exists (select 1 from web_signup where dancer_id = p_person and team_id = p_team and status <> 'cancelled') then raise exception 'already requested'; end if;
  select first_name into fn from person where id = p_person;
  select * into q from season_quote(tm.id, me, p_plan);
  ref := left(tm.name, 18) || ' ' || fn;
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, amount_before_dkk, discount_pct, installments, fee_dkk, per_rate_dkk, price_note, reference, source)
  values (tm.school_id, p_person, me, tm.id, p_plan, q.amount, q.before, q.discount_pct, q.installments, q.fee, q.per_rate, q.note, ref, 'app') returning id into wid;
  perform notify_admins(tm.school_id, 'signup', 'Ny holdtilmelding i appen 📝', fn || ' → ' || tm.name || coalesce(' · ' || q.amount || ' kr.' || case when q.installments > 1 then ' i ' || q.installments || ' rater' else '' end, ''), jsonb_build_object('web_signup_id', wid, 'person_id', p_person));
  return jsonb_build_object('id', wid, 'reference', ref, 'amount_dkk', q.amount, 'amount_before_dkk', q.before, 'discount_pct', q.discount_pct, 'installments', q.installments, 'fee_dkk', q.fee, 'per_rate_dkk', q.per_rate, 'note', q.note, 'team', tm.name);
end $$;

-- admin marks a payment (or one rate) as received; status becomes paid when all rates are in
create or replace function mark_payment_paid(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare w web_signup; begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into w from web_signup where id = p_id and school_id = my_school_id(); if w.id is null then return; end if;
  update web_signup set rates_paid = least(installments, rates_paid + 1), claimed_paid_at = null,
    status = case when rates_paid + 1 >= installments then 'paid' else 'awaiting_payment' end where id = p_id;
end $$;
grant execute on function mark_payment_paid(uuid) to authenticated;

-- first rate paid → dancer joins the team right away (not only when everything is paid)
create or replace function trg_web_signup_first_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rates_paid >= 1 and (old.rates_paid is null or old.rates_paid < 1) and new.status <> 'paid' then
    insert into membership(person_id, team_id, role) values (new.dancer_id, new.team_id, 'dancer') on conflict do nothing;
    update person set status = 'approved', updated_at = now() where id in (new.dancer_id, new.contact_id) and status = 'pending';
    perform notify(new.contact_id, 'payment', 'Rate ' || new.rates_paid || ' af ' || new.installments || ' modtaget ✓', (select name from team where id = new.team_id), jsonb_build_object('payment_id', new.id));
  end if; return new;
end $$;
drop trigger if exists web_signup_first_rate on web_signup;
create trigger web_signup_first_rate after update on web_signup for each row execute function trg_web_signup_first_rate();
