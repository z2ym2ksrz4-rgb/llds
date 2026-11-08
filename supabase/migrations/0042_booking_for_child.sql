-- 0042: a parent may book a room for a child (booking.person_id = the child); dancers and parents get 'pending', staff 'approved'.
drop policy if exists booking_insert on booking;
create policy booking_insert on booking for insert with check (
  school_id = my_school_id() and i_am_approved()
  and (select supervised_by from person where id = my_person_id()) is null
  and (person_id = my_person_id() or person_id in (select child_id from guardian where parent_id = my_person_id()))
  and status = case when i_am_staff() then 'approved' else 'pending' end
);
-- a parent may also cancel the child's booking
drop policy if exists booking_own on booking;
create policy booking_own on booking for delete using (person_id = my_person_id() or person_id in (select child_id from guardian where parent_id = my_person_id()));
