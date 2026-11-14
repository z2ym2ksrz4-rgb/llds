-- 0051: "infinite recursion detected in policy for relation person" when admin saved a member.
--       The self/parent update policies looked the row up in person again inside their WITH CHECK; read the old flags through a
--       SECURITY DEFINER helper instead (no RLS re-entry).
create or replace function person_prev_flags(p_id uuid) returns table(is_admin boolean, status text)
language sql stable security definer set search_path = public as $$ select is_admin, status::text from person where id = p_id $$;

drop policy if exists person_self_update on person;
create policy person_self_update on person for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and (is_admin, status::text) = (select f.is_admin, f.status from person_prev_flags(person.id) f));

drop policy if exists person_parent_update on person;
create policy person_parent_update on person for update
  using (id in (select child_id from guardian where parent_id = my_person_id()))
  with check (id in (select child_id from guardian where parent_id = my_person_id()) and (is_admin, status::text) = (select f.is_admin, f.status from person_prev_flags(person.id) f));
