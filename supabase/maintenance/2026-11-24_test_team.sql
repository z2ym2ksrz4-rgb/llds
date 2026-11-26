-- "Testholdet": one closed, private team where every test persona lives, with demo content for everything the app
-- can do. Re-runnable: deletes and recreates its own content (marker = team name 'Testholdet'). Real teams untouched
-- except that the test personas leave them.
do $$
declare sid uuid; tid uuid; lille uuid; rid uuid := gen_random_uuid();
  rasmus uuid; camilla uuid; helle uuid; jonas uuid; sanne uuid; pia uuid; tilde uuid; milo uuid; ida uuid; noor uuid;
  d date; starts timestamptz; ev uuid; p1 uuid; p2 uuid; fs uuid; b_fight uuid; b_smile uuid;
  testp uuid[]; dancers uuid[]; app text := 'https://ilumie.com/llds/app/art/catalog/';
begin
  select id into sid from school limit 1;
  select id into lille from room where school_id = sid and name ilike 'Lille%' limit 1;
  select id into rasmus from person where first_name='Rasmus' and last_name='Testperson';
  select id into camilla from person where first_name='Camilla' and last_name='Testperson';
  select id into helle from person where first_name='Helle' and last_name='Testperson';
  select id into jonas from person where first_name='Jonas' and last_name='Testperson';
  select id into sanne from person where first_name='Sanne' and last_name='Testperson';
  select id into pia from person where first_name='Pia' and last_name='Testperson';
  select id into tilde from person where first_name='Tilde' and last_name='Testperson';
  select id into milo from person where first_name='Milo' and last_name='Testperson';
  select id into ida from person where first_name='Ida' and last_name='Testperson';
  select id into noor from person where first_name='Noor' and last_name='Testperson';
  select array_agg(id) into testp from person where last_name in ('Testperson','Testdanser');
  select array_agg(id) into dancers from person where (last_name='Testdanser') or id in (tilde, milo, ida, noor, jonas, sanne);

  -- the team (recreate)
  delete from session where team_id in (select id from team where name='Testholdet');
  delete from team where name = 'Testholdet';
  insert into team(school_id, name, style, category, level, closed, visibility, color, sort, description, years, day_time, price, price_full, price_half, admission, signup_open, parents_see_video, cover_url, about_url, photos, gallery, focus)
  values (sid, 'Testholdet', 'Showdance', 'junior', 'Test', false, 'private', '#b8485a', 999,
    'Testholdet er appens legeplads: her er alle testpersoner samlet, så alt kan prøves af uden at røre de rigtige hold – beskeder, koreografi, formationer, events, emblemer, betalinger og auditions. Opret løs.',
    '2008–2018', 'Søndag kl. 10:00–11:00 (60 min)', 'Testpris', 1000, 600, 'open', true, true,
    'art/catalog/group-stage.jpg', 'art/catalog/studio-mirror.jpg',
    array[app||'group-stage.jpg', app||'showdance-gold-solo.jpg', app||'light-trails.jpg', app||'solo-spotlight.jpg'],
    array[app||'group-stage.jpg', app||'showdance-gold-solo.jpg', app||'light-trails.jpg'], '{"x":0.5,"y":0.35}'::jsonb)
  returning id into tid;
  update team set is_test = true where id = tid;   -- 0071: hidden from everyone but admins and its own members

  -- personas move: out of the real teams, into Testholdet
  delete from membership where person_id = any(testp);
  insert into membership(person_id, team_id, role) select unnest(dancers), tid, 'dancer';
  insert into membership(person_id, team_id, role) values (rasmus, tid, 'trainer'), (camilla, tid, 'trainer'), (helle, tid, 'assistant');

  -- weekly training: Sundays 10–11 in Lille Sal for the next 16 weeks (nothing else runs then)
  d := current_date + ((7 - extract(isodow from current_date)::int) % 7);  -- next Sunday (today if Sunday)
  for i in 0..15 loop
    starts := (d + i*7) + time '10:00' at time zone 'Europe/Copenhagen';
    insert into session(school_id, team_id, room_id, starts_at, ends_at, trainer_id, assistant_id, weekly_rule_id, lesson_plan)
    values (sid, tid, lille, starts, starts + interval '60 min', rasmus, helle, rid, case when i = 0 then E'Opvarmning 10 min\nGennemgang af første 32 tæller\nFormation 2 på gulvet\nAfslut med strækøvelser' else null end);
  end loop;

  -- trainer messages (one to read, one to accept)
  insert into message(school_id, author_id, title, body, audience, needs) values
    (sid, rasmus, 'Velkommen til Testholdet 🎉', 'Her kan I prøve alt i appen. Meld afbud, skriv til mig, se koreografien og leg med formationerne – intet her er rigtigt.', jsonb_build_object('teams', jsonb_build_array(tid)), 'read'),
    (sid, rasmus, 'Husk sort tøj til søndag', 'Vi filmer gennemløbet søndag – sort tøj og hår i knold. Tryk Acceptér, når I har læst det.', jsonb_build_object('teams', jsonb_build_array(tid)), 'accept');

  -- feed: posts + comments
  insert into post(school_id, team_id, channel, author_id, body) values (sid, tid, 'team', rasmus, 'Godt gået i dag, alle sammen! Formation 2 sad lige i skabet. 💪') returning id into p1;
  insert into post(school_id, team_id, channel, author_id, body) values (sid, tid, 'team', sanne, 'Er der nogen, der har set en sort hættetrøje med guldtryk? Lå i Lille Sal søndag.') returning id into p2;
  insert into comment(post_id, author_id, body) values (p1, tilde, 'Tak! Det var sjovt 🙌'), (p1, pia, 'Milo snakkede om det hele vejen hjem 😄'), (p2, helle, 'Den ligger i hittegodskassen ved indgangen.');

  -- a conversation parent → trainer
  insert into thread(school_id, team_id, subject, created_by, participants) values (sid, tid, 'Milo og konkurrencen', pia, array[pia, rasmus]) returning id into ev;
  insert into thread_message(thread_id, sender_id, body) values (ev, pia, 'Hej Rasmus – kan Milo nå at være med til showet, selvom han har været syg to gange?'), (ev, rasmus, 'Hej Pia – ja, sagtens. Han kender koreografien, vi tager de sidste detaljer søndag.');

  -- formations
  insert into formation_set(team_id, title, created_by, frames, markers)
  select tid, 'Testshow – åbning', rasmus,
    jsonb_build_array(
      jsonb_build_object('id','f1','label','Start','at','1','positions', jsonb_agg(jsonb_build_object('key', q.id, 'label', q.ini, 'name', q.first_name, 'x', 0.15 + q.n*0.12, 'y', 0.6))),
      jsonb_build_object('id','f2','label','V-formation','at','17','positions', jsonb_agg(jsonb_build_object('key', q.id, 'label', q.ini, 'name', q.first_name, 'x', 0.15 + q.n*0.12, 'y', 0.3 + abs(4 - q.n)*0.1)))
    ), '[]'::jsonb
  from (select p.id, p.first_name, left(p.first_name,1)||left(p.last_name,1) as ini, row_number() over (order by p.first_name) as n from person p where p.id = any(dancers)) q
  returning id into fs;

  -- event for the team (with sign-ups), a result and a milestone, two emblems
  insert into event(school_id, title, kind, starts_at, place, meet_time, team_ids, plan, pack_list, info, signup_deadline, price_dkk, visibility, created_by, image_key)
  values (sid, 'Testshow i Lille Sal', 'show', (current_date + 21) + time '14:00', 'LL Dance Studio, Lille Sal', '13:15',
    array[tid], '[{"time":"13:15","text":"Mødetid – omklædning"},{"time":"13:45","text":"Gennemløb"},{"time":"14:00","text":"Show"},{"time":"14:45","text":"Kage og hygge"}]'::jsonb,
    array['Kostume','Vandflaske','Hårelastikker'], 'Et lille show kun for Testholdet og familier. Alt her er demo.', current_date + 14, 50, 'private', camilla, 'event-show-it') returning id into ev;
  insert into event_signup(event_id, person_id, paid) values (ev, tilde, true), (ev, milo, false), (ev, noor, false);
  insert into result(school_id, team_id, event_title, placed, held_on, visibility) values (sid, tid, 'Testcup 2026', '1. plads', current_date - 30, 'private');
  insert into milestone(person_id, title, reached_on) values (tilde, '100 træninger', current_date - 10);
  select id into b_fight from badge where school_id = sid and key = 'fighter'; select id into b_smile from badge where school_id = sid and key = 'smile';
  if b_fight is not null then insert into person_badge(person_id, badge_id, team_id, note, given_by) values (milo, b_fight, tid, 'Kæmpede sig igennem hele gennemløbet', rasmus) on conflict do nothing; end if;
  if b_smile is not null then insert into person_badge(person_id, badge_id, team_id, note, given_by) values (ida, b_smile, tid, 'Smilet der smitter', rasmus) on conflict do nothing; end if;

  -- a season payment awaiting Line (demo of the payment flow) for Noor via Sanne
  insert into web_signup(school_id, dancer_id, contact_id, team_id, plan, amount_dkk, reference, status, source)
  values (sid, noor, sanne, tid, 'half', 600, 'Testholdet Noor', 'awaiting_payment', 'admin');
end $$;
select t.name, t.id, (select count(*) from membership m where m.team_id = t.id) as members, (select count(*) from session s where s.team_id = t.id) as sessions from team t where t.name = 'Testholdet';
