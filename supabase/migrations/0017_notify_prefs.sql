-- 0017: notification preferences per person + admin notifications on sign-ups, orders, punch cards and event sign-ups.
alter table person add column if not exists notify_prefs jsonb not null default '{}'::jsonb;   -- {"on":true,"kinds":{"message":false,...}}

create or replace function wants_notification(p_person uuid, p_kind text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((p.notify_prefs->>'on')::boolean, true) and coalesce((p.notify_prefs->'kinds'->>p_kind)::boolean, true)
  from person p where p.id = p_person
$$;

create or replace function notify(p_person uuid, p_kind text, p_title text, p_body text, p_ref jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notification(person_id, kind, title, body, ref) select p_person, p_kind, p_title, p_body, p_ref
  where exists (select 1 from person where id = p_person and user_id is not null) and wants_notification(p_person, p_kind)
$$;

create or replace function notify_admins(p_school uuid, p_kind text, p_title text, p_body text, p_ref jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  select notify(p.id, p_kind, p_title, p_body, p_ref) from person p where p.school_id = p_school and p.is_admin and p.status = 'approved'
$$;

-- new sign-up (adult with login, pending)
create or replace function trg_signup_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.status = 'pending' then
    perform notify_admins(new.school_id, 'signup', 'Ny tilmelding 📝', new.first_name || ' ' || new.last_name || coalesce(' – ' || new.wished_teams, ''), jsonb_build_object('person_id', new.id));
  end if; return new;
end $$;
drop trigger if exists signup_notify on person;
create trigger signup_notify after insert on person for each row execute function trg_signup_notify();

-- shop order
create or replace function trg_order_admin_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_admins(new.school_id, 'order', 'Ny ordre 🛍 #' || new.number, person_name(new.person_id) || ' · ' || new.total_dkk || ' kr.', jsonb_build_object('order_id', new.id)); return new;
end $$;
drop trigger if exists order_admin_notify on "order";
create trigger order_admin_notify after insert on "order" for each row execute function trg_order_admin_notify();

-- punch card bought
create or replace function trg_punch_admin_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid; begin
  select school_id into sid from person where id = new.person_id;
  perform notify_admins(sid, 'punch', 'Nyt klippekort 🎟', person_name(new.person_id), jsonb_build_object('card_id', new.id)); return new;
end $$;
drop trigger if exists punch_admin_notify on punch_card;
create trigger punch_admin_notify after insert on punch_card for each row execute function trg_punch_admin_notify();

-- event sign-up
create or replace function trg_event_signup_admin_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare e record; begin
  select school_id, title into e from event where id = new.event_id;
  perform notify_admins(e.school_id, 'signup', 'Tilmelding til ' || e.title || ' ✅', person_name(new.person_id), jsonb_build_object('event_id', new.event_id)); return new;
end $$;
drop trigger if exists event_signup_admin_notify on event_signup;
create trigger event_signup_admin_notify after insert on event_signup for each row execute function trg_event_signup_admin_notify();

-- app appearance (layout, custom boxes, images) – readable by everyone incl. anon (login screen), editable by admins via school_admin policy
alter table school add column if not exists appearance jsonb not null default '{}'::jsonb;

-- event_view was created with e.* before image_key existed (0013) – a view freezes its column list, so the app never saw image_key. Recreate it.
drop view if exists event_view;
create view event_view with (security_invoker = true) as
  select e.*, (select count(*) from event_signup s where s.event_id = e.id) as signups,
         (select array_agg(name order by name) from team where id = any(e.team_ids)) as team_names
  from event e;
grant select on event_view to authenticated;
