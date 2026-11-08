-- Test personas for "Vis appen som": one real person per role scenario, clearly named "Testperson". Admin previews the app exactly as they see it.
-- Re-runnable: wipes and recreates the set (they never log in – no e-mail, no user_id).
do $$
declare sid uuid := (select id from school where slug = 'llds');
  tm_axis uuid; tm_apex uuid; tm_angels uuid; tm_cuties uuid; tm_empire uuid; tm_hiphop uuid; tm_contemp uuid;
  tilde uuid; milo uuid; pia uuid; ida uuid; rasmus uuid; helle uuid; jonas uuid; sanne uuid; noor uuid; camilla uuid;
  yr int := extract(year from current_date)::int;
  function_team uuid;
begin
  delete from person where school_id = sid and last_name = 'Testperson';
  select id into tm_axis from team where school_id = sid and name = 'The AXIS';
  select id into tm_apex from team where school_id = sid and name = 'Apexion';
  select id into tm_angels from team where school_id = sid and name = 'Mini Angels';
  select id into tm_cuties from team where school_id = sid and name = 'Mini Cuties';
  select id into tm_empire from team where school_id = sid and name = 'Empire';
  select id into tm_hiphop from team where school_id = sid and name = 'Hip Hop Junior & Voksen Elite';
  select id into tm_contemp from team where school_id = sid and name = 'Contemporary Elite';
  select id into function_team from team where school_id = sid and not archived order by sort limit 1;
  tm_axis := coalesce(tm_axis, function_team); tm_apex := coalesce(tm_apex, function_team); tm_angels := coalesce(tm_angels, function_team); tm_cuties := coalesce(tm_cuties, function_team);
  tm_empire := coalesce(tm_empire, function_team); tm_hiphop := coalesce(tm_hiphop, function_team); tm_contemp := coalesce(tm_contemp, function_team);

  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Tilde', 'Testperson', make_date(yr - 15, 3, 12), yr - 15, 'approved', false, '{dancer}', 'admin', true) returning id into tilde;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Pia', 'Testperson', make_date(1984, 6, 2), 1984, 'approved', false, '{parent}', 'admin', true) returning id into pia;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent, supervised_by)
    values (sid, 'Milo', 'Testperson', make_date(yr - 11, 9, 20), yr - 11, 'approved', false, '{dancer}', 'admin', true, pia) returning id into milo;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Ida', 'Testperson', make_date(yr - 8, 1, 5), yr - 8, 'approved', false, '{dancer}', 'admin', true) returning id into ida;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Rasmus', 'Testperson', make_date(1996, 11, 30), 1996, 'approved', false, '{trainer}', 'admin', true) returning id into rasmus;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Helle', 'Testperson', make_date(yr - 16, 4, 18), yr - 16, 'approved', false, '{assistant}', 'admin', true) returning id into helle;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Jonas', 'Testperson', make_date(2004, 2, 9), 2004, 'approved', false, '{dancer,trainer}', 'admin', true) returning id into jonas;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Sanne', 'Testperson', make_date(1988, 8, 14), 1988, 'approved', false, '{parent,dancer}', 'admin', true) returning id into sanne;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Noor', 'Testperson', make_date(yr - 10, 5, 25), yr - 10, 'approved', false, '{dancer}', 'admin', true) returning id into noor;
  insert into person(school_id, first_name, last_name, birth_date, birth_year, status, is_admin, wished_roles, source, photo_consent)
    values (sid, 'Camilla', 'Testperson', make_date(1981, 12, 1), 1981, 'approved', true, '{trainer,parent}', 'admin', true) returning id into camilla;

  insert into membership(person_id, team_id, role) values
    (tilde, tm_axis, 'dancer'),
    (milo, tm_angels, 'dancer'),
    (ida, tm_cuties, 'dancer'),
    (rasmus, tm_hiphop, 'trainer'), (rasmus, tm_empire, 'trainer'),
    (helle, tm_cuties, 'assistant'),
    (jonas, tm_apex, 'dancer'), (jonas, tm_empire, 'trainer'),
    (sanne, tm_contemp, 'dancer'),
    (noor, tm_angels, 'dancer'),
    (camilla, tm_axis, 'trainer')
  on conflict do nothing;
  insert into guardian(parent_id, child_id, confirmed) values (pia, milo, true), (pia, ida, true), (sanne, noor, true), (camilla, milo, true) on conflict do nothing;
end $$;
