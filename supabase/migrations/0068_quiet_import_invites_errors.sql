-- 0068: roll-out tools.
-- (1) Import members without sending the invitation (mails are held, not sent), (2) invite a whole team later,
-- (3) invitation status per team, (4) client error log for App insights.

-- (1) send_mail honours a transaction-local switch: held mails are logged with status 'held' and never sent
do $$
declare d text;
begin
  d := pg_get_functiondef('send_mail'::regproc);
  if position('llds.hold_mail' in d) = 0 then
    if position('insert into mail_log(' in d) = 0 then raise exception 'send_mail: anchor not found'; end if;
    d := regexp_replace(d, '(\n\s*)(insert into mail_log\()',
      E'\\1if coalesce(current_setting(''llds.hold_mail'', true), '''') = ''1'' then\n    insert into mail_log(school_id, to_email, subject, html, kind, ref, status) values (p_school, p_to, p_subject, p_html, p_kind, p_ref, ''held'') returning id into mid; return mid;\n  end if;\\1\\2');
    execute d;
  end if;
end $$;

create or replace function invite_person_quiet(p_first text, p_last text, p_email text, p_phone text, p_is_parent boolean, p_memberships jsonb, p_children jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  perform set_config('llds.hold_mail', '1', true);
  pid := invite_person(p_first, p_last, p_email, p_phone, p_is_parent, p_memberships, p_children, null);
  perform set_config('llds.hold_mail', '', true);
  update person set invited_at = null where id = pid;   -- created, not invited yet
  return pid;
end $$;
grant execute on function invite_person_quiet(text, text, text, text, boolean, jsonb, jsonb) to authenticated;

-- the people who should get an invitation for a team: members with an e-mail, and the parents of its dancers
create or replace function team_login_people(p_team uuid) returns table(person_id uuid) language sql stable security definer set search_path = public as $$
  select distinct x.id from (
    select p.id from membership m join person p on p.id = m.person_id where m.team_id = p_team and p.status = 'approved' and p.email is not null
    union
    select g.parent_id from membership m join guardian g on g.child_id = m.person_id join person p on p.id = g.parent_id where m.team_id = p_team and m.role = 'dancer' and p.status = 'approved' and p.email is not null
  ) x
$$;

-- (2) invite everyone on a team who has not been invited (p_again: also those invited 7+ days ago who never logged in)
create or replace function invite_team(p_team uuid, p_again boolean default false) returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if not exists (select 1 from team where id = p_team and school_id = my_school_id()) then raise exception 'unknown team'; end if;
  for r in select p.id from team_login_people(p_team) t join person p on p.id = t.person_id
            where p.user_id is null and (p.invited_at is null or (p_again and p.invited_at < now() - interval '7 days')) loop
    perform resend_invite(r.id); n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function invite_team(uuid, boolean) to authenticated;

-- (3) status per team
create or replace function team_invite_status() returns table(team_id uuid, people integer, not_invited integer, invited integer, logged_in integer, waiting integer)
language sql stable security definer set search_path = public as $$
  select t.id,
    count(p.id)::int,
    count(p.id) filter (where p.user_id is null and p.invited_at is null)::int,
    count(p.id) filter (where p.user_id is null and p.invited_at is not null)::int,
    count(p.id) filter (where p.user_id is not null)::int,
    count(p.id) filter (where p.user_id is null and p.invited_at < now() - interval '7 days')::int
  from team t left join lateral team_login_people(t.id) l on true left join person p on p.id = l.person_id
  where t.school_id = my_school_id() and not t.archived and i_am_admin()
  group by t.id
$$;
grant execute on function team_invite_status() to authenticated;

-- (4) client errors
create table if not exists client_error (
  id uuid primary key default gen_random_uuid(), school_id uuid references school(id) on delete cascade, person_id uuid references person(id) on delete set null,
  created_at timestamptz not null default now(), message text not null, stack text, url text, ua text, app_version text);
alter table client_error enable row level security;
drop policy if exists client_error_admin on client_error;
create policy client_error_admin on client_error for select using (school_id = my_school_id() and i_am_admin());
create or replace function log_client_error(p_message text, p_stack text, p_url text, p_ua text, p_version text) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id();
begin
  if me is null then return; end if;
  if (select count(*) from client_error where person_id = me and created_at > now() - interval '1 day') >= 20 then return; end if;
  insert into client_error(school_id, person_id, message, stack, url, ua, app_version)
  values (my_school_id(), me, left(coalesce(p_message, '?'), 500), left(p_stack, 2000), left(p_url, 300), left(p_ua, 300), left(p_version, 40));
  delete from client_error where created_at < now() - interval '60 days';
end $$;
grant execute on function log_client_error(text, text, text, text, text) to authenticated;
