-- 0065: (1) boost events on the website front page, (2) sign-up for chosen events directly from the website.
-- Website sign-ups are NOT users: they land in event_guest (a participant on one event). If the e-mail belongs to an
-- existing person it is linked for Line's overview, nothing else. Payment is the same MobilePay flow as everything else:
-- reference + amount → Line marks "betalt" in the app → receipt mail.
alter table event add column if not exists featured boolean not null default false;      -- shown big under the hero on the website
alter table event add column if not exists featured_until date;                          -- optional: stop boosting after this day
alter table event add column if not exists web_signup boolean not null default false;    -- open for sign-up from the website
alter table event add column if not exists max_participants int;                         -- optional capacity (app + website together)

create table if not exists event_guest (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  first_name text not null, last_name text not null default '',
  birth_date date,
  contact_name text, email text not null, phone text, note text,
  person_id uuid references person(id) on delete set null,   -- existing member with this e-mail (info only)
  amount_dkk int, reference text not null,
  paid boolean not null default false, claimed_paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_guest_event on event_guest(event_id);
alter table event_guest enable row level security;
drop policy if exists event_guest_staff on event_guest;
create policy event_guest_staff on event_guest for all using (school_id = my_school_id() and i_am_staff()) with check (school_id = my_school_id() and i_am_staff());
grant select, update, delete on event_guest to authenticated;

-- views freeze e.* → recreate so the app sees the new columns; guests = website participants
drop view if exists event_view;
create view event_view with (security_invoker = true) as
  select e.*, (select count(*) from event_signup s where s.event_id = e.id) as signups,
         (select count(*) from event_guest g where g.event_id = e.id) as guests,
         (select array_agg(name order by name) from team where id = any(e.team_ids)) as team_names,
         (select array_agg(first_name || ' ' || last_name order by first_name) from person where id = any(e.person_ids)) as person_names
  from event e;
grant select on event_view to authenticated;

drop view if exists public_events;
create view public_events as
  select school_id, id, title, kind, starts_at, ends_at, place, meet_time, signup_deadline, price_dkk, info, plan, pack_list, image_key, focus,
         featured, featured_until, web_signup, max_participants,
         case when max_participants is null then null else greatest(0, max_participants
           - (select count(*) from event_signup s where s.event_id = event.id)::int - (select count(*) from event_guest g where g.event_id = event.id)::int) end as spots_left,
         (select array_agg(name order by name) from team where id = any(event.team_ids) and visibility = 'public') as team_names
  from event where visibility = 'public' and starts_at >= now() - interval '1 day';
grant select on public_events to anon, authenticated;

create or replace function web_event_signup(p_school_slug text, p_event_id uuid, p_first text, p_last text, p_birth_date date,
  p_contact_first text, p_contact_last text, p_email text, p_phone text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; ev event; em text := lower(trim(p_email)); gid uuid; ref text; pid uuid; taken int; nm text; body text;
begin
  select id into sid from school where slug = p_school_slug; if sid is null then raise exception 'unknown school'; end if;
  select * into ev from event where id = p_event_id and school_id = sid;
  if ev.id is null or ev.visibility <> 'public' or not ev.web_signup then raise exception 'not open'; end if;
  if ev.starts_at < now() or (ev.signup_deadline is not null and ev.signup_deadline < current_date) then raise exception 'closed'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if length(trim(coalesce(p_first, ''))) < 1 then raise exception 'missing name'; end if;
  if (select count(*) from event_guest where lower(email) = em and created_at > now() - interval '1 day') >= 10 then raise exception 'too many'; end if;
  if exists (select 1 from event_guest where event_id = ev.id and lower(email) = em and lower(first_name) = lower(trim(p_first))) then raise exception 'already'; end if;
  if ev.max_participants is not null then
    taken := (select count(*) from event_signup where event_id = ev.id)::int + (select count(*) from event_guest where event_id = ev.id)::int;
    if taken >= ev.max_participants then raise exception 'full'; end if;
  end if;
  select id into pid from person where school_id = sid and lower(email) = em and status = 'approved' order by (user_id is not null) desc limit 1;
  ref := left(ev.title, 18) || ' ' || trim(p_first);
  nm := trim(p_first) || ' ' || trim(coalesce(p_last, ''));
  insert into event_guest(school_id, event_id, first_name, last_name, birth_date, contact_name, email, phone, note, person_id, amount_dkk, reference)
  values (sid, ev.id, trim(p_first), trim(coalesce(p_last, '')), p_birth_date, nullif(trim(coalesce(p_contact_first, '') || ' ' || coalesce(p_contact_last, '')), ''), em, nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_note, '')), ''), pid, ev.price_dkk, ref)
  returning id into gid;
  perform notify_admins(sid, 'event', 'Tilmelding fra websitet 🎟', nm || ' → ' || ev.title || case when ev.price_dkk is not null then ' · ' || ev.price_dkk || ' kr. (afventer betaling)' else '' end, jsonb_build_object('event_id', ev.id));
  body := '<p>Tak for tilmeldingen af <b>' || nm || '</b> til <b>' || ev.title || '</b> – '
       || to_char(ev.starts_at at time zone 'Europe/Copenhagen', 'DD.MM.YYYY "kl." HH24:MI') || coalesce(', ' || ev.place, '') || '.</p>'
       || case when ev.price_dkk is not null then '<p>Betal <b>' || ev.price_dkk || ' kr.</b> med MobilePay til <b>' || (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid)
            || '</b> med teksten <b>' || ref || '</b>. Du får en kvittering, når betalingen er registreret.</p>' else '<p>Eventet er gratis – vi glæder os til at se jer.</p>' end;
  perform send_mail(sid, em, 'Tilmelding modtaget – ' || ev.title, app_mail_html(sid, 'Tilmelding modtaget', coalesce(nullif(trim(coalesce(p_contact_first, '')), ''), trim(p_first)), body), 'event_guest', jsonb_build_object('event_id', ev.id, 'guest_id', gid));
  return jsonb_build_object('id', gid, 'title', ev.title, 'reference', ref, 'amount_dkk', ev.price_dkk,
    'mobilepay', (select coalesce(settings->'mobilepay'->>'number', '46664') from school where id = sid));
end $$;
grant execute on function web_event_signup(text, uuid, text, text, date, text, text, text, text, text) to anon, authenticated;

-- receipt when Line marks the guest paid (same as every other payment)
create or replace function trg_event_guest_paid() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if new.paid and not old.paid and new.amount_dkk is not null then
    select title into t from event where id = new.event_id;
    perform send_mail(new.school_id, new.email, 'Kvittering – ' || t,
      receipt_html(new.school_id, 'Betaling modtaget', coalesce(new.contact_name, new.first_name),
        jsonb_build_array(jsonb_build_object('label', t || ' · ' || new.first_name || ' ' || new.last_name, 'value', new.amount_dkk || ' kr.')), new.amount_dkk || ' kr.', null),
      'receipt', jsonb_build_object('guest_id', new.id));
  end if; return new;
end $$;
drop trigger if exists event_guest_paid on event_guest;
create trigger event_guest_paid after update on event_guest for each row execute function trg_event_guest_paid();

select 'chk' as chk, (select count(*) from information_schema.columns where table_name = 'event' and column_name in ('featured','web_signup','max_participants','featured_until')) as cols,
       (select count(*) from pg_proc where proname = 'web_event_signup') as fn;
