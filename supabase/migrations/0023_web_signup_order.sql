-- 0023: sign up + pay for a team, and buy in the shop, from the website – no app needed.
-- Anonymous RPCs (security definer) create pending people / guest orders; payment is MobilePay with a reference, Line confirms in Admin as usual.
alter table person add column if not exists source text not null default 'app';   -- app | web
alter table "order" alter column person_id drop not null;
alter table "order" add column if not exists guest_name text, add column if not exists guest_email text, add column if not exists guest_phone text;

create table if not exists web_signup (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  dancer_id uuid not null references person(id) on delete cascade,
  contact_id uuid not null references person(id) on delete cascade,
  team_id uuid not null references team(id) on delete cascade,
  plan text not null,                 -- full | half | rates
  amount_dkk int,                     -- null = rates (agreed with Line)
  reference text not null,
  note text,
  status text not null default 'awaiting_payment',   -- awaiting_payment | paid | cancelled
  claimed_paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table web_signup enable row level security;
drop policy if exists web_signup_admin on web_signup;
create policy web_signup_admin on web_signup for all using (i_am_admin() and school_id = my_school_id());

drop view if exists order_view;
create view order_view with (security_invoker = true) as
  select o.*, coalesce(person_name(o.person_id), o.guest_name || ' (web)') as person_name from "order" o;
grant select on order_view to authenticated;

create or replace view web_signup_view with (security_invoker = true) as
  select w.*, person_name(w.dancer_id) as dancer_name, person_name(w.contact_id) as contact_name, (select name from team t where t.id = w.team_id) as team_name,
         (select email from person p where p.id = w.contact_id) as email, (select phone from person p where p.id = w.contact_id) as phone
  from web_signup w;
grant select on web_signup_view to authenticated;

create or replace function trg_order_admin_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_admins(new.school_id, 'order', 'Ny ordre 🛍 #' || new.number, coalesce(person_name(new.person_id), new.guest_name || ' (web)') || ' · ' || new.total_dkk || ' kr.', jsonb_build_object('order_id', new.id)); return new;
end $$;

-- price text → amounts: "2.400 kr. for hel sæson, eller 1.750 kr. for halv sæson" → full 2400, half 1750
create or replace function price_amounts(p text) returns int[] language sql immutable as $$
  select coalesce(array_agg(replace(m[1], '.', '')::int), '{}') from regexp_matches(coalesce(p, ''), '([0-9][0-9.]*) kr', 'g') m
$$;

create or replace function web_signup(p_school_slug text, p_team_name text, p_dancer_first text, p_dancer_last text, p_birth_date date,
  p_contact_first text, p_contact_last text, p_email text, p_phone text, p_self boolean, p_plan text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; tm team; contact uuid; dancer uuid; amounts int[]; amount int; ref text; wid uuid; em text := lower(trim(p_email));
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  select * into tm from team where school_id = sid and name = p_team_name and not archived; if tm.id is null then raise exception 'unknown team'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(p_dancer_first)) < 1 or length(trim(p_contact_first)) < 1 then raise exception 'missing name'; end if;
  if (select count(*) from web_signup w join person p on p.id = w.contact_id where w.school_id = sid and lower(p.email) = em and w.created_at > now() - interval '1 day') >= 5 then raise exception 'too many'; end if;
  -- contact person: reuse a pending/approved person with this e-mail (no duplicate accounts), otherwise create
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
  amount := case p_plan when 'full' then amounts[1] when 'half' then coalesce(amounts[2], amounts[1]) else null end;
  ref := left(tm.name, 18) || ' ' || trim(p_dancer_first);
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, reference, note) values (sid, dancer, contact, tm.id, p_plan, amount, ref, nullif(trim(p_note), '')) returning id into wid;
  perform notify_admins(sid, 'signup', 'Ny tilmelding fra websitet 📝', trim(p_dancer_first) || ' → ' || tm.name || coalesce(' · ' || amount || ' kr.', ' · rater'), jsonb_build_object('web_signup_id', wid, 'person_id', dancer));
  return jsonb_build_object('id', wid, 'reference', ref, 'amount_dkk', amount, 'plan', p_plan, 'team', tm.name, 'mobilepay', (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid));
end $$;
grant execute on function web_signup(text, text, text, text, date, text, text, text, text, boolean, text, text) to anon, authenticated;

create or replace function web_signup_claim_paid(p_id uuid) returns void language sql security definer set search_path = public as $$
  update web_signup set claimed_paid_at = now() where id = p_id and status = 'awaiting_payment' and claimed_paid_at is null
$$;
grant execute on function web_signup_claim_paid(uuid) to anon, authenticated;

-- guest order from the website; prices are taken from the product table, never from the client
create or replace function web_order(p_school_slug text, p_name text, p_email text, p_phone text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; l jsonb; pr product; lines jsonb := '[]'::jsonb; total int := 0; o "order"; em text := lower(trim(p_email)); q int;
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(p_name)) < 2 then raise exception 'missing name'; end if;
  if (select count(*) from "order" where school_id = sid and lower(guest_email) = em and created_at > now() - interval '1 day') >= 5 then raise exception 'too many'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into pr from product where id = (l->>'product_id')::uuid and school_id = sid and active and visibility = 'public'; if pr.id is null then raise exception 'unknown product'; end if;
    q := greatest(1, least(10, coalesce((l->>'qty')::int, 1)));
    if cardinality(pr.sizes) > 0 and not (l->>'size') = any(pr.sizes) then raise exception 'bad size'; end if;
    lines := lines || jsonb_build_object('product_id', pr.id, 'name', pr.name, 'size', nullif(l->>'size', ''), 'qty', q, 'price_dkk', pr.price_dkk);
    total := total + q * pr.price_dkk;
  end loop;
  if total = 0 then raise exception 'empty'; end if;
  insert into "order"(school_id, person_id, lines, total_dkk, guest_name, guest_email, guest_phone) values (sid, null, lines, total, trim(p_name), em, nullif(trim(p_phone), '')) returning * into o;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total_dkk', o.total_dkk, 'reference', 'Ordre #' || o.number || ' ' || split_part(trim(p_name), ' ', 1), 'mobilepay', (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid));
end $$;
grant execute on function web_order(text, text, text, text, jsonb) to anon, authenticated;

create or replace function web_order_claim_paid(p_id uuid) returns void language sql security definer set search_path = public as $$
  update "order" set claimed_paid_at = now() where id = p_id and person_id is null and status = 'awaiting_payment' and claimed_paid_at is null
$$;
grant execute on function web_order_claim_paid(uuid) to anon, authenticated;

-- web signups show up in Admin → Brugere like app signups (listPending looks at user_id or source = 'web')
create or replace function trg_signup_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.status = 'pending' then
    perform notify_admins(new.school_id, 'signup', 'Ny tilmelding 📝', new.first_name || ' ' || new.last_name || coalesce(' – ' || new.wished_teams, ''), jsonb_build_object('person_id', new.id));
  end if; return new;
end $$;
