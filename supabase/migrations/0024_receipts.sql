-- 0024: automatic receipt e-mail when Line confirms a payment (web sign-up, shop order incl. guest orders, punch card activation).
-- Sent from the database via pg_net → Resend (noreply@llds.ilumie.com). The API key lives in Supabase Vault as 'resend_api_key'
-- (Dashboard → Project Settings → Vault, or: select vault.create_secret('re_…', 'resend_api_key')). Without the key the mail is only logged.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net missing: %', sqlerrm; end $$;
create table if not exists mail_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references school(id) on delete cascade,
  to_email text not null, subject text not null, html text not null,
  kind text not null, ref jsonb not null default '{}'::jsonb,
  status text not null default 'queued',    -- queued | sent | no_key | error
  request_id bigint, created_at timestamptz not null default now()
);
alter table mail_log enable row level security;
drop policy if exists mail_log_admin on mail_log;
create policy mail_log_admin on mail_log for select using (i_am_admin() and school_id = my_school_id());

create or replace function resend_key() returns text language plpgsql security definer set search_path = public as $$
declare k text; begin
  begin select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1; exception when others then k := null; end;
  return k;
end $$;

create or replace function send_mail(p_school uuid, p_to text, p_subject text, p_html text, p_kind text, p_ref jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare k text := resend_key(); mid uuid; rid bigint; frm text;
begin
  if p_to is null or p_to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  select coalesce(settings->>'mail_from', 'LL Dance Studio <noreply@llds.ilumie.com>') into frm from school where id = p_school;
  insert into mail_log(school_id, to_email, subject, html, kind, ref, status) values (p_school, p_to, p_subject, p_html, p_kind, p_ref, case when k is null then 'no_key' else 'queued' end) returning id into mid;
  if k is null then return mid; end if;
  begin
    select net.http_post(url := 'https://api.resend.com/emails', headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', frm, 'to', jsonb_build_array(p_to), 'subject', p_subject, 'html', p_html)) into rid;
    update mail_log set status = 'sent', request_id = rid where id = mid;
  exception when others then update mail_log set status = 'error: ' || sqlerrm where id = mid; end;
  return mid;
end $$;

create or replace function dkk(n int) returns text language sql immutable as $$ select regexp_replace(n::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || ' kr.' $$;

-- receipt layout (black/gold like the app)
create or replace function receipt_html(p_school uuid, p_title text, p_name text, p_rows jsonb, p_total text, p_note text)
returns text language sql stable as $$
  select '<div style="background:#0a0a0b;padding:32px 16px;font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#f4f1ea"><div style="max-width:560px;margin:0 auto;background:#121214;border:1px solid rgba(201,162,74,.35);border-radius:18px;padding:28px">'
    || '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a24a">' || (select name from school where id = p_school) || '</div>'
    || '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-weight:400;font-size:30px;margin:8px 0 4px">' || p_title || '</h1>'
    || '<p style="color:#a8a49c;margin:0 0 18px">Hej ' || coalesce(p_name, '') || ' – tak for din betaling. Her er din kvittering.</p>'
    || '<table style="width:100%;border-collapse:collapse;font-size:15px">' || (select string_agg('<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);color:#f4f1ea">' || (r->>'label') || '</td><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);text-align:right;color:#f4f1ea">' || (r->>'value') || '</td></tr>', '') from jsonb_array_elements(p_rows) r)
    || '<tr><td style="padding:12px 0;font-weight:600;color:#f4f1ea">I alt</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e6c87a">' || p_total || '</td></tr></table>'
    || coalesce('<p style="color:#a8a49c;font-size:14px;margin:16px 0 0">' || p_note || '</p>', '')
    || '<p style="color:#6f6c66;font-size:12px;margin:22px 0 0">Betalt ' || to_char(now() at time zone 'Europe/Copenhagen', 'DD.MM.YYYY HH24:MI') || ' · ' || (select name from school where id = p_school) || ' · Vinkelvej 17, 8860 Ulstrup</p>'
    || '</div></div>'
$$;

-- 1) web sign-up marked paid by admin
create or replace function trg_web_signup_receipt() returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text; tm text; dn text; begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    select p.email, p.first_name into em, nm from person p where p.id = new.contact_id;
    select name into tm from team where id = new.team_id; select first_name into dn from person where id = new.dancer_id;
    perform send_mail(new.school_id, em, 'Kvittering – ' || tm, receipt_html(new.school_id, 'Tilmelding bekræftet', nm,
      jsonb_build_array(jsonb_build_object('label', 'Hold', 'value', tm), jsonb_build_object('label', 'Danser', 'value', dn), jsonb_build_object('label', 'Betaling', 'value', case new.plan when 'full' then 'Hel sæson' when 'half' then 'Halv sæson' else 'Rater' end), jsonb_build_object('label', 'Reference', 'value', new.reference)),
      coalesce(dkk(new.amount_dkk), 'Aftalt i rater'), 'Vi glæder os til at se ' || dn || ' på gulvet. Træningstider og beskeder fra træneren finder du i appen – log ind med denne e-mail.'), 'web_signup', jsonb_build_object('web_signup_id', new.id));
  end if; return new;
end $$;
drop trigger if exists web_signup_receipt on web_signup;
create trigger web_signup_receipt after update on web_signup for each row execute function trg_web_signup_receipt();

-- 2) shop order marked paid (app user or guest)
create or replace function trg_order_receipt() returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text; rows jsonb; begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    if new.person_id is not null then select coalesce(p.email, (select g.email from guardian x join person g on g.id = x.parent_id where x.child_id = p.id limit 1)), p.first_name into em, nm from person p where p.id = new.person_id;
    else em := new.guest_email; nm := split_part(new.guest_name, ' ', 1); end if;
    select jsonb_agg(jsonb_build_object('label', (l->>'qty') || ' × ' || (l->>'name') || coalesce(' (' || (l->>'size') || ')', ''), 'value', dkk((l->>'qty')::int * (l->>'price_dkk')::int))) into rows from jsonb_array_elements(new.lines) l;
    perform send_mail(new.school_id, em, 'Kvittering – ordre #' || new.number, receipt_html(new.school_id, 'Ordre #' || new.number || ' betalt', nm, coalesce(rows, '[]'::jsonb), dkk(new.total_dkk), 'Varerne udleveres i studiet ved næste træning.'), 'order', jsonb_build_object('order_id', new.id));
  end if; return new;
end $$;
drop trigger if exists order_receipt on "order";
create trigger order_receipt after update on "order" for each row execute function trg_order_receipt();

-- 3) punch card activated (= payment registered)
create or replace function trg_punch_receipt() returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text; ty punch_card_type; sid uuid; teams text; begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    select coalesce(p.email, (select g.email from guardian x join person g on g.id = x.parent_id where x.child_id = p.id limit 1)), p.first_name, p.school_id into em, nm, sid from person p where p.id = new.person_id;
    select * into ty from punch_card_type where id = new.type_id;
    select string_agg(name, ', ') into teams from team where id = any(new.team_ids);
    perform send_mail(sid, em, 'Kvittering – ' || ty.name, receipt_html(sid, 'Klippekort aktiveret', nm,
      jsonb_build_array(jsonb_build_object('label', ty.name, 'value', ty.punches || ' klip'), jsonb_build_object('label', 'Gælder på', 'value', coalesce(teams, '–')), jsonb_build_object('label', 'Gyldigt til', 'value', to_char(new.expires_on, 'DD.MM.YYYY'))),
      dkk(new.price_dkk), 'Et klip bruges automatisk, når træneren registrerer fremmøde.'), 'punch', jsonb_build_object('card_id', new.id));
  end if; return new;
end $$;
drop trigger if exists punch_receipt on punch_card;
create trigger punch_receipt after update on punch_card for each row execute function trg_punch_receipt();
