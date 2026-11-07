-- 0016: AI catalogue art per team. Teams with Line's own front photo (cover_path) keep it – the art becomes a mood image on the team page.
-- Teams without a photo (technique, Hit Fit) get the art as cover. Paths are app-relative (public/art/catalog).
do $$ declare sid uuid := (select id from school where slug = 'llds'); begin
  update team set cover_url = 'art/catalog/' || v.f from (values
    ('Teknik New Age', 'showdance-gold-solo.jpg'), ('Teknik Børn Showdance', 'dance-white.jpg'), ('Teknik The AXIS', 'team-junior-elite.jpg'),
    ('Teknik Empire & Control', 'lift-white.jpg'), ('Teknik Apexion & Airy', 'contemporary-flow.jpg'), ('Teknik Mini', 'team-mini.jpg'),
    ('Hit Fit Dance tirsdag', 'team-fitness-adult.jpg'), ('Hit Fit Dance onsdag', 'hiphop-daylight.jpg'),
    ('Control', 'lift-white.jpg'), ('Empire', 'contemporary-olive.jpg'), ('Mini Angels', 'team-kids-showdance.jpg'), ('Mini Cuties', 'team-mini.jpg'),
    ('Mini Magic', 'dance-white.jpg'), ('New Age', 'contemporary-green.jpg'), ('Satellite Stars', 'contemporary-grey.jpg'), ('Sky Stars', 'contemporary-flow.jpg'),
    ('The AXIS', 'team-junior-elite.jpg'), ('Apexion', 'showdance-gold-solo.jpg'), ('Airy', 'event-show-it.jpg')
  ) as v(n, f) where team.school_id = sid and team.name = v.n and (team.cover_path is not null or team.name like 'Teknik%' or team.name like 'Hit Fit%');
  -- season events get their unique art
  update event set image_key = v.k from (values
    ('Julebal', 'event-julebal'), ('KC Rangliste 1 – Junior & Voksen', 'event-rangliste-1-junior'), ('KC Rangliste 1 – Mini Børn & Børn', 'event-rangliste-1-born'),
    ('KC Rangliste 2 – Børn 2, Junior 2 & Voksen', 'event-rangliste-2-born2'), ('KC Rangliste 2 – Mini Børn, Børn 1 & Junior 1', 'event-rangliste-2-born1'),
    ('Danmark Danser – Solo & Duo', 'event-danmark-danser'), ('CPH Open', 'event-cph-open'), ('KC Semifinale', 'event-semifinale'), ('CPH Open Finale', 'event-cph-open-finale'),
    ('KC Finale', 'event-kc-finale'), ('DM Showdance – Børn, Junior & Voksen', 'event-dm-junior-voksen'), ('DM Showdance – Mini Børn Debutant & Talent', 'event-dm-mini'),
    ('Show IT', 'event-show-it'), ('Afdansningsbal', 'event-afdansningsbal'), ('Danmark Danser – Finale (Solo & Duo)', 'event-dd-finale')
  ) as v(t, k) where event.school_id = sid and event.title = v.t and event.image_key is null;
end $$;
