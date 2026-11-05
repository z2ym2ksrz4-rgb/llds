-- Seed: LL Dance Studio, rooms and season 26/27 teams (from lldancestudio.dk/saeson-26-27).
-- Run after 0001_schema.sql. Sessions are generated for the current week by the app's season planner later.
insert into school(slug, name, settings) values ('llds', 'LL Dance Studio',
  '{"minAccountAge":13,"supervisedFromAge":10,"trainersPostOnMini":true,"mobilepay":{"number":"46664","name":"LL Dance Studio"},"address":"Vinkelvej 17, 8860 Ulstrup","phone":"+45 22 44 01 55","email":"lldancestudio.info@gmail.com"}')
on conflict (slug) do nothing;

with s as (select id from school where slug = 'llds')
insert into room(school_id, name, sort) select s.id, r.name, r.sort from s, (values ('Store Sal', 0), ('Lille Sal', 1)) as r(name, sort)
on conflict do nothing;

-- category: mini = "Mini Børn", kids = "Børn", junior, adult, mixed. parents_see_video = mini + kids.
with s as (select id from school where slug = 'llds')
insert into team(school_id, name, style, category, level, closed, parents_see_video, punch_card_open, sort)
select s.id, t.name, t.style, t.category::team_category, t.level, t.closed, t.category in ('mini','kids'), t.punch, row_number() over ()
from s, (values
  ('Mini Cuties',            'Showdance',    'mini',   'Begynder & Let øvet', false, false),
  ('Hip Hop Mini',           'Hip Hop',      'mini',   'Alle niveauer',       false, false),
  ('Mini Angels',            'Showdance',    'mini',   'Øvet+',               true,  false),
  ('Mini Magic',             'Showdance',    'mini',   'Øvet',                false, false),
  ('Spring & Tumbling Mini', 'Spring',       'mini',   'Alle niveauer',       false, false),
  ('Mini Stjernetrin',       'Forældre/barn','mini',   'Alle niveauer',       false, false),
  ('Danse Stjerner',         'Showdance',    'mini',   'Alle niveauer',       false, false),
  ('Ballet Mini',            'Ballet',       'mini',   'Alle niveauer',       false, false),
  ('Teknik Mini',            'Teknik',       'mini',   'Øvet+',               false, false),
  ('Disco Dance',            'Disco',        'kids',   'Begynder',            false, false),
  ('Shining Stars',          'Showdance',    'kids',   'Begynder',            false, false),
  ('Satellite Stars',        'Showdance',    'kids',   'Øvet',                false, false),
  ('Sky Stars',              'Showdance',    'kids',   'Øvet+',               false, false),
  ('New Age',                'Showdance',    'kids',   'Elite',               true,  false),
  ('Spring & Tumbling Børn', 'Spring',       'kids',   'Alle niveauer',       false, false),
  ('Teknik Børn Showdance',  'Teknik',       'kids',   'Øvet & Øvet+',        false, false),
  ('Teknik New Age',         'Teknik',       'kids',   'Elite',               false, false),
  ('Hip Hop Børn',           'Hip Hop',      'kids',   'Alle niveauer',       false, false),
  ('Styrketræning Børn',     'Styrke',       'kids',   'Øvet+ & Elite',       false, false),
  ('Smidighed & Acro',       'Acro',         'kids',   'Alle niveauer',       false, false),
  ('Division',               'Showdance',    'junior', 'Begynder',            false, false),
  ('Empire',                 'Showdance',    'junior', 'Øvet',                false, false),
  ('Control',                'Showdance',    'junior', 'Øvet+',               false, false),
  ('The AXIS',               'Showdance',    'junior', 'Elite+',              true,  false),
  ('Apexion',                'Showdance',    'junior', 'Elite+',              true,  false),
  ('Airy',                   'Showdance',    'junior', 'Elite',               true,  false),
  ('Teknik Empire & Control','Teknik',       'junior', 'Øvet & Øvet+',        false, false),
  ('Teknik Apexion & Airy',  'Teknik',       'junior', 'Elite & Elite+',      false, false),
  ('Teknik The AXIS',        'Teknik',       'junior', 'Elite+',              false, false),
  ('Hip Hop Junior & Voksen Begynder', 'Hip Hop', 'mixed', 'Begynder & Let øvet', false, false),
  ('Hip Hop Junior & Voksen Elite',    'Hip Hop', 'mixed', 'Øvet & Elite',        false, false),
  ('Contemporary Begynder',  'Contemporary', 'mixed',  'Begynder & Let øvet', false, false),
  ('Contemporary Elite',     'Contemporary', 'mixed',  'Øvet & Elite',        false, false),
  ('Styrketræning Junior & Voksen', 'Styrke', 'mixed', 'Øvet+ & Elite',       false, false),
  ('Spring & Tumbling Junior & Voksen', 'Spring', 'mixed', 'Øvet & Elite',    false, false),
  ('Disco',                  'Disco',        'mixed',  'Øvet & Elite',        false, false),
  ('Disco Slow',             'Disco',        'mixed',  'Øvet & Elite',        false, false),
  ('Hit Fit Dance tirsdag',  'Fitness',      'adult',  'Alle niveauer',       false, true),
  ('Hit Fit Dance onsdag',   'Fitness',      'adult',  'Alle niveauer',       false, true),
  ('Ballet',                 'Ballet',       'mixed',  'Alle niveauer',       false, false),
  ('No Addiction',           'Showdance',    'adult',  'Elite',               true,  false)
) as t(name, style, category, level, closed, punch);

-- Punch card type for the two Hit Fit Dance teams (Line, 5 Nov 2026: 10 klip = 625 kr.)
with s as (select id from school where slug = 'llds')
insert into punch_card_type(school_id, name, punches, valid_days, price_dkk)
select s.id, '10 klip – Hit Fit Dance', 10, 365, 625 from s;

-- Admin bootstrap (run once with the service role after Line has signed in the first time):
-- update person set status='approved', is_admin=true where email='<lines-email>';
