-- 0022: "Slet min konto" (Settings). Deletes the person, their children without own login, and the auth user. Posts/media/orders cascade via FKs.
-- An admin cannot delete themselves while they are the school's only admin.
create or replace function delete_my_account() returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id(); uid uuid := auth.uid(); c uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if me is not null then
    if exists (select 1 from person where id = me and is_admin) and (select count(*) from person p where p.school_id = my_school_id() and p.is_admin and p.status = 'approved') <= 1 then
      raise exception 'last admin';
    end if;
    for c in select child_id from guardian where parent_id = me loop
      if not exists (select 1 from guardian g where g.child_id = c and g.parent_id <> me) then
        if exists (select 1 from person where id = c and user_id is not null) then
          delete from auth.users where id = (select user_id from person where id = c);
        end if;
        delete from person where id = c;
      end if;
    end loop;
    delete from person where id = me;
  end if;
  delete from auth.users where id = uid;
end $$;
grant execute on function delete_my_account() to authenticated;
