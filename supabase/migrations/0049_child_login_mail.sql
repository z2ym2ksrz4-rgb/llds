-- 0049: when a parent switches on a child's login (Settings → Børn), the child gets the welcome mail too – before, nothing visible happened.
create or replace function grant_child_login(p_child uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_person_id(); c person; nm text; em text := lower(trim(p_email));
begin
  if not exists (select 1 from guardian g where g.parent_id = me and g.child_id = p_child) then raise exception 'not your child'; end if;
  select * into c from person where id = p_child;
  if person_age(c) is not null and person_age(c) < 10 then raise exception 'child too young'; end if;
  if exists (select 1 from person where lower(email) = em and id <> p_child) then raise exception 'email in use'; end if;
  update person set email = em, supervised_by = me, status = 'approved', invited_at = now(), updated_at = now() where id = p_child;
  update guardian set consent_at = now(), confirmed = true where parent_id = me and child_id = p_child;
  nm := access_phrase(p_child);
  perform send_mail(c.school_id, em, 'Velkommen i appen – LL Dance Studio', app_mail_html(c.school_id, 'Du er inviteret', c.first_name,
    '<p>Du er oprettet i LL Dance Studios app' || coalesce(' ' || nm, '') || '. Her finder du træningstider, afbud, beskeder fra træneren, koreografi og meget mere.</p>'
    || '<p>Tryk på knappen, hent appen (eller åbn den i browseren) og log ind med <b>' || em || '</b>.</p>'), 'invite', jsonb_build_object('person_id', p_child));
end $$;
