-- 0078: test persons get notifications too.
-- notify() skipped everyone without a login – right for real members (a child without a login has nothing to read them with), but the
-- test personas ("… Testperson", no login) therefore never got a single notification, so the counters in the bottom menu stayed empty
-- whenever the app was tested through "Vis appen som". Test persons now receive them like members with a login; nobody else changes.
create or replace function notify(p_person uuid, p_kind text, p_title text, p_body text, p_ref jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notification(person_id, kind, title, body, ref) select p_person, p_kind, p_title, p_body, p_ref
  where exists (select 1 from person where id = p_person and (user_id is not null or last_name = 'Testperson')) and wants_notification(p_person, p_kind)
$$;

-- … and the admin who looks through a test person's eyes can mark that person's notifications read (opening a tab clears its counter).
drop policy if exists notification_admin_test_update on notification;
create policy notification_admin_test_update on notification for update using (
  i_am_admin() and person_id in (select id from person where school_id = my_school_id() and last_name = 'Testperson')
) with check (
  i_am_admin() and person_id in (select id from person where school_id = my_school_id() and last_name = 'Testperson')
);

insert into schema_migration (name) values ('0078_notify_test_persons') on conflict do nothing;
select 'chk' as chk, (select count(*) from pg_policies where tablename = 'notification' and policyname = 'notification_admin_test_update') as policy,
  (select count(*) from person where last_name = 'Testperson') as test_persons;
