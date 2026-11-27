-- Trainers on the website come from the app's people instead of fixed text: who is shown, in which order, with which
-- title, photo and text. One profile – the website and the app show the same person. The 17 current trainers are carried
-- over with the photo and text the website shows today.
alter table person add column if not exists site_show boolean not null default false;
alter table person add column if not exists site_title text;
alter table person add column if not exists site_bio text;
alter table person add column if not exists site_photo text;
alter table person add column if not exists site_sort int;

-- what the website may read (no contact details)
create or replace view public_trainers as
  select p.school_id, p.id, trim(p.first_name || ' ' || coalesce(p.last_name, '')) as name, p.site_title as title,
         coalesce(nullif(trim(p.site_bio), ''), p.bio) as bio, p.site_photo as photo, coalesce(p.site_sort, 9999) as sort,
         (select string_agg(x.name, ' · ' order by x.sort, x.name) from (select distinct t.name, t.sort from membership m join team t on t.id = m.team_id
            where m.person_id = p.id and m.role in ('trainer', 'assistant') and t.visibility = 'public' and not t.archived and not t.is_test) x) as teaches
  from person p where p.site_show and p.status = 'approved';
grant select on public_trainers to anon, authenticated;

-- everything the admin page needs: the people shown on the website and the staff who could be added
create or replace function site_trainers_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', trim(p.first_name || ' ' || coalesce(p.last_name, '')), 'show', p.site_show, 'title', p.site_title,
      'bio', p.site_bio, 'app_bio', p.bio, 'photo', p.site_photo, 'sort', coalesce(p.site_sort, 9999), 'has_login', p.user_id is not null,
      'teaches', (select string_agg(x.name, ' · ' order by x.sort, x.name) from (select distinct t.name, t.sort from membership m join team t on t.id = m.team_id
                    where m.person_id = p.id and m.role in ('trainer', 'assistant') and not t.archived and not t.is_test) x))
      order by p.site_show desc, coalesce(p.site_sort, 9999), p.first_name)
    from person p
    where p.school_id = my_school_id() and p.status = 'approved' and p.last_name not in ('Testperson', 'Testdanser')
      and (p.site_show or 'trainer' = any(p.wished_roles) or exists (select 1 from membership m where m.person_id = p.id and m.role in ('trainer', 'assistant')))), '[]'::jsonb);
end $$;
grant execute on function site_trainers_admin() to authenticated;

create or replace function site_trainer_save(p_id uuid, p_show boolean, p_title text, p_bio text, p_photo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  update person set site_show = coalesce(p_show, site_show), site_title = nullif(trim(coalesce(p_title, '')), ''), site_bio = nullif(trim(coalesce(p_bio, '')), ''),
    site_photo = nullif(trim(coalesce(p_photo, '')), ''),
    site_sort = case when coalesce(p_show, site_show) and site_sort is null then (select coalesce(max(site_sort), 0) + 1 from person where school_id = my_school_id()) else site_sort end
  where id = p_id and school_id = my_school_id();
  if not found then raise exception 'unknown person'; end if;
end $$;
grant execute on function site_trainer_save(uuid, boolean, text, text, text) to authenticated;

create or replace function site_trainer_order(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  update person p set site_sort = o.n from unnest(p_ids) with ordinality as o(id, n) where p.id = o.id and p.school_id = my_school_id();
end $$;
grant execute on function site_trainer_order(uuid[]) to authenticated;

-- a new trainer who has no login (yet): a person the school knows, shown on the website. Team roles are given under Medlemmer as usual.
create or replace function site_trainer_add(p_first text, p_last text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  if coalesce(trim(p_first), '') = '' then raise exception 'missing name'; end if;
  insert into person(school_id, first_name, last_name, status, wished_roles, source, site_show, site_sort)
  values (my_school_id(), trim(p_first), coalesce(trim(p_last), ''), 'approved', '{trainer}', 'admin', true, (select coalesce(max(site_sort), 0) + 1 from person where school_id = my_school_id()))
  returning id into pid;
  return pid;
end $$;
grant execute on function site_trainer_add(text, text) to authenticated;

-- carry the current website trainers over (only where nothing is set yet). Where two people share a name, the one who is staff on a team wins.
do $$
declare sid uuid; r record; pid uuid; n int := 0; miss text := '';
begin
  select id into sid from school order by created_at limit 1;
  if sid is null then return; end if;
  for r in select * from (values
    ('Line', 'Lund Olesen', 'Stifter, ejer og træner', 'Line er studiets stifter og ejer med 15 års erfaring som danser og 10 års undervisning. Hun har danset showdance, ballet, moderne, hiphop og disco, vundet showdance-turneringer og været Europa- og verdensmester i disco med sit hold. Hun vægter en inkluderende og inspirerende læringsoplevelse.', 'https://ilumie.com/llds/media/2025/09/LL-Line-1536x647.png', 1),
    ('Britta', 'Nygaard Olesen', 'Beklædningsdesigner og skrædder', 'Britta finder og bestiller tøj, rekvisitter og lignende til holdene og står for at sy og ændre tøj. Ved turneringer er hun fast hjælp, som assisterer eleverne.', 'https://ilumie.com/llds/media/2026/08/skabelon1-1536x647.jpg', 2),
    ('Malou', 'Bøgild', 'Træner og SoMe-ansvarlig', 'Malou har danset siden 2018 på eliteplan som junior- og voksendanser, primært showdance, og begyndte at undervise i 24/25. Hun ønsker et trygt og motiverende miljø, hvor dans handler om fællesskab, glæde og selvtillid.', 'https://ilumie.com/llds/media/2026/08/skabelon4-1536x647.jpg', 3),
    ('Lara', 'Hess Andersen', 'Træner', 'Lara er 19 år og har danset siden hun var ni – de seneste år på eliteplan, primært showdance og hiphop. Hun har undervist i to sæsoner og brænder for at give danseglæden videre.', 'https://ilumie.com/llds/media/2025/09/lara-1536x647.png', 4),
    ('Seline', 'Glerup Jepsen', 'Træner', 'Seline har danset i 12 år med fokus på showdance, de seneste syv år på eliteniveau, og har været træner siden 2024. Hun lægger vægt på danseglæde, fællesskab og at alle gør deres bedste.', 'https://ilumie.com/llds/media/2026/08/skabelon3-1536x647.jpg', 5),
    ('Isabella', 'Eriksen', 'Træner', 'Isabella begyndte at danse som toårig og har danset showdance på eliteholdene fra barn til junior, senere i Showkompagniet. Hun danser i dag på voksenholdet Picasso og fortsætter med ballet på Balletakademiet.', 'https://ilumie.com/llds/media/2026/08/skabelon7-1536x647.jpg', 6),
    ('Christine', 'Lassen', 'Træner', 'Christine, kaldet Chir, har danset hos Line i ni år og showdance på eliteplan i fem år. Hun ønsker at skabe et trygt og sjovt miljø for alle – både i undervisningen og udenfor.', 'https://ilumie.com/llds/media/2026/08/skabelon-1536x647.jpg', 7),
    ('Sara', 'Frandsen', 'Træner', 'Sara er 19 år og har danset i omkring 15 år, de seneste seks på eliteplan. Hun vil give den tryghed og danseglæde videre, som dansen har givet hende.', 'https://ilumie.com/llds/media/2026/08/skabelon8-1536x647.jpg', 8),
    ('Mathias', 'Tobiesen', 'Træner', 'Mathias har danset siden han var 11, bl.a. på scenekunstskoler, danselinje på efterskole og Dansk Talent Akademi, og er uddannet fra Copenhagen Dance Spaces i 2021.', 'https://ilumie.com/llds/media/2026/08/skabelon14-1536x647.jpg', 9),
    ('Annemette', 'Lund Kjær', 'Træner', 'Annemette underviser i Hit Fit/dancemix og showdance for voksne, danser selv på et konkurrencehold og er uddannet zumbainstruktør.', 'https://ilumie.com/llds/media/2026/08/skabelon6-1536x647.jpg', 10),
    ('Mille', 'Grøn Madsen', 'Træner', 'Mille er 15 år og har danset i ni år, heraf fem på elitehold. Hun vil skabe et trygt, motiverende og sjovt miljø, hvor alle børn føler sig set.', 'https://ilumie.com/llds/media/2026/08/skabelon2-1536x647.jpg', 11),
    ('Caroline', 'Ravn', 'Træner', 'Caroline har danset i seks år, primært showdance, de seneste fire år på eliteplan. Hun lægger vægt på danseglæde og et trygt miljø.', 'https://ilumie.com/llds/media/2026/08/skabelon10-1536x647.jpg', 12),
    ('Karoline', 'Hoe', 'Træner', 'Karoline er 16 år og har danset showdance i syv år, de seneste tre på The AXIS. Hun har været hjælpetræner i tre sæsoner og får nu sit eget teknikhold.', 'https://ilumie.com/llds/media/2026/08/skabelon12-1536x647.jpg', 13),
    ('Silje', 'Hartmann', 'Juniortræner', 'Silje har danset i syv år, primært showdance, og undervist i tre år. Hun vægter danseglæde, fællesskab og tryghed.', 'https://ilumie.com/llds/media/2026/08/skabelon5-1536x647.jpg', 14),
    ('Lea', 'Conley', 'Juniortræner', 'Lea har danset intensivt i tre år, to af dem hos LL Dance Studio, og har undervist i et år. Hun lægger vægt på leg, fællesskab og danseglæde.', 'https://ilumie.com/llds/media/2026/08/skabelon9-1536x647.jpg', 15),
    ('Liva', 'Mai Therkildsen', 'Juniortræner', 'Liva Mai er 15 år med ni års erfaring i disco, contemporary og showdance, de seneste tre år på The AXIS, og har repræsenteret Danmark ved EM i disco.', 'https://ilumie.com/llds/media/2026/08/skabelon11-1536x647.jpg', 16),
    ('Karoline', 'Andersen', 'Juniortræner', 'Karoline er 17 år og har danset siden hun var ni – disco, hiphop og showdance på konkurrenceplan. For hende er dans glæde, energi og fællesskab.', 'https://ilumie.com/llds/media/2026/08/skabelon13-1536x647.jpg', 17)
  ) as v(first_name, last_name, title, bio, photo, sort) loop
    select p.id into pid from person p where p.school_id = sid and p.first_name = r.first_name and p.last_name = r.last_name and p.status = 'approved'
      order by exists (select 1 from membership m where m.person_id = p.id and m.role in ('trainer', 'assistant')) desc, p.user_id is not null desc, p.created_at limit 1;
    if pid is null then miss := miss || r.first_name || ' ' || r.last_name || ', '; continue; end if;
    update person set site_show = true, site_title = r.title, site_bio = r.bio, site_photo = r.photo, site_sort = r.sort where id = pid and site_photo is null and site_bio is null and not site_show;
    n := n + 1;
  end loop;
  raise notice 'website trainers carried over: % of 17%', n, case when miss = '' then '' else ' – not found: ' || miss end;
end $$;
insert into schema_migration(name) values ('0076_site_trainers') on conflict do nothing;
