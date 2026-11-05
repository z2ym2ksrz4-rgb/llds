-- Phase 4: events + signups, shop orders (MobilePay), punch cards, milestones, in-app notifications.

alter table punch_card add column if not exists claimed_paid_at timestamptz;
alter table punch_card add column if not exists team_ids uuid[] not null default '{}';   -- teams the card is used on (punch_card_open teams)
alter table milestone add column if not exists given_by uuid references person(id);
alter table milestone add column if not exists team_id uuid references team(id) on delete set null;
alter table milestone add column if not exists created_at timestamptz not null default now();
alter table event add column if not exists ends_at timestamptz;
alter table event add column if not exists created_by uuid references person(id);

-- ---------------------------------------------------------------- notifications (in-app inbox; native push comes with the store phase)
create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  kind text not null,                 -- message | booking | substitute | event | milestone | order | punch | post
  title text not null,
  body text,
  ref jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_person on notification(person_id, read_at, created_at desc);
alter table notification enable row level security;
create policy notification_own on notification for select using (person_id in (select my_people()));
create policy notification_mark on notification for update using (person_id in (select my_people())) with check (person_id in (select my_people()));

-- notify helper (definer: called from triggers)
create or replace function notify(p_person uuid, p_kind text, p_title text, p_body text, p_ref jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notification(person_id, kind, title, body, ref) select p_person, p_kind, p_title, p_body, p_ref where exists (select 1 from person where id = p_person and user_id is not null)
$$;

-- people to notify about a team: dancers with a login + their parents + staff
create or replace function team_audience(p_team uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct x from (
    select m.person_id as x from membership m join person p on p.id = m.person_id where m.team_id = p_team and p.user_id is not null and p.status = 'approved'
    union
    select g.parent_id from membership m join guardian g on g.child_id = m.person_id join person p on p.id = g.parent_id where m.team_id = p_team and p.status = 'approved'
  ) s
$$;

-- message → recipients
create or replace function trg_message_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if (new.audience->>'all')::boolean is true then
    for r in select id from person where school_id = new.school_id and status = 'approved' and user_id is not null loop
      perform notify(r.id, 'message', new.title, left(new.body, 120), jsonb_build_object('message_id', new.id));
    end loop;
  else
    for r in select distinct team_audience(t::uuid) as id from jsonb_array_elements_text(coalesce(new.audience->'teams','[]'::jsonb)) t loop
      perform notify(r.id, 'message', new.title, left(new.body, 120), jsonb_build_object('message_id', new.id));
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists message_notify on message;
create trigger message_notify after insert on message for each row execute function trg_message_notify();

-- booking status → owner (+ parents)
create or replace function trg_booking_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; room_name text;
begin
  if new.status = old.status then return new; end if;
  select name into room_name from room where id = new.room_id;
  for r in select new.person_id as id union select parent_id from guardian where child_id = new.person_id loop
    perform notify(r.id, 'booking', case when new.status = 'approved' then 'Booking godkendt' else 'Booking afvist' end, new.title || ' · ' || coalesce(room_name,'') || ' · ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI'), jsonb_build_object('booking_id', new.id));
  end loop;
  return new;
end $$;
drop trigger if exists booking_notify on booking;
create trigger booking_notify after update on booking for each row execute function trg_booking_notify();

-- substitute wanted → all staff; substitute taken → team
create or replace function trg_session_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; tname text;
begin
  select name into tname from team where id = new.team_id;
  if new.substitute_wanted and not old.substitute_wanted then
    for r in select distinct p.id from person p join membership m on m.person_id = p.id where p.school_id = new.school_id and p.status = 'approved' and m.role in ('trainer','assistant') and p.id <> coalesce(new.trainer_id, '00000000-0000-0000-0000-000000000000'::uuid)
             union select id from person where school_id = new.school_id and is_admin loop
      perform notify(r.id, 'substitute', 'Vikar søges', coalesce(tname,'') || ' · ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI'), jsonb_build_object('session_id', new.id));
    end loop;
  elsif new.cancelled and not old.cancelled and new.team_id is not null then
    for r in select team_audience(new.team_id) as id loop
      perform notify(r.id, 'session', 'Træning aflyst', coalesce(tname,'') || ' · ' || to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM HH24:MI') || coalesce(' · ' || new.cancel_note, ''), jsonb_build_object('session_id', new.id));
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists session_notify on session;
create trigger session_notify after update on session for each row execute function trg_session_notify();

-- new event → teams (or everyone)
create or replace function trg_event_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; t uuid;
begin
  if array_length(new.team_ids, 1) is null then
    for r in select id from person where school_id = new.school_id and status = 'approved' and user_id is not null loop
      perform notify(r.id, 'event', new.title, to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM') || coalesce(' · ' || new.place, ''), jsonb_build_object('event_id', new.id));
    end loop;
  else
    foreach t in array new.team_ids loop
      for r in select team_audience(t) as id loop
        perform notify(r.id, 'event', new.title, to_char(new.starts_at at time zone 'Europe/Copenhagen', 'DD.MM') || coalesce(' · ' || new.place, ''), jsonb_build_object('event_id', new.id));
      end loop;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists event_notify on event;
create trigger event_notify after insert on event for each row execute function trg_event_notify();

-- milestone → dancer + parents
create or replace function trg_milestone_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select new.person_id as id union select parent_id from guardian where child_id = new.person_id loop
    perform notify(r.id, 'milestone', 'Ny milepæl 🏅', new.title, jsonb_build_object('milestone_id', new.id));
  end loop;
  return new;
end $$;
drop trigger if exists milestone_notify on milestone;
create trigger milestone_notify after insert on milestone for each row execute function trg_milestone_notify();

-- order / punch card paid or delivered → owner; claimed paid → admins
create or replace function trg_order_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'UPDATE' and new.status <> old.status then
    for r in select new.person_id as id union select parent_id from guardian where child_id = new.person_id loop
      perform notify(r.id, 'order', case new.status when 'paid' then 'Betaling modtaget' when 'delivered' then 'Ordre udleveret' when 'cancelled' then 'Ordre annulleret' else 'Ordre opdateret' end, 'Ordre #' || new.number, jsonb_build_object('order_id', new.id));
    end loop;
  end if;
  if tg_op = 'UPDATE' and new.claimed_paid_at is not null and old.claimed_paid_at is null then
    for r in select id from person where school_id = new.school_id and is_admin loop
      perform notify(r.id, 'order', 'Betaling meldt', 'Ordre #' || new.number || ' · ' || new.total_dkk || ' kr.', jsonb_build_object('order_id', new.id));
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists order_notify on "order";
create trigger order_notify after update on "order" for each row execute function trg_order_notify();

-- ---------------------------------------------------------------- punch cards
-- buyer claims payment; admin activates (sets validity, joins the punch-card teams)
create or replace function activate_punch_card(p_card uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c punch_card; ty punch_card_type; t uuid;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  select * into c from punch_card where id = p_card; select * into ty from punch_card_type where id = c.type_id;
  if ty.school_id <> my_school_id() then raise exception 'wrong school'; end if;
  update punch_card set status = 'active', expires_on = current_date + ty.valid_days,
    team_ids = (select coalesce(array_agg(id), '{}') from team where school_id = ty.school_id and punch_card_open and not archived) where id = p_card;
  for t in select id from team where school_id = ty.school_id and punch_card_open and not archived loop
    insert into membership(person_id, team_id, role) values (c.person_id, t, 'dancer') on conflict do nothing;
  end loop;
  perform notify(x, 'punch', 'Klippekort aktiveret', ty.name || ' · ' || ty.punches || ' klip', jsonb_build_object('card_id', p_card)) from (select c.person_id as x union select parent_id from guardian where child_id = c.person_id) f;
end $$;

-- attendance marks present on a punch-card team → one punch
create or replace function trg_attendance_punch() returns trigger language plpgsql security definer set search_path = public as $$
declare s session; t team; c punch_card;
begin
  if not new.present then return new; end if;
  select * into s from session where id = new.session_id; if s.team_id is null then return new; end if;
  select * into t from team where id = s.team_id; if not t.punch_card_open then return new; end if;
  select * into c from punch_card where person_id = new.person_id and status = 'active' and punches_left > 0 and expires_on >= current_date order by expires_on limit 1;
  if c.id is null then return new; end if;
  if exists (select 1 from punch where card_id = c.id and session_id = new.session_id) then return new; end if;
  insert into punch(card_id, session_id) values (c.id, new.session_id);
  update punch_card set punches_left = punches_left - 1, status = case when punches_left - 1 <= 0 then 'expired' else status end where id = c.id;
  new.via_punch := true;
  perform notify(x, 'punch', 'Klip brugt', t.name || ' · ' || (c.punches_left - 1) || ' klip tilbage', jsonb_build_object('card_id', c.id)) from (select c.person_id as x union select parent_id from guardian where child_id = c.person_id) f;
  return new;
end $$;
drop trigger if exists attendance_punch on attendance;
create trigger attendance_punch before insert or update on attendance for each row execute function trg_attendance_punch();

create or replace view punch_card_view with (security_invoker = true) as
  select c.*, ty.name as type_name, ty.punches as punches_total, ty.price_dkk, person_name(c.person_id) as person_name,
         (select count(*) from punch p where p.card_id = c.id) as used
  from punch_card c join punch_card_type ty on ty.id = c.type_id;
grant select on punch_card_view to authenticated;

-- ---------------------------------------------------------------- views for events, orders, milestones
create or replace view event_view with (security_invoker = true) as
  select e.*, (select count(*) from event_signup s where s.event_id = e.id) as signups,
         (select array_agg(name order by name) from team where id = any(e.team_ids)) as team_names
  from event e;
grant select on event_view to authenticated;

create or replace view event_signup_view with (security_invoker = true) as
  select s.*, person_name(s.person_id) as person_name,
         (select t.name from membership m join team t on t.id = m.team_id join event e on e.id = s.event_id where m.person_id = s.person_id and t.id = any(e.team_ids) limit 1) as team_name
  from event_signup s;
grant select on event_signup_view to authenticated;

create or replace view order_view with (security_invoker = true) as
  select o.*, person_name(o.person_id) as person_name from "order" o;
grant select on order_view to authenticated;

create or replace view milestone_view with (security_invoker = true) as
  select m.*, person_name(m.person_id) as person_name, person_name(m.given_by) as given_by_name, (select name from team t where t.id = m.team_id) as team_name from milestone m;
grant select on milestone_view to authenticated;

create policy pc_claim on punch_card for update using (person_id in (select my_people()) and status = 'awaiting_payment') with check (status = 'awaiting_payment');

-- public website: events + products already exposed via public_events / public_products (0001)

-- public bucket for things the website shows (product images). Admin writes, everyone reads.
insert into storage.buckets (id, name, public) values ('public', 'public', true) on conflict (id) do nothing;
create policy public_bucket_read on storage.objects for select using (bucket_id = 'public');
create policy public_bucket_write on storage.objects for insert with check (bucket_id = 'public' and i_am_admin());
create policy public_bucket_delete on storage.objects for delete using (bucket_id = 'public' and i_am_admin());
