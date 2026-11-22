-- 0055: sign-up window. Admin can close sign-ups for the whole school (season break) and per team; teams stay visible
-- (description, times) but cannot be joined until opened again. Audition teams cannot be joined directly from app/website.
alter table team add column if not exists signup_open boolean not null default true;

-- school-level switch lives in school.settings->>'signups_open' ('true'/'false'; missing = open). Admin toggles it with this RPC.
create or replace function set_signups_open(p_open boolean) returns void language sql security definer set search_path = public as $$
  update school set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('signups_open', p_open) where id = my_school_id() and i_am_admin()
$$;
grant execute on function set_signups_open(boolean) to authenticated;

-- anon-readable flag for the website + app (the settings column itself is not exposed)
create or replace function signups_open(p_school_slug text default null) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((s.settings->>'signups_open')::boolean, true) from school s
  where s.id = coalesce((select id from school where slug = p_school_slug), my_school_id()) limit 1
$$;
grant execute on function signups_open(text) to anon, authenticated;

-- public_teams exposes the per-team flag (website hides "Tilmeld holdet" when closed)
drop view if exists public_teams;
create view public_teams as select school_id, id, name, admission, admission_note, closed, punch_card_open, price_full, price_half, price_signup, price_note, installments_allowed, signup_open from team where visibility = 'public' and not archived;
grant select on public_teams to anon, authenticated;

-- the one guard for every sign-up path (app_signup_team, web_signup): closed or audition → refuse; admin's own payment requests pass
create or replace function trg_web_signup_window() returns trigger language plpgsql security definer set search_path = public as $$
declare tm team; open_all boolean;
begin
  if new.source = 'admin' then return new; end if;
  select * into tm from team where id = new.team_id;
  select coalesce((settings->>'signups_open')::boolean, true) into open_all from school where id = new.school_id;
  if not open_all or not coalesce(tm.signup_open, true) then raise exception 'signups closed'; end if;
  if tm.admission = 'audition' then raise exception 'audition required'; end if;
  return new;
end $$;
drop trigger if exists web_signup_window on web_signup;
create trigger web_signup_window before insert on web_signup for each row execute function trg_web_signup_window();

-- price preview before the confirming tap (what app_signup_team would charge)
create or replace function my_quote(p_team uuid, p_plan text) returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(q) from season_quote(p_team, my_person_id(), p_plan) q
$$;
grant execute on function my_quote(uuid, text) to authenticated;

select 'chk' as chk, signups_open() as open_all, (select count(*) from team where signup_open) as teams_open;
